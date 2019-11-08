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
class Bshb extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: 'bshb' }));
        this.pollingTrigger = new rxjs_1.BehaviorSubject(true);
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on("message", this.onMessage.bind(this));
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
            this.config.identifier = 'ioBroker.bshb_' + this.config.identifier.trim();
            this.config.systemPassword = this.config.systemPassword.trim();
            this.config.certsPath = this.config.certsPath.trim();
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            this.log.debug('config host: ' + this.config.host);
            this.log.debug('config mac: ' + this.config.mac);
            this.log.debug('config identifier: ' + this.config.identifier);
            this.log.debug('config systemPassword: ' + (this.config.systemPassword != undefined));
            this.log.debug('config certsPath: ' + this.config.certsPath);
            this.log.debug('config pairingDelay: ' + this.config.pairingDelay);
            // Create controller for bosch-smart-home-bridge
            this.bshbController = new bshb_controller_1.BshbController(this);
            this.init(this.bshbController);
        });
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
                    bshbController.getBshbClient().longPolling(this.config.mac, response.result).subscribe(information => {
                        information.result.forEach(deviceService => {
                            if (this.log.level === 'debug') {
                                this.log.debug(JSON.stringify(deviceService));
                            }
                            bshbController.setStateAck(deviceService);
                        });
                    }, () => {
                        // we want to keep polling. So true
                        this.pollingTrigger.next(true);
                    }, () => {
                        // we want to keep polling. So true
                        this.pollingTrigger.next(true);
                    });
                }
                else {
                    // polling was stopped. We unsubscribe
                    bshbController.getBshbClient().unsubscribe(this.config.mac, response.result).subscribe(() => {
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
     * Is called if a subscribed object changes
     */
    onObjectChange(id, obj) {
        // We do not need this at the moment
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
    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     */
    onMessage(obj) {
        // We do not need this at the moment
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
