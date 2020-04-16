"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const bshb_definition_1 = require("../../bshb-definition");
const utils_1 = require("../../utils");
const log_level_1 = require("../../log-level");
/**
 * This handler is used to detect devices of bshc
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
class BshbDeviceHandler extends bshb_handler_1.BshbHandler {
    constructor() {
        super(...arguments);
        this.cachedRooms = new Map();
        this.cachedDevices = new Map();
        this.cachedStates = new Map();
        this.cachedDeviceServices = new Map();
    }
    handleDetection() {
        return this.detectDevices();
    }
    handleBshcUpdate(resultEntry) {
        if (resultEntry.path) {
            const cachedDeviceService = this.cachedDeviceServices.get(resultEntry.path);
            if (cachedDeviceService) {
                // found cached device
                if (resultEntry.state) {
                    Object.keys(resultEntry.state).forEach(stateKey => {
                        if (stateKey === '@type') {
                            return;
                        }
                        this.bshb.setState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, stateKey), { val: resultEntry.state[stateKey], ack: true });
                    });
                }
                // fault handling
                if (resultEntry.faults && resultEntry.faults.entries && resultEntry.faults.entries.length > 0) {
                    // set faults
                    this.bshb.setState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'), { val: BshbDeviceHandler.getFaults(resultEntry), ack: true });
                }
                else {
                    // clear faults
                    this.bshb.setState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'), { val: BshbDeviceHandler.getFaults(undefined), ack: true });
                }
            }
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        let cachedState = this.cachedStates.get(id);
        if (utils_1.Utils.isLevelActive(this.bshb.log.level, log_level_1.LogLevel.debug)) {
            this.bshb.log.debug('Found cached state: ' + JSON.stringify(cachedState));
        }
        if (cachedState && cachedState.deviceService && cachedState.deviceService.state && cachedState.deviceService.state['@type']) {
            const data = {
                '@type': cachedState.deviceService.state['@type'],
            };
            data[cachedState.stateKey] = state.val;
            if (utils_1.Utils.isLevelActive(this.bshb.log.level, log_level_1.LogLevel.debug)) {
                this.bshb.log.debug('Data which will be send: ' + JSON.stringify(data));
            }
            this.getBshcClient().putState(cachedState.deviceService.path, data).subscribe(response => {
                if (response) {
                    if (utils_1.Utils.isLevelActive(this.bshb.log.level, log_level_1.LogLevel.debug)) {
                        this.bshb.log.debug(`HTTP response. status=${response.incomingMessage.statusCode},
                     body=${JSON.stringify(response.parsedResponse)}`);
                    }
                }
                else {
                    this.bshb.log.debug('no response');
                }
            }, error => {
                this.bshb.log.error(error);
            });
            return true;
        }
        return false;
    }
    /**
     * detect devices will search for all devices and device states and load them to iobroker.
     */
    detectDevices() {
        this.bshb.log.info('Start detecting devices...');
        return new rxjs_1.Observable(subscriber => {
            this.getBshcClient().getRooms({ timeout: this.long_timeout }).pipe(operators_1.switchMap(response => {
                const rooms = response.parsedResponse;
                rooms.forEach(room => {
                    this.cachedRooms.set(room.id, room);
                });
                return this.getBshcClient().getDevices({ timeout: this.long_timeout });
            }), operators_1.switchMap(response => {
                const devices = response.parsedResponse;
                devices.forEach(device => {
                    // this.cachedDevices.set(device.id, device);
                    const name = this.getDeviceName(device);
                    this.bshb.setObjectNotExists(device.id, {
                        type: 'device',
                        common: {
                            name: name,
                            read: true
                        },
                        native: { device: device },
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
                subscriber.error(err);
            });
        });
    }
    checkDeviceServices() {
        return new rxjs_1.Observable(observer => {
            this.getBshcClient().getDevicesServices({ timeout: this.long_timeout }).subscribe(response => {
                const deviceServices = response.parsedResponse;
                deviceServices.forEach(deviceService => {
                    this.bshb.getObject(deviceService.deviceId, (err, ioBrokerDevice) => {
                        if (err) {
                            this.bshb.log.error('Could not find device. This should not happen: deviceId=' + deviceService.deviceId + ', error=' + err);
                            return;
                        }
                        else if (!ioBrokerDevice) {
                            this.bshb.log.error('Found device but value is undefined. This should not happen: deviceId=' + deviceService.deviceId);
                            return;
                        }
                        this.importChannels(ioBrokerDevice.native.device, deviceService);
                    });
                });
                observer.next();
                observer.complete();
            }, err => {
                observer.error(err);
            });
        });
    }
    importChannels(device, deviceService) {
        let id;
        if (device) {
            id = device.id + '.' + deviceService.id;
        }
        else {
            id = deviceService.id;
        }
        const name = this.getDeviceName(device) + '.' + deviceService.id;
        this.bshb.setObjectNotExists(id, {
            type: 'channel',
            common: {
                name: name,
                read: true,
            },
            native: { device: device, deviceService: deviceService },
        }, (err, obj) => {
            if (obj) {
                // a new object was created we add room and function
                this.addRoom(device.id, deviceService.id, undefined, device.roomId);
                this.addFunction(device.id, deviceService.id, undefined);
            }
        });
        // add fault holder
        this.importSimpleState(id, device, deviceService, 'faults', BshbDeviceHandler.getFaults(deviceService), false);
        this.cachedDeviceServices.set(deviceService.path, { device: device, deviceService: deviceService });
        // add states
        this.importStates(id, device, deviceService);
    }
    importStates(idPrefix, device, deviceService) {
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
    importSimpleState(idPrefix, device, deviceService, stateKey, stateValue, write) {
        const id = idPrefix + '.' + stateKey;
        let name;
        if (deviceService) {
            name = this.getDeviceName(device) + '.' + deviceService.id + '.' + stateKey;
        }
        else {
            name = this.getDeviceName(device) + '.' + stateKey;
        }
        this.bshb.setObjectNotExists(id, {
            type: 'state',
            common: {
                name: name,
                type: bshb_definition_1.BshbDefinition.determineType(stateValue),
                role: bshb_definition_1.BshbDefinition.determineRole(deviceService && deviceService.state ? deviceService.state['@type'] : null, stateKey),
                read: true,
                write: typeof write === 'undefined' ? true : write,
            },
            native: { device: device, deviceService: deviceService, state: stateKey },
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
            this.bshb.setState(id, { val: stateValue, ack: true });
        });
        // We do not need to set it for every state. Set it for channel is enough
        // this.addRoom(device.id, deviceService.id, id, device.roomId);
    }
    addRoom(deviceId, deviceServiceId, itemId, roomId) {
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
                        }
                        else {
                            this.chain = this.chain.then(() => this.bshb.addChannelToEnumAsync('rooms', name, deviceId, deviceServiceId));
                        }
                    }
                }
            }
        }
    }
    addFunction(deviceId, deviceServiceId, itemId) {
        let name = bshb_definition_1.BshbDefinition.determineFunction(deviceServiceId);
        if (name) {
            name = name.trim().toLowerCase().replace(/ /g, '_');
            if (name && name.length > 0) {
                // we need to make sure that the value exists to prevent crashing ioBroker
                if (itemId) {
                    this.chain = this.chain.then(() => this.bshb.addStateToEnumAsync('functions', name, deviceId, deviceServiceId, itemId));
                }
                else {
                    this.chain = this.chain.then(() => this.bshb.addChannelToEnumAsync('functions', name, deviceId, deviceServiceId));
                }
            }
        }
    }
    getDeviceName(device) {
        let name = device.name;
        if (device.deviceModel === 'ROOM_CLIMATE_CONTROL') {
            const room = this.getRoomById(device.roomId);
            name = 'RCC.' + room.name;
        }
        else if (device.deviceModel === 'INTRUSION_DETECTION_SYSTEM') {
            name = 'IDS';
        }
        else if (device.deviceModel === 'SMOKE_DETECTION_SYSTEM') {
            name = 'SDS';
        }
        else if (device.deviceModel === 'VENTILATION_SERVICE') {
            name = 'VS';
        }
        else if (device.deviceModel === 'PRESENCE_SIMULATION_SERVICE') {
            name = 'PSS';
        }
        return name;
    }
    getRoomById(roomId) {
        return this.cachedRooms.get(roomId);
    }
    static getFaults(object) {
        if (object && object.faults && object.faults.entries && object.faults.entries.length > 0) {
            return object.faults.entries;
        }
        else {
            return [];
        }
    }
    static getId(device, deviceService, stateKey) {
        let id;
        if (device) {
            id = device.id + '.' + deviceService.id;
        }
        else {
            id = deviceService.id;
        }
        return id + '.' + stateKey;
    }
}
exports.BshbDeviceHandler = BshbDeviceHandler;
