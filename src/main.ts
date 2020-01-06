import * as utils from '@iobroker/adapter-core';
import {BshbController} from './bshb-controller';
import {BehaviorSubject, Observable} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {Migration} from "./migration";
import {Utils} from "./utils";
import {ClientCert} from "./client-cert";
import {BshbError, BshbErrorType, BshbUtils} from "bosch-smart-home-bridge";
import {LogLevel} from "./log-level";
import * as fs from "fs";

/**
 * @author Christopher Holomek
 * @since 27.09.2019
 */
// TODO: delete this in the next version
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        interface AdapterConfig {
            // Define the shape of your options here (recommended)
            host: string;
            identifier: string;
            systemPassword: string;
            pairingDelay: number;

            // Or use a catch-all approach
            [key: string]: any;
        }
    }
}

export class Bshb extends utils.Adapter {


    private bshbController: BshbController | undefined;
    private pollingTrigger = new BehaviorSubject(true);

    public constructor(options: Partial<ioBroker.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'bshb',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Overwrite configuration
        // make sure that identifier is valid regarding Bosch T&C
        this.config.host = this.config.host.trim();
        const notPrefixedIdentifier = this.config.identifier.trim();
        this.config.identifier = 'ioBroker.bshb_' + notPrefixedIdentifier;
        this.config.systemPassword = this.config.systemPassword.trim();
        this.config.certsPath = this.config.certsPath.trim();

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.debug('config host: ' + this.config.host);
        this.log.debug('config identifier: ' + this.config.identifier);
        this.log.debug('config systemPassword: ' + (this.config.systemPassword != undefined));
        this.log.debug('config pairingDelay: ' + this.config.pairingDelay);

        if (!this.config.identifier) {
            Utils.createError(this.log, 'Identifier not defined but it is a mandatory parameter');
        }

        this.loadCertificates(notPrefixedIdentifier).subscribe(clientCert => {
            // Create controller for bosch-smart-home-bridge
            this.bshbController = new BshbController(this, clientCert.certificate, clientCert.privateKey);
            this.init(this.bshbController);
        }, error => {
            this.log.error('Could not initialize adapter. See more details in error: ' + error);
        });
    }

    /**
     * load certificates:<br/>
     * 1. load from system.certificates<br/>
     * 2. If not found search for old configuration to allow smooth migration<br/>
     * 3. If not found generate a new certificate<br/>
     *
     * @param notPrefixedIdentifier
     *        identifier without "ioBroker.bshb_" prefix which is used for system.certificates
     */
    private loadCertificates(notPrefixedIdentifier: string) {
        return new Observable<ClientCert>(subscriber => {
            this.getForeignObject('system.certificates', (err, obj) => {
                if (err || !obj) {
                    subscriber.error(Utils.createError(this.log, 'Could not load certificates. This should not happen. Error: ' + err));
                    subscriber.complete();
                    return;
                }

                let certificateKeys = Utils.getCertificateKeys(notPrefixedIdentifier);

                let clientCert = new ClientCert(obj.native.certificates[certificateKeys.cert],
                    obj.native.certificates[certificateKeys.key]);

                if (clientCert.certificate && clientCert.privateKey) {
                    // found certificates
                    this.log.info('Client certificate found in system.certificates');

                    this.log.info('Check if certificate is file reference or actual content');
                    const actualCert = this.loadFromFile(clientCert.certificate, 'certificate');
                    const actualPrivateKey =  this.loadFromFile(clientCert.privateKey, 'private key');
                    clientCert = new ClientCert(actualCert, actualPrivateKey);

                    subscriber.next(clientCert);
                    subscriber.complete();
                } else {
                    // no certificates found.
                    this.log.info('Could not find client certificate. Check for old configuration');
                    const migrationResult = this.migration();
                    if (migrationResult) {
                        clientCert = migrationResult;
                    } else {
                        this.log.info('No client certificate found in old configuration or it failed. Generate new certificate');
                        clientCert = Bshb.generateCertificate();
                    }
                    // store information
                    this.storeCertificate(obj, certificateKeys, clientCert).subscribe(() => {
                        subscriber.next(clientCert);
                        subscriber.complete();
                    }, error => {
                        subscriber.error(error);
                        subscriber.complete();
                    });
                }
            });
        });
    }

    private loadFromFile(file: string, type: string): string {
        try {
            if (fs.existsSync(file)) {
                this.log.info(`${type} is a file reference. Read from file`);
                return fs.readFileSync(file, 'utf-8');
            } else{
                this.log.info(`${type} seems to be actual content. Use value from state.`);
                return file;
            }
        }catch (e) {
            this.log.info(`${type} seems to be actual content or reading from file failed. Use value from state. For more details restart adapter with debug log level.`);
            this.log.debug(`Error during reading file: ${e}`);
            return file;
        }
    }

    private storeCertificate(obj: ioBroker.StateObject | ioBroker.ChannelObject | ioBroker.DeviceObject | ioBroker.OtherObject,
                             certificateKeys: { cert: string; key: string }, clientCert: ClientCert): Observable<void> {
        return new Observable<void>(subscriber => {
            // store information
            obj.native.certificates[certificateKeys.cert] = clientCert.certificate;
            obj.native.certificates[certificateKeys.key] = clientCert.privateKey;

            this.setForeignObject('system.certificates', obj, (err: string | null, obj: { id: string }) => {
                if (err || !obj) {
                    subscriber.error(Utils.createError(this.log,
                        'Could not store client certificate in system.certificates due to an error:' + err));
                    subscriber.complete();
                }
                this.log.info('Client certificate stored in system.certificates.');
                subscriber.next();
                subscriber.complete();
            });
        });
    }

    private migration() {
        // migration:
        const certsPath: string = (this.config as any).certsPath;
        if (!certsPath) {
            // We abort if we could nof find the certificate path
            return undefined;
        }

        this.log.info(`Found old configuration in certsPath: ${certsPath}. Try to read information`);

        try {
            const result = new ClientCert(Migration.loadCertificate(this, certsPath), Migration.loadPrivateKey(this, certsPath));
            this.log.info(`Load client certificate from old configuration successful. Consider removing them from: ${certsPath}. They are not needed anymore`);
            return result;
        } catch (err) {
            // something went wrong we abort. Logging was already done.
            return undefined;
        }
    }

    private static generateCertificate(): ClientCert {
        let certificateDefinition = BshbUtils.generateClientCertificate();
        return new ClientCert(certificateDefinition.cert, certificateDefinition.private);
    }

    private init(bshbController: BshbController) {
        // start pairing if needed
        bshbController.pairDeviceIfNeeded(this.config.systemPassword).pipe(switchMap(() => {
            // Everything is ok. We check for devices first
            return bshbController.detectDevices();
        }), switchMap(() => {
            // detect scenarios next
            return bshbController.detectScenarios();
        })).subscribe(() => {
            // register for changes
            this.subscribeStates('*');

            // now we want to subscribe to BSHC for changes
            this.startPolling(bshbController);
        });
    }

    private poll = (delay?: number) => {
        delay = delay ? delay : 0;
        setTimeout(() => {
            this.pollingTrigger.next(true);
        }, delay);
    };

    private startPolling = (bshbController: BshbController, delay?: number) => {
        this.log.info('Listen to changes');
        delay = delay ? delay : 0;
        setTimeout(() => {
            this.subscribeAndPoll(bshbController);
        }, delay);
    };

    private subscribeAndPoll = (bshbController: BshbController) => {
        this.pollingTrigger.next(false);
        this.pollingTrigger.complete();

        this.pollingTrigger = new BehaviorSubject<boolean>(true);

        bshbController.getBshcClient().subscribe().subscribe(response => {
            this.pollingTrigger.subscribe(keepPolling => {
                if (keepPolling) {
                    bshbController.getBshcClient().longPolling(response.parsedResponse.result).subscribe(infoResponse => {
                        if (infoResponse.incomingMessage.statusCode !== 200) {
                            if (infoResponse.incomingMessage.statusCode === 503) {
                                this.log.warn(`BSHC is starting. Try to reconnect asap. HTTP=${infoResponse.incomingMessage.statusCode}, data=${infoResponse.parsedResponse}`);
                            } else {
                                this.log.warn(`Something went wrong during long polling. HTTP=${infoResponse.incomingMessage.statusCode}, data=${infoResponse.parsedResponse}`);
                            }
                            // something went wrong we delay polling
                            this.poll(10000);
                        } else {
                            const information = infoResponse.parsedResponse;

                            // handle updates
                            information.result.forEach(resultEntry => {
                                if (Utils.isLevelActive(this.log.level, LogLevel.debug)) {
                                    this.log.debug(JSON.stringify(resultEntry));
                                }
                                bshbController.setStateAck(resultEntry);
                            });

                            // poll further data.
                            this.poll();
                        }
                    }, error => {
                        if ((error as BshbError).errorType === BshbErrorType.POLLING) {
                            this.log.warn(`Something went wrong during long polling. Try to reconnect.`);
                            this.startPolling(bshbController, 5000);
                        } else {
                            this.log.warn(`Something went wrong during long polling. Try again later.`);
                            this.poll(10000);
                        }
                    });
                } else {
                    bshbController.getBshcClient().unsubscribe(response.parsedResponse.result).subscribe(() => {
                    });
                }
            });
        });
    };

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            // we want to stop polling. So false
            this.pollingTrigger.next(false);
            this.pollingTrigger.complete();
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     */
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!this.bshbController) {
            this.log.warn('Could not handle state change because controller was not initialized yet: ' + id);
            return;
        }
        if (state) {
            if (!state.ack) {
                // The state was changed
                this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                this.bshbController.setState(id, state);
            }
        } else {
            // The state was deleted
            // Currently we do not need this
        }
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<ioBroker.AdapterOptions> | undefined) => new Bshb(options);
} else {
    // otherwise start the instance directly
    (() => new Bshb())();
}