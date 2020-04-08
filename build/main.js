"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils = require("@iobroker/adapter-core");
const bshb_controller_1 = require("./bshb-controller");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const migration_1 = require("./migration");
const utils_1 = require("./utils");
const client_cert_1 = require("./client-cert");
const bosch_smart_home_bridge_1 = require("bosch-smart-home-bridge");
const log_level_1 = require("./log-level");
const fs = require("fs");
class Bshb extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: 'bshb' }));
        this.pollingTrigger = new rxjs_1.BehaviorSubject(true);
        this.pollTimeout = null;
        this.startPollingTimeout = null;
        this.poll = (delay) => {
            delay = delay ? delay : 0;
            this.pollTimeout = setTimeout(() => {
                this.pollTimeout = null;
                this.pollingTrigger.next(true);
            }, delay);
        };
        this.startPolling = (bshbController, delay) => {
            this.log.info('Listen to changes');
            delay = delay ? delay : 0;
            this.startPollingTimeout = setTimeout(() => {
                this.startPollingTimeout = null;
                this.subscribeAndPoll(bshbController);
            }, delay);
        };
        this.subscribeAndPoll = (bshbController) => {
            this.pollingTrigger.next(false);
            this.pollingTrigger.complete();
            this.pollingTrigger = new rxjs_1.BehaviorSubject(true);
            bshbController.getBshcClient().subscribe().subscribe(response => {
                this.pollingTrigger.subscribe(keepPolling => {
                    if (keepPolling) {
                        bshbController.getBshcClient().longPolling(response.parsedResponse.result).subscribe(infoResponse => {
                            if (infoResponse.incomingMessage.statusCode !== 200) {
                                if (infoResponse.incomingMessage.statusCode === 503) {
                                    this.log.warn(`BSHC is starting. Try to reconnect asap. HTTP=${infoResponse.incomingMessage.statusCode}, data=${infoResponse.parsedResponse}`);
                                }
                                else {
                                    this.log.warn(`Something went wrong during long polling. HTTP=${infoResponse.incomingMessage.statusCode}, data=${infoResponse.parsedResponse}`);
                                }
                                // something went wrong we delay polling
                                this.poll(10000);
                            }
                            else {
                                const information = infoResponse.parsedResponse;
                                // handle updates
                                information.result.forEach(resultEntry => {
                                    if (utils_1.Utils.isLevelActive(this.log.level, log_level_1.LogLevel.debug)) {
                                        this.log.debug(JSON.stringify(resultEntry));
                                    }
                                    bshbController.setStateAck(resultEntry);
                                });
                                // poll further data.
                                this.poll();
                            }
                        }, error => {
                            if (error.errorType === bosch_smart_home_bridge_1.BshbErrorType.POLLING) {
                                this.log.warn(`Something went wrong during long polling. Try to reconnect.`);
                                this.startPolling(bshbController, 5000);
                            }
                            else {
                                this.log.warn(`Something went wrong during long polling. Try again later.`);
                                this.poll(10000);
                            }
                        });
                    }
                    else {
                        bshbController.getBshcClient().unsubscribe(response.parsedResponse.result).subscribe(() => {
                        });
                    }
                });
            });
        };
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            // Overwrite configuration
            // make sure that identifier is valid regarding Bosch T&C
            this.log.silly('onReady called. Load configuration');
            this.config.host = this.config.host ? this.config.host.trim() : '';
            const notPrefixedIdentifier = this.config.identifier ? this.config.identifier.trim() : '';
            this.config.identifier = 'ioBroker.bshb_' + notPrefixedIdentifier;
            this.config.systemPassword = this.config.systemPassword ? this.config.systemPassword.trim() : '';
            this.config.certsPath = this.config.certsPath ? this.config.certsPath.trim() : '';
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            this.log.debug('config host: ' + this.config.host);
            this.log.debug('config identifier: ' + this.config.identifier);
            this.log.debug('config systemPassword: ' + (this.config.systemPassword != undefined));
            this.log.debug('config pairingDelay: ' + this.config.pairingDelay);
            if (!notPrefixedIdentifier) {
                throw utils_1.Utils.createError(this.log, 'Identifier not defined but it is a mandatory parameter');
            }
            this.loadCertificates(notPrefixedIdentifier).subscribe(clientCert => {
                // Create controller for bosch-smart-home-bridge
                this.bshbController = new bshb_controller_1.BshbController(this, clientCert.certificate, clientCert.privateKey);
                this.init(this.bshbController);
            }, error => {
                this.log.error('Could not initialize adapter. See more details in error: ' + error);
            });
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
    loadCertificates(notPrefixedIdentifier) {
        return new rxjs_1.Observable(subscriber => {
            this.getForeignObject('system.certificates', (err, obj) => {
                if (err || !obj) {
                    subscriber.error(utils_1.Utils.createError(this.log, 'Could not load certificates. This should not happen. Error: ' + err));
                    subscriber.complete();
                    return;
                }
                let certificateKeys = utils_1.Utils.getCertificateKeys(notPrefixedIdentifier);
                let clientCert = new client_cert_1.ClientCert(obj.native.certificates[certificateKeys.cert], obj.native.certificates[certificateKeys.key]);
                if (clientCert.certificate && clientCert.privateKey) {
                    this.readCertificate(clientCert, subscriber);
                }
                else {
                    this.generateCertificate(clientCert, obj, certificateKeys, subscriber);
                }
            });
        });
    }
    generateCertificate(clientCert, obj, certificateKeys, subscriber) {
        // no certificates found.
        this.log.info('Could not find client certificate. Check for old configuration');
        const migrationResult = this.migration();
        if (migrationResult) {
            clientCert = migrationResult;
        }
        else {
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
    readCertificate(clientCert, subscriber) {
        // found certificates
        this.log.info('Client certificate found in system.certificates');
        this.log.info('Check if certificate is file reference or actual content');
        const actualCert = this.loadFromFile(clientCert.certificate, 'certificate');
        const actualPrivateKey = this.loadFromFile(clientCert.privateKey, 'private key');
        clientCert = new client_cert_1.ClientCert(actualCert, actualPrivateKey);
        subscriber.next(clientCert);
        subscriber.complete();
    }
    loadFromFile(file, type) {
        try {
            if (fs.existsSync(file)) {
                this.log.info(`${type} is a file reference. Read from file`);
                return fs.readFileSync(file, 'utf-8');
            }
            else {
                this.log.info(`${type} seems to be actual content. Use value from state.`);
                return file;
            }
        }
        catch (e) {
            this.log.info(`${type} seems to be actual content or reading from file failed. Use value from state. For more details restart adapter with debug log level.`);
            this.log.debug(`Error during reading file: ${e}`);
            return file;
        }
    }
    storeCertificate(obj, certificateKeys, clientCert) {
        return new rxjs_1.Observable(subscriber => {
            // store information
            obj.native.certificates[certificateKeys.cert] = clientCert.certificate;
            obj.native.certificates[certificateKeys.key] = clientCert.privateKey;
            this.setForeignObject('system.certificates', obj, (err, obj) => {
                if (err || !obj) {
                    subscriber.error(utils_1.Utils.createError(this.log, 'Could not store client certificate in system.certificates due to an error:' + err));
                    subscriber.complete();
                }
                this.log.info('Client certificate stored in system.certificates.');
                subscriber.next();
                subscriber.complete();
            });
        });
    }
    migration() {
        // migration:
        const certsPath = this.config.certsPath;
        if (!certsPath) {
            // We abort if we could nof find the certificate path
            return undefined;
        }
        this.log.info(`Found old configuration in certsPath: ${certsPath}. Try to read information`);
        try {
            const result = new client_cert_1.ClientCert(migration_1.Migration.loadCertificate(this, certsPath), migration_1.Migration.loadPrivateKey(this, certsPath));
            this.log.info(`Load client certificate from old configuration successful. Consider removing them from: ${certsPath}. They are not needed anymore`);
            return result;
        }
        catch (err) {
            // something went wrong we abort. Logging was already done.
            return undefined;
        }
    }
    static generateCertificate() {
        let certificateDefinition = bosch_smart_home_bridge_1.BshbUtils.generateClientCertificate();
        return new client_cert_1.ClientCert(certificateDefinition.cert, certificateDefinition.private);
    }
    init(bshbController) {
        // start pairing if needed
        bshbController.pairDeviceIfNeeded(this.config.systemPassword).pipe(operators_1.catchError((err) => {
            this.log.error('Something went wrong during initialization');
            this.log.error(err);
            return rxjs_1.EMPTY;
        }), operators_1.switchMap(() => {
            // Everything is ok. We check for devices first
            return bshbController.startDetection();
        })).subscribe(() => {
            // register for changes
            this.subscribeStates('*');
            // now we want to subscribe to BSHC for changes
            this.startPolling(bshbController);
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            // we want to stop polling. So false
            this.pollingTrigger.next(false);
            this.pollingTrigger.complete();
            // and we clear timeouts as well
            if (this.pollTimeout) {
                clearTimeout(this.pollTimeout);
                this.pollTimeout = null;
            }
            if (this.startPollingTimeout) {
                clearTimeout(this.startPollingTimeout);
                this.startPollingTimeout = null;
            }
            this.log.info('cleaned everything up...');
            callback();
        }
        catch (e) {
            callback();
        }
    }
    /**
     * Is called if a subscribed state changes
     */
    onStateChange(id, state) {
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
        }
        else {
            // The state was deleted
            // Currently we do not need this
        }
    }
}
exports.Bshb = Bshb;
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new Bshb(options);
}
else {
    // otherwise start the instance directly
    (() => new Bshb())();
}
