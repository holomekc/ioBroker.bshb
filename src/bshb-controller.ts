import {BoschSmartHomeBridge, BoschSmartHomeBridgeBuilder} from 'bosch-smart-home-bridge';
import {Bshb} from './main';
import {BshbLogger} from './bshb-logger';
import {Observable} from 'rxjs';
import {BshbDefinition} from './bshb-definition';
import {switchMap} from "rxjs/operators";

/**
 * This controller encapsulates bosch-smart-home-bridge and provides it to iobroker.bshb
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
export class BshbController {

    private cachedRooms = new Map<string, any>();
    private cachedDevices = new Map<string, any>();
    private cachedStates = new Map<string, any>();
    private cachedDeviceServices = new Map<string, any>();
    private boschSmartHomeBridge: BoschSmartHomeBridge;
    private clientName = 'ioBroker.bshb';

    /**
     * Create a new instance of {@link BshbController}
     *
     * @param bshb
     *        instance of {@link Bshb}
     */
    constructor(private bshb: Bshb) {
        this.boschSmartHomeBridge = BoschSmartHomeBridgeBuilder.builder()
            .withHost(bshb.config.host)
            .withClientCert(bshb.config.clientCert)
            .withClientPrivateKey(bshb.config.clientPrivateKey)
            .withLogger(new BshbLogger(bshb))
            .build();
    }

    public getBshbClient() {
        return this.boschSmartHomeBridge.getBshcClient();
    }

    /**
     * Pair devices if needed
     *
     * @param systemPassword
     *        system password of BSHC
     */
    public pairDeviceIfNeeded(systemPassword: string) {

        let pairingDelay = 5000;
        if (this.bshb.config.pairingDelay && this.bshb.config.pairingDelay > 5000) {
            pairingDelay = this.bshb.config.pairingDelay;
        }

        return this.boschSmartHomeBridge.pairIfNeeded(this.clientName, this.bshb.config.identifier,
            systemPassword, pairingDelay, 100);
    }

    private scenarioRegex = /bshb\.\d+\.scenarios\.(.*)/;

    /**
     * iobroker state changed. Change it via bosch-smart-home-bridge
     *
     * @param id
     *        identifier of state
     * @param state
     *        new state value
     */
    public setState(id: string, state: ioBroker.State) {

        const match = this.scenarioRegex.exec(id);

        if (match) {
            this.bshb.log.debug(`Found scenario trigger with id=${match[1]} and value=${state.val}`);
            if (state.val) {
                this.boschSmartHomeBridge.getBshcClient().triggerScenario(match[1]).subscribe(() => {
                    this.bshb.setState(id, {val: false, ack: true});
                });
            }
            return;
        }

        let cachedState = this.cachedStates.get(id);

        if (this.bshb.log.level === 'debug') {
            this.bshb.log.debug('Found cached state: ' + JSON.stringify(cachedState));
        }

        const data: any = {
            '@type': cachedState.deviceService.state['@type'],
        };
        data[cachedState.stateKey] = state.val;

        if (this.bshb.log.level === 'debug') {
            this.bshb.log.debug('Data which will be send: ' + JSON.stringify(data));
        }

        this.boschSmartHomeBridge.getBshcClient().putState(cachedState.deviceService.path, data).subscribe(response => {
            if (response) {
                if (this.bshb.log.level === 'debug') {
                    this.bshb.log.debug(JSON.stringify(response));
                }
            } else {
                this.bshb.log.debug('no response');
            }
        }, error => {
            this.bshb.log.error(error);
        });
    }

    /**
     * Set a state with ack. All values of deviceService - state type are set
     *
     * @param deviceService object containing @type and values
     */
    public setStateAck(deviceService: any) {
        if (deviceService.path) {
            const cachedDeviceService = this.cachedDeviceServices.get(deviceService.path);

            if (cachedDeviceService) {
                Object.keys(deviceService.state).forEach(stateKey => {
                    if (stateKey === '@type') {
                        return;
                    }
                    this.bshb.setState(BshbController.getId(cachedDeviceService.device, cachedDeviceService.deviceService, stateKey),
                        {val: deviceService.state[stateKey], ack: true});
                });
            }
        }
    }

    private static getId(device: any, deviceService: any, stateKey: string): string {
        let id: string;

        if (device) {
            id = device.id + '.' + deviceService.id;
        } else {
            id = deviceService.id;
        }
        return id + '.' + stateKey;
    }

    public detectScenarios(): Observable<void> {
        return new Observable<void>(subscriber => {
            this.boschSmartHomeBridge.getBshcClient().getScenarios().subscribe(response => {
                const scenarios = response.parsedResponse;

                this.bshb.setObjectNotExists('scenarios', {
                    type: 'group',
                    common: {
                        name: 'scenarios',
                        read: true
                    },
                    native: {
                        id: 'scenarios'
                    },
                });


                scenarios.forEach(scenario => {
                    // hmm do we want to see more?
                    const id = 'scenarios.' + scenario.id;
                    this.bshb.setObjectNotExists(id, {
                        type: 'state',
                        common: {
                            name: scenario.name,
                            type: 'boolean',
                            role: 'button',
                            write: true,
                            read: false
                        },
                        native: {
                            id: scenario.id,
                            name: scenario.name
                        },
                    });

                    this.bshb.setState(id, {val: false, ack: true});
                });

                subscriber.next();
                subscriber.complete();
            });
        });
    }

    /**
     * detect devices will search for all devices and device states and load them to iobroker.
     */
    public detectDevices(): Observable<void> {
        this.bshb.log.info('Start detecting devices. This may take a while.');

        return new Observable(subscriber => {
            this.boschSmartHomeBridge.getBshcClient().getRooms().pipe(switchMap(response => {
                const rooms: any[] = response.parsedResponse;

                rooms.forEach(room => {
                    this.cachedRooms.set(room.id, room);
                });

                return this.boschSmartHomeBridge.getBshcClient().getDevices();
            }), switchMap(response => {
                const devices: any[] = response.parsedResponse;

                devices.forEach(device => {
                    // this.cachedDevices.set(device.id, device);

                    this.bshb.setObjectNotExists(device.id, {
                        type: 'device',
                        common: {
                            name: device.id,
                            read: true
                        },
                        native: {device: device},
                    });

                    this.cachedDevices.set(this.bshb.namespace + '.' + device.id, device);



                    // root device. This should be the bosch smart home controller only. It does not exist as a
                    // separate device so we add it multiple times but due to unique id this should be ok
                    this.bshb.setObjectNotExists(device.rootDeviceId, {
                        type: 'device',
                        common: {
                            name: device.rootDeviceId,
                            read: true
                        },
                        native: {
                            device: {
                                id: device.rootDeviceId,
                                roomId: device.roomId
                            }
                        },
                    });

                    this.cachedDevices.set(this.bshb.namespace + '.' + device.rootDeviceId, {
                        device: {
                            id: device.rootDeviceId
                        }
                    });
                });

                return this.checkDeviceServices();

            })).subscribe(() => {
                this.bshb.log.info('Detecting devices finished');

                subscriber.next();
                subscriber.complete();
            });
        });
    }

    private checkDeviceServices(): Observable<void> {
        return new Observable(observer => {
            this.boschSmartHomeBridge.getBshcClient().getDevicesServices().subscribe(response => {
                const deviceServices: any[] = response.parsedResponse;

                deviceServices.forEach(deviceService => {

                    this.bshb.getObject(deviceService.deviceId, (err, ioBrokerDevice) => {
                        if (err) {
                            this.bshb.log.error('Could not find device. This should not happen: deviceId=' + deviceService.deviceId + ', error=' + err);
                            return;
                        } else if (!ioBrokerDevice) {
                            this.bshb.log.error('Found device but value is undefined. This should not happen: deviceId=' + deviceService.deviceId);
                            return;
                        }
                        this.importChannels(ioBrokerDevice.native.device, deviceService);
                    });
                });
                observer.next();
                observer.complete();
            });
        });
    }

    private importChannels(device: any, deviceService: any) {
        let id: string;

        if (device) {
            id = device.id + '.' + deviceService.id;
        } else {
            id = deviceService.id;
        }

        const name = deviceService.id;

        this.bshb.setObjectNotExists(id, {
            type: 'channel',
            common: {
                name: name,
                read: true,
            },
            native: {device: device, deviceService: deviceService},
        });

        this.addRoom(device.id, deviceService.id, undefined as unknown as string, device.roomId);

        this.addFunction(device.id, deviceService.id, undefined as unknown as string);

        if (deviceService.state) {
            this.importStates(id, device, deviceService);
        }
    }

    private importStates(idPrefix: string, device: any, deviceService: any) {
        // device service has a state

        Object.keys(deviceService.state).forEach(stateKey => {
            if (stateKey === '@type') {
                return;
            }
            this.importSimpleState(idPrefix, device, deviceService, stateKey, deviceService.state[stateKey]);
        });

        this.cachedDeviceServices.set(deviceService.path, {device: device, deviceService: deviceService});
    }

    private importSimpleState(idPrefix: string, device: any, deviceService: any, stateKey: string, stateValue: any): void {
        const id = idPrefix + '.' + stateKey;

        this.bshb.setObjectNotExists(id, {
            type: 'state',
            common: {
                name: stateKey,
                type: BshbDefinition.determineType(stateValue),
                role: BshbDefinition.determineRole(deviceService.state ? deviceService.state['@type'] : null, stateKey),
                read: true,
                write: true,
            },
            native: {device: device, deviceService: deviceService, state: stateKey},
        });

        this.cachedStates.set(this.bshb.namespace + '.' + id, {
            device: device,
            deviceService: deviceService,
            id: id,
            stateKey: stateKey
        });

        this.bshb.getState(id, (err, state) => {

            if (state) {
                if (state.val === stateValue) {
                    return;
                }
            }

            this.bshb.setState(id, {val: stateValue, ack: true});
        });

        // We do not need to set it for every state. Set it for channel is enough
        // this.addRoom(device.id, deviceService.id, id, device.roomId);
    }

    private chain = Promise.resolve();

    private addRoom(deviceId: string, deviceServiceId: string, itemId: string, roomId: string) {
        if (roomId) {
            const room = this.cachedRooms.get(roomId);

            if (room) {
                let name = room.name;

                if (name) {
                    name = name.trim().toLowerCase().replace(/ /g, '_');

                    if (name && name.length > 0) {
                        // we need to make sure that the value exists to prevent crashing ioBroker
                        if (itemId) {
                            this.chain = this.chain.then(() => this.bshb.addStateToEnumAsync('rooms', name, deviceId, deviceServiceId, itemId));
                        } else {
                            this.chain = this.chain.then(() => this.bshb.addChannelToEnumAsync('rooms', name, deviceId, deviceServiceId));
                        }
                    }
                }
            }
        }
    }

    private addFunction(deviceId: string, deviceServiceId: string, itemId: string) {
        let name = BshbDefinition.determineFunction(deviceServiceId);

        if (name) {
            name = name.trim().toLowerCase().replace(/ /g, '_');

            if (name && name.length > 0) {
                // we need to make sure that the value exists to prevent crashing ioBroker
                if (itemId) {
                    this.chain = this.chain.then(() => this.bshb.addStateToEnumAsync('functions', name, deviceId, deviceServiceId, itemId));
                } else {
                    this.chain = this.chain.then(() => this.bshb.addChannelToEnumAsync('functions', name, deviceId, deviceServiceId));
                }
            }
        }
    }
}