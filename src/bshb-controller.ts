import {BoschSmartHomeBridge, BoschSmartHomeBridgeBuilder} from 'bosch-smart-home-bridge';
import {Bshb} from './main';
import {BshbLogger} from './bshb-logger';
import {Observable} from 'rxjs';
import {BshbDefinition} from './bshb-definition';
import {switchMap} from "rxjs/operators";
import {LogLevel} from "./log-level";
import {Utils} from "./utils";

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
     * @param clientCert
     *        client certificate
     * @param clientPrivateKey
     *        client private key
     */
    constructor(private bshb: Bshb, clientCert: string, clientPrivateKey: string) {
        try{
            this.boschSmartHomeBridge = BoschSmartHomeBridgeBuilder.builder()
                .withHost(bshb.config.host)
                .withClientCert(clientCert)
                .withClientPrivateKey(clientPrivateKey)
                .withLogger(new BshbLogger(bshb))
                .build();
        }catch (e) {
            throw Utils.createError(bshb.log, e);
        }
    }

    public getBshcClient() {
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
                this.getBshcClient().triggerScenario(match[1]).subscribe(() => {
                    this.bshb.setState(id, {val: false, ack: true});
                });
            }
            return;
        }

        let cachedState = this.cachedStates.get(id);

        if (Utils.isLevelActive(this.bshb.log.level, LogLevel.debug)) {
            this.bshb.log.debug('Found cached state: ' + JSON.stringify(cachedState));
        }

        const data: any = {
            '@type': cachedState.deviceService.state['@type'],
        };
        data[cachedState.stateKey] = state.val;

        if (Utils.isLevelActive(this.bshb.log.level, LogLevel.debug)) {
            this.bshb.log.debug('Data which will be send: ' + JSON.stringify(data));
        }

        this.getBshcClient().putState(cachedState.deviceService.path, data).subscribe(response => {
            if (response) {
                if (Utils.isLevelActive(this.bshb.log.level, LogLevel.debug)) {
                    this.bshb.log.debug(`HTTP response. status=${response.incomingMessage.statusCode},
                     body=${JSON.stringify(response.parsedResponse)}`);
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
     * @param resultEntry object containing @type and values
     */
    public setStateAck(resultEntry: any) {
        if (resultEntry.path) {
            const cachedDeviceService = this.cachedDeviceServices.get(resultEntry.path);

            if (cachedDeviceService) {
                // found cached device
                if (resultEntry.state) {
                    Object.keys(resultEntry.state).forEach(stateKey => {
                        if (stateKey === '@type') {
                            return;
                        }
                        this.bshb.setState(BshbController.getId(cachedDeviceService.device, cachedDeviceService.deviceService, stateKey),
                            {val: resultEntry.state[stateKey], ack: true});
                    });
                }

                // fault handling
                if (resultEntry.faults && resultEntry.faults.entries && resultEntry.faults.entries.length > 0) {
                    // set faults
                    this.bshb.setState(BshbController.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'),
                        {val: this.getFaults(resultEntry), ack: true});
                } else {
                    // clear faults
                    this.bshb.setState(BshbController.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'),
                        {val: this.getFaults(undefined), ack: true});
                }
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
            this.getBshcClient().getScenarios().subscribe(response => {
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
            this.getBshcClient().getRooms().pipe(switchMap(response => {
                const rooms: any[] = response.parsedResponse;

                rooms.forEach(room => {
                    this.cachedRooms.set(room.id, room);
                });

                return this.getBshcClient().getDevices();
            }), switchMap(response => {
                const devices: any[] = response.parsedResponse;

                devices.forEach(device => {
                    // this.cachedDevices.set(device.id, device);

                    const name = this.getDeviceName(device);

                    this.bshb.setObjectNotExists(device.id, {
                        type: 'device',
                        common: {
                            name: name,
                            read: true
                        },
                        native: {device: device},
                    });

                    this.cachedDevices.set(this.bshb.namespace + '.' + device.id, device);

                    const rootDeviceName = 'BSHC';

                    // root device. This should be the bosch smart home controller only. It does not exist as a
                    // separate device so we add it multiple times but due to unique id this should be ok
                    this.bshb.setObjectNotExists(device.rootDeviceId, {
                        type: 'device',
                        common: {
                            name: rootDeviceName,
                            read: true
                        },
                        native: {
                            device: {
                                id: device.rootDeviceId,
                                roomId: device.roomId,
                                name: rootDeviceName
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
            this.getBshcClient().getDevicesServices().subscribe(response => {
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

        const name = this.getDeviceName(device) + '.' + deviceService.id;

        this.bshb.setObjectNotExists(id, {
            type: 'channel',
            common: {
                name: name,
                read: true,
            },
            native: {device: device, deviceService: deviceService},
        });

        // add fault holder
        this.importSimpleState(id, device, deviceService, 'faults', this.getFaults(deviceService), false);

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

    private importSimpleState(idPrefix: string, device: any, deviceService: any, stateKey: string, stateValue: any, write?: boolean): void {
        const id = idPrefix + '.' + stateKey;

        let name = '';
        if (deviceService) {
            name = this.getDeviceName(device) + '.' + deviceService.id + '.' + stateKey
        } else {
            name = this.getDeviceName(device) + '.' + stateKey;
        }

        this.bshb.setObjectNotExists(id, {
            type: 'state',
            common: {
                name: name,
                type: BshbDefinition.determineType(stateValue),
                role: BshbDefinition.determineRole(deviceService && deviceService.state ? deviceService.state['@type'] : null, stateKey),
                read: true,
                write: typeof write === 'undefined' ? true : write,
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
            const room = this.getRoomById(roomId);

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

    private getDeviceName(device: any): string {
        let name = device.name;
        if (device.deviceModel === 'ROOM_CLIMATE_CONTROL') {
            const room = this.getRoomById(device.roomId);
            name = 'RCC.' + room.name;
        } else if (device.deviceModel === 'INTRUSION_DETECTION_SYSTEM') {
            name = 'IDS';
        } else if (device.deviceModel === 'SMOKE_DETECTION_SYSTEM') {
            name = 'SDS';
        } else if (device.deviceModel === 'VENTILATION_SERVICE') {
            name = 'VS';
        }
        return name;
    }

    private getRoomById(roomId: string) {
        return this.cachedRooms.get(roomId);
    }

    private getFaults(object: any) {
        if (object && object.faults && object.faults.entries && object.faults.entries.length > 0) {
            return object.faults.entries;
        } else {
            return [];
        }
    }
}