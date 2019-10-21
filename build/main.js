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
class Bshb extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: 'bshb' }));
        this.pollingTrigger = new rxjs_1.BehaviorSubject(true);
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            // Initialize your adapter here
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
            /*
            For every state in the system there has to be also an object of type state
            Here a simple template for a boolean variable named "testVariable"
            Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
            */
            // await this.setObjectAsync("testVariable", {
            // 	type: "state",
            // 	common: {
            // 		name: "testVariable",
            // 		type: "boolean",
            // 		role: "indicator",
            // 		read: true,
            // 		write: true,
            // 	},
            // 	native: {},
            // });
            // in this template all states changes inside the adapters namespace are subscribed
            /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
            */
            // the variable testVariable is set to true as command (ack=false)
            // await this.setStateAsync("testVariable", true);
            // same thing, but the value is flagged "ack"
            // ack should be always set to true if the value is received from or acknowledged from the target system
            // await this.setStateAsync("testVariable", { val: true, ack: true });
            // same thing, but the state is deleted after 30s (getState will return null afterwards)
            // await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });
            // examples for the checkPassword/checkGroup functions
            // let result = await this.checkPasswordAsync("admin", "iobroker");
            // this.log.info("check user admin pw ioboker: " + result);
            //
            // result = await this.checkGroupAsync("admin", "admin");
            // this.log.info("check group user admin group admin: " + result);
        });
    }
    init(bshbController) {
        // start pairing if needed
        bshbController.pairDeviceIfNeeded(this.config.systemPassword).subscribe(() => {
            // Everything is ok. We check for devices first
            bshbController.detectDevices().subscribe(() => {
                this.subscribeStates('*');
                // subscribe for changes
                bshbController.getBshbClient().subscribe(this.config.mac).subscribe(response => {
                    this.pollingTrigger.subscribe(keepPolling => {
                        if (keepPolling) {
                            bshbController.getBshbClient().longPolling(this.config.mac, response.result).subscribe(information => {
                                information.result.forEach(deviceService => {
                                    this.log.debug(JSON.stringify(deviceService));
                                    bshbController.setStateAck(deviceService);
                                });
                            }, () => {
                                this.pollingTrigger.next(true);
                            }, () => {
                                this.pollingTrigger.next(true);
                            });
                        }
                        else {
                            bshbController.getBshbClient().unsubscribe(this.config.mac, response.result).subscribe(() => {
                            });
                        }
                    });
                });
            });
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
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
        if (obj) {
            // The object was changed
            // this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        }
        else {
            // The object was deleted
            // this.log.info(`object ${id} deleted`);
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
            // The state was changed
            if (!state.ack) {
                this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                this.bshbController.setState(id, state);
            }
            // this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        }
        else {
            // The state was deleted
            // this.log.info(`state ${id} deleted`);
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
