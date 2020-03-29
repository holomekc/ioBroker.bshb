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
export class BshbDeviceHandler extends BshbHandler{

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
                        this.bshb.setState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, stateKey),
                            {val: resultEntry.state[stateKey], ack: true});
                    });
                }

                // fault handling
                if (resultEntry.faults && resultEntry.faults.entries && resultEntry.faults.entries.length > 0) {
                    // set faults
                    this.bshb.setState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'),
                        {val: BshbDeviceHandler.getFaults(resultEntry), ack: true});
                } else {
                    // clear faults
                    this.bshb.setState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'),
                        {val: BshbDeviceHandler.getFaults(undefined), ack: true});
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

        return true;
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
            }, (err) => {
                if (err) {
                    this.bshb.log.info(JSON.stringify(err));
                }
            });
        });
    }

    private checkDeviceServices(): Observable<void> {
        return new Observable(observer => {
            this.getBshcClient().getDevicesServices({timeout: this.long_timeout}).subscribe(response => {
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
        }, (err, obj) => {
            if (err) {
                this.bshb.log.info(JSON.stringify(err));
            } else {
                this.bshb.log.info('No err is set');
            }
            if (obj) {
                this.bshb.log.info(JSON.stringify(obj));
            } else {
                this.bshb.log.info('No obj is set');
            }
        });

        // add fault holder
        this.importSimpleState(id, device, deviceService, 'faults', BshbDeviceHandler.getFaults(deviceService), false);

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

        let name;
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

    private static getId(device: any, deviceService: any, stateKey: string): string {
        let id: string;

        if (device) {
            id = device.id + '.' + deviceService.id;
        } else {
            id = deviceService.id;
        }
        return id + '.' + stateKey;
    }

}