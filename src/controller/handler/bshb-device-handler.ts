import {BshbHandler} from "./bshb-handler";
import {Observable} from "rxjs";
import {switchMap} from "rxjs/operators";
import {BshbDefinition} from "../../bshb-definition";
import {Utils} from "../../utils";
import {LogLevel} from "../../log-level";

/**
 * This handler is used to detect devices of bshc
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
export class BshbDeviceHandler extends BshbHandler {

    private cachedRooms = new Map<string, any>();
    private cachedDevices = new Map<string, any>();
    private cachedStates = new Map<string, any>();
    private cachedDeviceServices = new Map<string, any>();

    public handleDetection(): Observable<void> {
        return this.detectDevices();
    }

    public handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry.path) {
            const cachedDeviceService = this.cachedDeviceServices.get(resultEntry.path);

            if (cachedDeviceService) {
                // found cached device
                if (resultEntry.state) {
                    Object.keys(resultEntry.state).forEach(stateKey => {
                        if (stateKey === '@type') {
                            return;
                        }
                        const id = BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, stateKey);

                        this.bshb.getObject(id, (error, object) => {
                            if (object) {
                                this.bshb.setState(id, {
                                    val: this.mapValueToStorage(resultEntry.state[stateKey]),
                                    ack: true
                                });
                            } else {
                                // dynamically create objects in case it was missing. This might occur when values are not always set.
                                // setState is also handled in state creation, so no additional setState necessary.
                                this.importSimpleState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService), cachedDeviceService.device, cachedDeviceService.deviceService, stateKey, resultEntry.state[stateKey]);
                            }

                            this.handleBshcUpdateSpecialCases(id, cachedDeviceService.device, cachedDeviceService.deviceService, resultEntry.state[stateKey]);
                        });
                    });
                }

                // fault handling
                if (resultEntry.faults && resultEntry.faults.entries && resultEntry.faults.entries.length > 0) {
                    // set faults
                    this.bshb.setState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'),
                        {val: this.mapValueToStorage(BshbDeviceHandler.getFaults(resultEntry)), ack: true});
                } else {
                    // clear faults
                    this.bshb.setState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'),
                        {val: this.mapValueToStorage(BshbDeviceHandler.getFaults(undefined)), ack: true});
                }
            }

            return true;
        }
        return false;
    }

    public sendUpdateToBshc(id: string, state: ioBroker.State): boolean {
        let cachedState = this.cachedStates.get(id);

        if (Utils.isLevelActive(this.bshb.log.level, LogLevel.debug)) {
            this.bshb.log.debug('Found cached state: ' + JSON.stringify(cachedState));
        }

        if (cachedState && cachedState.deviceService && cachedState.deviceService.state && cachedState.deviceService.state['@type']) {
            const data: any = {
                '@type': cachedState.deviceService.state['@type'],
            };

            this.mapValueFromStorage(id, state.val).subscribe(value => {
                data[cachedState.stateKey] = value;

                if (Utils.isLevelActive(this.bshb.log.level, LogLevel.debug)) {
                    this.bshb.log.debug('Data which will be send: ' + JSON.stringify(data));
                }

                this.getBshcClient().putState(cachedState.deviceService.path, data).subscribe({
                    next: response => {
                        if (response) {
                            if (Utils.isLevelActive(this.bshb.log.level, LogLevel.debug)) {
                                this.bshb.log.debug(`HTTP response. status=${response.incomingMessage.statusCode},
                     body=${JSON.stringify(response.parsedResponse)}`);
                            }
                        } else {
                            this.bshb.log.debug('no response');
                        }
                    }, error: error => {
                        this.bshb.log.error(error);
                    }
                });
            });

            return true;
        }
        return false;
    }

    /**
     * detect devices will search for all devices and device states and load them to iobroker.
     */
    private detectDevices(): Observable<void> {
        this.bshb.log.info('Start detecting devices...');

        return new Observable(subscriber => {
            this.getBshcClient().getRooms({timeout: this.long_timeout}).pipe(switchMap(response => {
                const rooms: any[] = response.parsedResponse;

                rooms.forEach(room => {
                    this.cachedRooms.set(room.id, room);
                });

                return this.getBshcClient().getDevices({timeout: this.long_timeout});
            }), switchMap(response => {
                const devices: any[] = response.parsedResponse;

                devices.forEach(device => {
                    // this.cachedDevices.set(device.id, device);

                    const name = this.getDeviceName(device);

                    this.bshb.setObjectNotExists(device.id, {
                        type: 'device',
                        common: {
                            name: name
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
                            name: rootDeviceName
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

            })).subscribe({
                next: () => {
                    this.bshb.log.info('Detecting devices finished');

                    subscriber.next();
                    subscriber.complete();
                }, error: (err) => {
                    subscriber.error(err);
                }
            });
        });
    }

    private checkDeviceServices(): Observable<void> {
        return new Observable(observer => {
            this.getBshcClient().getDevicesServices({timeout: this.long_timeout}).subscribe({
                next: response => {
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
                }, error: err => {
                    observer.error(err);
                }
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
                name: name
            },
            native: {device: device, deviceService: deviceService},
        }, (err, obj) => {
            if (obj) {
                // a new object was created we add room and function
                this.addRoom(device.id, deviceService.id, undefined as unknown as string, device.roomId);
                this.addFunction(device.id, deviceService.id, undefined as unknown as string);
            }
        });

        // add fault holder
        this.importSimpleState(id, device, deviceService, 'faults', BshbDeviceHandler.getFaults(deviceService), false);

        this.cachedDeviceServices.set(deviceService.path, {device: device, deviceService: deviceService});

        // add states
        this.importStates(id, device, deviceService);
    }

    private importStates(idPrefix: string, device: any, deviceService: any) {
        // device service has a state

        // Only in case we have states
        if (deviceService.state) {
            Object.keys(deviceService.state).forEach(stateKey => {
                if (stateKey === '@type') {
                    return;
                }
                this.importSimpleState(idPrefix, device, deviceService, stateKey, deviceService.state[stateKey]);
            });
        }
    }

    private importSimpleState(idPrefix: string, device: any, deviceService: any, stateKey: string, stateValue: any, write?: boolean): void {
        const id = idPrefix + '.' + stateKey;

        let name;
        if (deviceService) {
            name = this.getDeviceName(device) + '.' + deviceService.id + '.' + stateKey
        } else {
            name = this.getDeviceName(device) + '.' + stateKey;
        }

        const deviceType = deviceService && deviceService.state ? deviceService.state['@type'] : null;

        const role = BshbDefinition.determineRole(deviceType, stateKey, stateValue);
        const unit = BshbDefinition.determineUnit(deviceType, stateKey);
        const states = BshbDefinition.determineStates(deviceType, stateKey)

        this.bshb.setObjectNotExists(id, {
            type: 'state',
            common: {
                name: name,
                type: BshbDefinition.determineType(stateValue),
                role: role,
                read: true,
                write: typeof write === 'undefined' ? BshbDefinition.determineWrite(deviceType, stateKey) : write,
                unit: unit,
                states: states
            },
            native: {device: device, deviceService: deviceService, state: stateKey},
        }, (error, obj) => {
            if (obj) {
                this.cachedStates.set(this.bshb.namespace + '.' + id, {
                    device: device,
                    deviceService: deviceService,
                    id: id,
                    stateKey: stateKey
                });

                this.bshb.getState(id, (err, state) => {

                    if (state) {
                        this.mapValueFromStorage(id, state).subscribe(value => {
                            if (value !== stateValue) {
                                // only set again if a change is detected.
                                this.bshb.setState(id, {val: this.mapValueToStorage(stateValue), ack: true});
                            }
                        });
                    } else {
                        // no previous state so we set it
                        this.bshb.setState(id, {val: this.mapValueToStorage(stateValue), ack: true});
                    }
                });
            }
        });
    }

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
        } else if (device.deviceModel === 'PRESENCE_SIMULATION_SERVICE') {
            name = 'PSS';
        }
        return name;
    }

    private getRoomById(roomId: string) {
        return this.cachedRooms.get(roomId);
    }

    private static getFaults(object: any) {
        if (object && object.faults && object.faults.entries && object.faults.entries.length > 0) {
            return object.faults.entries;
        } else {
            return [];
        }
    }


    private static getId(device: any, deviceService: any, stateKey?: string): string {
        let id: string;

        if (device) {
            id = device.id + '.' + deviceService.id;
        } else {
            id = deviceService.id;
        }
        if (stateKey) {
            return id + '.' + stateKey;
        } else {
            return id;
        }
    }

    // This are very special cases where values are not expected/visible/temporary/etc.
    private handleBshcUpdateSpecialCases(id: string, device: any, deviceService: any, value: any) {
        if (id.includes('intrusionDetectionSystem.IntrusionDetectionControl.value')) {
            if (value === 'SYSTEM_DISARMED') {
                this.bshb.setState('intrusionDetectionSystem.IntrusionDetectionControl.remainingTimeUntilArmed', {
                    val: -1,
                    ack: true
                });
            } else if(value === 'SYSTEM_ARMED') {
                this.bshb.setState('intrusionDetectionSystem.IntrusionDetectionControl.remainingTimeUntilArmed', {
                    val: 0,
                    ack: true
                });
            }
        }
    }
}