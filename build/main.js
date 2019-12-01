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
class Bshb extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: 'bshb' }));
        this.pollingTrigger = new rxjs_1.BehaviorSubject(true);
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
            this.config.host = this.config.host.trim();
            this.config.mac = this.config.mac.trim();
            const notPrefixedIdentifier = this.config.identifier.trim();
            this.config.identifier = 'ioBroker.bshb_' + notPrefixedIdentifier;
            this.config.systemPassword = this.config.systemPassword.trim();
            this.config.certsPath = this.config.certsPath.trim();
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            this.log.debug('config host: ' + this.config.host);
            this.log.debug('config mac: ' + this.config.mac);
            this.log.debug('config identifier: ' + this.config.identifier);
            this.log.debug('config systemPassword: ' + (this.config.systemPassword != undefined));
            this.log.debug('config pairingDelay: ' + this.config.pairingDelay);
            if (!this.config.identifier) {
                utils_1.Utils.throwError(this.log, 'Identifier not defined but it is a mandatory parameter');
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
    loadCertificates(identifier) {
        return new rxjs_1.Observable(subscriber => {
            this.getForeignObject('system.certificates', (err, obj) => {
                if (err || !obj) {
                    subscriber.error(utils_1.Utils.throwError(this.log, 'Could not load certificates. This should not happen. Error: ' + err));
                    subscriber.complete();
                    return;
                }
                let certificateKeys = utils_1.Utils.getCertificateKeys(identifier);
                let clientCert = new client_cert_1.ClientCert(obj.native.certificates[certificateKeys.cert], obj.native.certificates[certificateKeys.key]);
                if (clientCert.certificate && clientCert.privateKey) {
                    // found certificates
                    this.log.info('Client certificate found in system.certificates');
                    subscriber.next(clientCert);
                    subscriber.complete();
                }
                else {
                    // no certificates found.
                    this.log.info('Could not find client certificate. Check for old configuration');
                    const migrationResult = this.migration();
                    if (migrationResult) {
                        clientCert = migrationResult;
                    }
                    else {
                        this.log.info('No client certificate found in old configuration or it failed. Generate new certificate');
                        clientCert = Bshb.generateCertificate(identifier);
                    }
                    // store information
                    this.storeCertificate(obj, certificateKeys, clientCert).subscribe(value => {
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
    storeCertificate(obj, certificateKeys, clientCert) {
        return new rxjs_1.Observable(subscriber => {
            // store information
            obj.native.certificates[certificateKeys.cert] = clientCert.certificate;
            obj.native.certificates[certificateKeys.key] = clientCert.privateKey;
            this.setForeignObject('system.certificates', obj, (err, obj) => {
                if (err || !obj) {
                    subscriber.error(utils_1.Utils.throwError(this.log, 'Could not store client certificate in system.certificates due to an error:' + err));
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
    static generateCertificate(identifier) {
        let certificateDefinition = bosch_smart_home_bridge_1.BshbUtils.generateClientCertificate(identifier);
        return new client_cert_1.ClientCert(certificateDefinition.clientcert, certificateDefinition.clientprivate);
    }
    init(bshbController) {
        // start pairing if needed
        bshbController.pairDeviceIfNeeded(this.config.systemPassword).pipe(operators_1.switchMap(() => {
            // Everything is ok. We check for devices first
            return bshbController.detectDevices();
        }), operators_1.switchMap(() => {
            // detect scenarios next
            return bshbController.detectScenarios();
        }), operators_1.switchMap(() => {
            // register for changes
            this.subscribeStates('*');
            // now we want to subscribe to BSHC for changes
            return bshbController.getBshbClient().subscribe(this.config.mac);
        })).subscribe(response => {
            // subscribe to pollingTrigger which will trigger when the long polling connection completed or results in an error.
            this.pollingTrigger.subscribe(keepPolling => {
                if (keepPolling) {
                    bshbController.getBshbClient().longPolling(this.config.mac, response.parsedResponse.result).subscribe(infoResponse => {
                        const information = infoResponse.parsedResponse;
                        information.result.forEach(deviceService => {
                            if (utils_1.Utils.isLevelActive(this.log.level, log_level_1.LogLevel.debug)) {
                                this.log.debug(JSON.stringify(deviceService));
                            }
                            bshbController.setStateAck(deviceService);
                        });
                    }, error => {
                        this.log.warn(error);
                        // we want to keep polling but complete will do that for us.
                    }, () => {
                        // we want to keep polling. So true
                        this.pollingTrigger.next(true);
                    });
                }
                else {
                    // polling was stopped. We unsubscribe
                    bshbController.getBshbClient().unsubscribe(this.config.mac, response.parsedResponse.result)
                        .subscribe(() => {
                    });
                }
            });
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
