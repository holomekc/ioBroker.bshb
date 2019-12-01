import * as utils from '@iobroker/adapter-core';
import {BshbController} from './bshb-controller';
import {BehaviorSubject} from 'rxjs';
import {switchMap} from 'rxjs/operators';

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
            systemPassword: string;
            clientCert: string;
            clientPrivateKey: string;
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
        this.log.debug('config clientCert: ' + this.config.clientCert);
        this.log.debug('config clientPrivateKey: ' + (this.config.clientPrivateKey != undefined));
        this.log.debug('config pairingDelay: ' + this.config.pairingDelay);

        // Create controller for bosch-smart-home-bridge
        this.bshbController = new BshbController(this);
        this.init(this.bshbController);
    }

    private init(bshbController: BshbController) {
        // start pairing if needed
        bshbController.pairDeviceIfNeeded(this.config.systemPassword).pipe(switchMap(() => {
            // Everything is ok. We check for devices first
            return bshbController.detectDevices();
        }), switchMap(() => {
            // detect scenarios next
            return bshbController.detectScenarios();
        }), switchMap(() => {
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
                            if (this.log.level === 'debug') {
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
                } else {
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