import * as utils from '@iobroker/adapter-core';
import {BshbController} from './bshb-controller';
import {BehaviorSubject} from 'rxjs';
import {delay} from 'rxjs/operators';

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
            mac: string;
            identifier: string;
            name: string;
            systemPassword: string;
            certsPath: string;
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
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.debug('config host: ' + this.config.host);
        this.log.debug('config mac: ' + this.config.mac);
        this.log.debug('config identifier: ' + this.config.identifier);
        this.log.debug('config name: ' + this.config.name);
        this.log.debug('config systemPassword: ' + (this.config.systemPassword != undefined));
        this.log.debug('config certsPath: ' + this.config.certsPath);
        this.log.debug('config pairingDelay: ' + this.config.pairingDelay);

        // Create controller for bosch-smart-home-bridge
        this.bshbController = new BshbController(this);
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
    }

    private init(bshbController: BshbController) {
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
                        } else{
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
    private onUnload(callback: () => void): void {
        try {
            this.pollingTrigger.next(false);
            this.pollingTrigger.complete();
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     */
    private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
        if (obj) {
            // The object was changed
            // this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            // this.log.info(`object ${id} deleted`);
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
            // The state was changed

            if (!state.ack) {
                this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                this.bshbController.setState(id, state);
            }

            // this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            // this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  */
    // private onMessage(obj: ioBroker.Message): void {
    // 	if (typeof obj === "object" && obj.message) {
    // 		if (obj.command === "send") {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info("send command");

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    // 		}
    // 	}
    // }

}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<ioBroker.AdapterOptions> | undefined) => new Bshb(options);
} else {
    // otherwise start the instance directly
    (() => new Bshb())();
}