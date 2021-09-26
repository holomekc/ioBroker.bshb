"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bshb = void 0;
const utils = __importStar(require("@iobroker/adapter-core"));
const bshb_controller_1 = require("./bshb-controller");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const migration_1 = require("./migration");
const utils_1 = require("./utils");
const client_cert_1 = require("./client-cert");
const bosch_smart_home_bridge_1 = require("bosch-smart-home-bridge");
const log_level_1 = require("./log-level");
const fs = __importStar(require("fs"));
const { v4: uuidv4 } = require('uuid'); // Used commonjs because es did not work for some reason...
class Bshb extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: 'bshb',
        });
        this.pollingTrigger = new rxjs_1.BehaviorSubject(true);
        this.pollTimeout = null;
        this.startPollingTimeout = null;
        this.alive = new rxjs_1.Subject();
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
                        bshbController.getBshcClient().longPolling(response.parsedResponse.result, 30000, 2000).subscribe({
                            next: infoResponse => {
                                if (infoResponse.incomingMessage.statusCode !== 200) {
                                    this.updateInfoConnectionState(false);
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
                                    this.updateInfoConnectionState(true);
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
                            }, error: error => {
                                this.updateInfoConnectionState(false);
                                if (error.errorType === bosch_smart_home_bridge_1.BshbErrorType.POLLING) {
                                    const bshbError = error;
                                    if (bshbError.cause && bshbError.cause instanceof bosch_smart_home_bridge_1.BshbError) {
                                        if (bshbError.errorType === bosch_smart_home_bridge_1.BshbErrorType.TIMEOUT) {
                                            this.log.info('LongPolling connection timed-out before BSHC closed connection.  Try to reconnect.');
                                        }
                                        else if (bshbError.errorType === bosch_smart_home_bridge_1.BshbErrorType.ABORT) {
                                            this.log.warn('Connection to BSHC closed by adapter. Try to reconnect.');
                                        }
                                        else {
                                            this.log.warn('Something went wrong during long polling. Try to reconnect.');
                                        }
                                    }
                                    else {
                                        this.log.warn('Something went wrong during long polling. Try to reconnect.');
                                    }
                                    this.startPolling(bshbController, 5000);
                                }
                                else {
                                    this.log.warn('Something went wrong during long polling. Try again later.');
                                    this.poll(10000);
                                }
                            }
                        });
                    }
                    else {
                        bshbController.getBshcClient().unsubscribe(response.parsedResponse.result).subscribe(() => {
                            this.updateInfoConnectionState(false);
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
    async onReady() {
        // Overwrite configuration
        // make sure that identifier is valid regarding Bosch T&C
        this.log.silly('onReady called. Load configuration');
        if (!this.config.identifier) {
            this.config.identifier = uuidv4();
        }
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
            throw utils_1.Utils.createError(this.log, 'Identifier not defined but it is a mandatory parameter.');
        }
        this.loadCertificates(notPrefixedIdentifier).subscribe({
            next: clientCert => {
                this.handleAdapterInformation();
                // Create controller for bosch-smart-home-bridge
                this.bshbController = new bshb_controller_1.BshbController(this, clientCert.certificate, clientCert.privateKey);
                this.init(this.bshbController);
            }, error: error => {
                this.log.error('Could not initialize adapter. See more details in error: ' + error);
            }
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
        this.storeCertificate(obj, certificateKeys, clientCert).subscribe({
            next: () => {
                subscriber.next(clientCert);
                subscriber.complete();
            },
            error: error => {
                subscriber.error(error);
                subscriber.complete();
            }
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
        bshbController.pairDeviceIfNeeded(this.config.systemPassword).pipe((0, operators_1.catchError)((err) => {
            this.log.error('Something went wrong during initialization');
            this.log.error(err);
            return rxjs_1.EMPTY;
        }), 
        // Everything is ok. We check for devices first
        (0, operators_1.switchMap)(() => bshbController.startDetection()), (0, operators_1.takeUntil)(this.alive))
            .subscribe(() => {
            this.log.info('Subscribe to ioBroker states');
            // register for changes
            this.subscribeStates('*');
            // now we want to subscribe to BSHC for changes
            this.startPolling(bshbController);
        });
    }
    handleAdapterInformation() {
        this.setObjectNotExists('info', {
            type: 'channel',
            common: {
                name: 'Information'
            },
            native: {},
        }, (err, obj) => {
            if (obj) {
                // channel created we create all other stuff now.
                this.setObjectNotExists('info.connection', {
                    type: 'state',
                    common: {
                        name: 'If connected to BSHC',
                        type: 'boolean',
                        role: 'indicator.connected',
                        read: true,
                        write: false,
                        def: false
                    },
                    native: {},
                }, (err, obj) => {
                    if (obj) {
                        // we start with disconnected
                        this.setState('info.connection', { val: false, ack: true });
                    }
                });
            }
        });
    }
    updateInfoConnectionState(connected) {
        this.getState('info.connection', (err, state) => {
            if (state) {
                if (state.val === connected) {
                    return;
                }
            }
            this.setState('info.connection', { val: connected, ack: true });
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            this.alive.next(false);
            this.alive.complete();
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
//# sourceMappingURL=main.js.map