import {BshbHandler} from './bshb-handler';
import {Observable, from, concat, of, mergeMap, filter} from 'rxjs';
import {catchError, switchMap, tap} from 'rxjs/operators';
import {BshbDefinition} from '../../bshb-definition';
import {Utils} from '../../utils';
import {LogLevel} from '../../log-level';

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
        const cache = this.restoreCache();
        const devices = this.detectDevices().pipe(
            catchError(err => {
                // skip errors here
                this.bshb.log.warn('Failure during detection in BshbDeviceHandler. Continue with cached data. This only works if the adapter has been started successfully at least once. New devices may not be recognized. ' + err);
                return of(undefined);
            })
        );

        return concat(cache, devices);
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

                        from(this.bshb.getObjectAsync(id)).pipe(
                            switchMap(obj => {
                                if (obj) {
                                    this.bshb.setState(id, {
                                        val: this.mapValueToStorage(resultEntry.state[stateKey]),
                                        ack: true
                                    });
                                    return of(undefined);
                                } else {
                                    // dynamically create objects in case it was missing. This might occur when values are not always set.
                                    // setState is also handled in state creation, so no additional setState necessary.
                                    return this.importSimpleState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService), cachedDeviceService.device, cachedDeviceService.deviceService, stateKey, resultEntry.state[stateKey]);
                                }
                            }),
                            tap(() => {
                                this.handleBshcUpdateSpecialCases(id, cachedDeviceService.device, cachedDeviceService.deviceService, resultEntry.state[stateKey]);
                            })
                        ).subscribe();
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
            this.bshb.log.debug(`Send update to BSHC for id: ${id}. Cached state: ${JSON.stringify(cachedState)}`);
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


    private restoreCache(): Observable<void> {
        let start = of('').pipe(tap(() => this.bshb.log.info('Restoring cache started...')));
        const preparation = start.pipe(
            switchMap(() => from(this.bshb.setObjectNotExistsAsync('info.cache', {
                type: 'folder',
                common: {
                    name: 'cache'
                },
                native: {}
            }))),
            switchMap(() => this.bshb.setObjectNotExistsAsync('info.cache.rooms', {
                type: 'state',
                common: {
                    name: 'rooms',
                    type: 'object',
                    role: 'state',
                    read: true,
                    write: false,
                },
                native: {}
            })));

        const rooms = preparation.pipe(
            // Restore rooms cache
            tap(() => this.bshb.log.info('Restoring cache: rooms')),
            switchMap(() => from(this.bshb.getStateAsync('info.cache.rooms'))),
            filter(this.isDefined),
            switchMap(roomState => this.mapValueFromStorage('info.cache.rooms', roomState.val)),
            tap(roomState => {
                for (const [ key, value ] of Object.entries(roomState)) {
                    this.bshb.log.debug('Restore cache room: ' + key);
                    this.cachedRooms.set(key, value);
                }
            })
        );

        const devices = rooms.pipe(
            tap(() => this.bshb.log.info('Restoring cache: devices, device service and states')),
            // Restore devices, services and states
            // First get all objects and create stream
            switchMap(() => from(this.bshb.getDevicesAsync())),
            switchMap(result => from(result)),
            filter(obj => obj.native.device && obj.native.device.id),
            // Restore device
            tap(obj => {
                this.bshb.log.debug('Restore cache device: ' + obj.native.device.id);
                this.cachedDevices.set(this.bshb.namespace + '.' + obj.native.device.id, obj.native.device)
            })
        );

        const deviceServices = devices.pipe(
            // We use device.id because it is the ioBroker id but Object does not provide id without namespace.
            mergeMap(obj => from(this.bshb.getChannelsOfAsync(obj.native.device.id))),
            switchMap(result => from(result)),
            filter(obj =>
                obj.native.device && obj.native.device.id &&
                obj.native.deviceService && obj.native.deviceService.id && obj.native.deviceService.path),
            // Restore device service
            tap(channelObj => {
                const id = BshbDeviceHandler.getId(channelObj.native.device, channelObj.native.deviceService);
                this.bshb.log.silly('Restore cache device service: ' + id);
                this.cachedDeviceServices.set(channelObj.native.deviceService.path, {
                    device: channelObj.native.device,
                    deviceService: channelObj.native.deviceService
                })
            })
        );

        const states = deviceServices.pipe(
            mergeMap(obj => from(this.bshb.getStatesOfAsync(obj.native.device.id, obj.native.deviceService.id))),
            switchMap(result => from(result)),
            filter(obj => obj.native.device && obj.native.device.id &&
                obj.native.deviceService && obj.native.deviceService.id &&
                obj.native.state),
            tap(stateObj => {
                const id = BshbDeviceHandler.getId(stateObj.native.device, stateObj.native.deviceService, stateObj.native.state);
                this.bshb.log.silly('Restore cache state: ' + id);
                this.cachedStates.set(this.bshb.namespace + '.' + id, {
                    device: stateObj.native.device,
                    deviceService: stateObj.native.deviceService,
                    id: id,
                    stateKey: stateObj.native.state
                })
            })
        );

        return states.pipe(
            tap({
                complete: () => this.bshb.log.info('Restoring cache finished')
            }),
            switchMap(() => of<void>(undefined)),
            catchError(err => {
                this.bshb.log.warn('Restoring Cache failed. We continue anyway. ' + err)
                return of<void>(undefined);
            })
        );
    }

    private isDefined<T>(arg: T | null | undefined): arg is T {
        return arg !== null && arg !== undefined;
    }

    /**
     * detect devices will search for all devices and device states and load them to iobroker.
     */
    private detectDevices(): Observable<void> {
        this.bshb.log.info('Start detecting devices...');

        const rooms = this.getBshcClient().getRooms({timeout: this.long_timeout}).pipe(
            switchMap(response => {
                this.bshb.log.debug(`Found ${(response.parsedResponse.length)} rooms.`);
                return from(response.parsedResponse);
            }),
            switchMap(room => {
                this.cachedRooms.set(room.id, room);
                return of<void>(undefined);
            }),
            tap({
                complete: () => {
                    const result: { [key: string]: string } = {};
                    this.cachedRooms.forEach((value, key) => {
                        result[key] = value
                    })
                    // Cache result at the end
                    this.bshb.setState('info.cache.rooms', {val: this.mapValueToStorage(result), ack: true});
                }
            })
        );

        const devices = this.getBshcClient().getDevices({timeout: this.long_timeout}).pipe(
            switchMap(response => from(response.parsedResponse)),
            switchMap(device => {
                const name = this.getDeviceName(device);

                this.bshb.log.debug(`Device ${device.id} detected.`);

                return from(this.bshb.setObjectNotExistsAsync(device.id, {
                    type: 'device',
                    common: {
                        name: name
                    },
                    native: {device: device},
                })).pipe(
                    switchMap(() => {
                        this.cachedDevices.set(this.bshb.namespace + '.' + device.id, device);

                        const rootDeviceName = 'BSHC';

                        // root device. This should be the bosch smart home controller only. It does not exist as a
                        // separate device so we add it multiple times but due to unique id this should be ok
                        return from(this.bshb.setObjectNotExistsAsync(device.rootDeviceId, {
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
                            }
                        }));
                    }), tap(() => {
                            this.cachedDevices.set(this.bshb.namespace + '.' + device.rootDeviceId, {
                                device: {
                                    id: device.rootDeviceId
                                }
                            });
                        }
                    ));
            }), switchMap(() => of<void>(undefined)));

        return concat(rooms, devices, this.checkDeviceServices()).pipe(tap({
            complete: () => this.bshb.log.info('Detecting devices finished')
        }));
    }

    private checkDeviceServices(): Observable<void> {
        return this.getBshcClient().getDevicesServices({timeout: this.long_timeout}).pipe(
            switchMap(response => {
                this.bshb.log.debug(`Found ${response.parsedResponse ? response.parsedResponse.length : '0'} device services.`);
                return from(response.parsedResponse);
            }),
            mergeMap(deviceService => {
                this.bshb.log.debug(`Check device service ${deviceService.id}`);

                return from(this.bshb.getObjectAsync(deviceService.deviceId)).pipe(
                    switchMap(ioBrokerDevice => {
                        if (!ioBrokerDevice) {
                            this.bshb.log.error('Found device but value is undefined. This should not happen: deviceId=' + deviceService.deviceId);
                            return of(undefined);
                        } else {
                            return this.importChannels(ioBrokerDevice.native.device, deviceService);
                        }
                    })
                );
            }),
            switchMap(() => of(undefined)));
    }

    private importChannels(device: any, deviceService: any): Observable<void> {
        let id: string;

        if (device) {
            id = device.id + '.' + deviceService.id;
        } else {
            id = deviceService.id;
        }

        const name = this.getDeviceName(device) + '.' + deviceService.id;

        return from(this.bshb.setObjectNotExistsAsync(id, {
            type: 'channel',
            common: {
                name: name
            },
            native: {device: device, deviceService: deviceService},
        })).pipe(
            tap(obj => {
                if (obj) {
                    this.addRoom(device.id, deviceService.id, undefined as unknown as string, device.roomId);
                    this.addFunction(device.id, deviceService.id, undefined as unknown as string);
                }
            }),
            // add fault holder
            switchMap(() =>
                this.importSimpleState(id, device, deviceService, 'faults', BshbDeviceHandler.getFaults(deviceService), false)
            ),
            tap(() => this.cachedDeviceServices.set(deviceService.path, {
                device: device,
                deviceService: deviceService
            })),
            switchMap(() => this.importStates(id, device, deviceService)));
    }

    private importStates(idPrefix: string, device: any, deviceService: any): Observable<void> {
        // device service has a state
        // Only in case we have states
        if (deviceService.state) {
            return from(Object.keys(deviceService.state)).pipe(mergeMap(stateKey => {
                if (stateKey === '@type') {
                    return of(undefined);
                }
                return this.importSimpleState(idPrefix, device, deviceService, stateKey, deviceService.state[stateKey]);
            }));
        } else {
            return of(undefined);
        }
    }

    private importSimpleState(idPrefix: string, device: any, deviceService: any, stateKey: string, stateValue: any, write?: boolean): Observable<void> {
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

        this.cachedStates.set(this.bshb.namespace + '.' + id, {
            device: device,
            deviceService: deviceService,
            id: id,
            stateKey: stateKey
        });

        return from(this.bshb.setObjectNotExistsAsync(id, {
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
        })).pipe(
            switchMap(() => from(this.bshb.getStateAsync(id))),
            switchMap(state => {
                if (state) {
                    return this.mapValueFromStorage(id, state.val).pipe(
                        tap(value => {
                            if (value !== stateValue) {
                                // only set again if a change is detected.
                                this.bshb.setState(id, {val: this.mapValueToStorage(stateValue), ack: true});
                            }
                        }),
                        switchMap(() => of(undefined))
                    );
                } else {
                    // no previous state so we set it
                    this.bshb.setState(id, {val: this.mapValueToStorage(stateValue), ack: true});
                    // we do not wait
                    return of(undefined);
                }
            })
        );
    }

    private addRoom(deviceId: string, deviceServiceId: string, itemId: string, roomId: string): void {
        if (roomId) {
            const room = this.getRoomById(roomId);

            if (room) {
                let name = room.name;

                if (name) {
                    name = name.trim().toLowerCase().replace(/ /g, '_');

                    if (name && name.length > 0) {
                        this.addRoomEnum(name, deviceId, deviceServiceId, itemId);
                    }
                }
            }
        }
    }

    private addFunction(deviceId: string, deviceServiceId: string, itemId: string): void {
        let name = BshbDefinition.determineFunction(deviceServiceId);

        if (name) {
            name = name.trim().toLowerCase().replace(/ /g, '_');

            if (name && name.length > 0) {
                this.addFunctionEnum(name, deviceId, deviceServiceId, itemId);
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
            } else if (value === 'SYSTEM_ARMED') {
                this.bshb.setState('intrusionDetectionSystem.IntrusionDetectionControl.remainingTimeUntilArmed', {
                    val: 0,
                    ack: true
                });
            }
        }
    }

}