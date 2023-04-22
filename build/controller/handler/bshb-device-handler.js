"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbDeviceHandler = void 0;
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
    cachedRooms = new Map();
    cachedDevices = new Map();
    cachedStates = new Map();
    cachedDeviceServices = new Map();
    handleDetection() {
        const cache = this.restoreCache();
        const devices = this.detectDevices().pipe((0, operators_1.catchError)(err => {
            // skip errors here
            this.bshb.log.warn('Failure during detection in BshbDeviceHandler. Continue with cached data. This only works if the adapter has been started successfully at least once. New devices may not be recognized. ' + err);
            return (0, rxjs_1.of)(undefined);
        }));
        return (0, rxjs_1.concat)(cache, devices);
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
                        const id = BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, stateKey);
                        (0, rxjs_1.from)(this.bshb.getObjectAsync(id)).pipe((0, operators_1.switchMap)(obj => {
                            if (obj) {
                                this.bshb.setState(id, {
                                    val: this.mapValueToStorage(resultEntry.state[stateKey]),
                                    ack: true,
                                });
                                return (0, rxjs_1.of)(undefined);
                            }
                            else {
                                // dynamically create objects in case it was missing. This might occur when values are not always set.
                                // setState is also handled in state creation, so no additional setState necessary.
                                return this.importSimpleState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService), cachedDeviceService.device, cachedDeviceService.deviceService, stateKey, resultEntry.state[stateKey]);
                            }
                        }), (0, operators_1.tap)(() => {
                            this.handleBshcUpdateSpecialCases(id, cachedDeviceService.device, cachedDeviceService.deviceService, resultEntry.state[stateKey]);
                        })).subscribe(this.handleBshcUpdateError(`path=${resultEntry.path}`));
                    });
                }
                // fault handling
                if (resultEntry.faults && resultEntry.faults.entries && resultEntry.faults.entries.length > 0) {
                    // set faults
                    this.bshb.setState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'), { val: this.mapValueToStorage(BshbDeviceHandler.getFaults(resultEntry)), ack: true });
                }
                else {
                    // clear faults
                    this.bshb.setState(BshbDeviceHandler.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'), { val: this.mapValueToStorage(BshbDeviceHandler.getFaults(undefined)), ack: true });
                }
            }
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        let cachedState = this.cachedStates.get(id);
        if (cachedState && utils_1.Utils.isLevelActive(this.bshb.log.level, log_level_1.LogLevel.debug)) {
            this.bshb.log.debug(`Send update to BSHC for id: ${id}. Cached state: ${JSON.stringify(cachedState)}`);
        }
        if (cachedState && cachedState.deviceService && cachedState.deviceService.state && cachedState.deviceService.state['@type']) {
            const data = {
                '@type': cachedState.deviceService.state['@type'],
            };
            this.mapValueFromStorage(id, state.val).subscribe(value => {
                data[cachedState.stateKey] = value;
                if (utils_1.Utils.isLevelActive(this.bshb.log.level, log_level_1.LogLevel.debug)) {
                    this.bshb.log.debug('Data which will be send: ' + JSON.stringify(data));
                }
                this.getBshcClient().putState(cachedState.deviceService.path, data, { timeout: this.long_timeout })
                    .subscribe(this.handleBshcSendError(`path=${cachedState.deviceService.path}`));
            });
            return true;
        }
        return false;
    }
    restoreCache() {
        let start = (0, rxjs_1.of)('').pipe((0, operators_1.tap)(() => this.bshb.log.info('Restoring cache started...')));
        const preparation = start.pipe((0, operators_1.switchMap)(() => this.setObjectNotExistsAsync('info.cache', {
            type: 'folder',
            common: {
                name: 'cache',
            },
            native: {},
        })), (0, operators_1.switchMap)(() => this.setObjectNotExistsAsync('info.cache.rooms', {
            type: 'state',
            common: {
                name: 'rooms',
                type: 'object',
                role: 'state',
                read: true,
                write: false,
            },
            native: {},
        })));
        const rooms = preparation.pipe(
        // Restore rooms cache
        (0, operators_1.tap)(() => this.bshb.log.info('Restoring cache: rooms')), (0, operators_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getStateAsync('info.cache.rooms'))), (0, rxjs_1.filter)(this.isDefined), (0, operators_1.switchMap)(roomState => this.mapValueFromStorage('info.cache.rooms', roomState.val)), (0, operators_1.tap)(roomState => {
            for (const [key, value] of Object.entries(roomState)) {
                this.bshb.log.debug('Restore cache room: ' + key);
                this.cachedRooms.set(key, value);
            }
        }));
        const devices = rooms.pipe((0, operators_1.tap)(() => this.bshb.log.info('Restoring cache: devices, device service and states')), 
        // Restore devices, services and states
        // First get all objects and create stream
        (0, operators_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getDevicesAsync())), (0, operators_1.switchMap)(result => (0, rxjs_1.from)(result)), (0, rxjs_1.filter)(obj => obj.native.device && obj.native.device.id), 
        // Restore device
        (0, operators_1.tap)(obj => {
            this.bshb.log.debug('Restore cache device: ' + obj.native.device.id);
            this.cachedDevices.set(this.bshb.namespace + '.' + obj.native.device.id, obj.native.device);
        }));
        const deviceServices = devices.pipe(
        // We use device.id because it is the ioBroker id but Object does not provide id without namespace.
        (0, rxjs_1.mergeMap)(obj => (0, rxjs_1.from)(this.bshb.getChannelsOfAsync(obj.native.device.id))), (0, operators_1.switchMap)(result => (0, rxjs_1.from)(result)), (0, rxjs_1.filter)(obj => obj.native.device && obj.native.device.id &&
            obj.native.deviceService && obj.native.deviceService.id && obj.native.deviceService.path), 
        // Restore device service
        (0, operators_1.tap)(channelObj => {
            const id = BshbDeviceHandler.getId(channelObj.native.device, channelObj.native.deviceService);
            this.bshb.log.silly('Restore cache device service: ' + id);
            this.cachedDeviceServices.set(channelObj.native.deviceService.path, {
                device: channelObj.native.device,
                deviceService: channelObj.native.deviceService,
            });
        }));
        const states = deviceServices.pipe((0, rxjs_1.mergeMap)(obj => (0, rxjs_1.from)(this.bshb.getStatesOfAsync(obj.native.device.id, obj.native.deviceService.id))), (0, operators_1.switchMap)(result => (0, rxjs_1.from)(result)), (0, rxjs_1.filter)(obj => obj.native.device && obj.native.device.id &&
            obj.native.deviceService && obj.native.deviceService.id &&
            obj.native.state), (0, operators_1.tap)(stateObj => {
            const id = BshbDeviceHandler.getId(stateObj.native.device, stateObj.native.deviceService, stateObj.native.state);
            this.bshb.log.silly('Restore cache state: ' + id);
            this.cachedStates.set(this.bshb.namespace + '.' + id, {
                device: stateObj.native.device,
                deviceService: stateObj.native.deviceService,
                id: id,
                stateKey: stateObj.native.state,
            });
        }));
        return states.pipe((0, operators_1.tap)({
            complete: () => this.bshb.log.info('Restoring cache finished'),
        }), (0, operators_1.switchMap)(() => (0, rxjs_1.of)(undefined)), (0, operators_1.catchError)(err => {
            this.bshb.log.warn('Restoring Cache failed. We continue anyway. ' + err);
            return (0, rxjs_1.of)(undefined);
        }));
    }
    isDefined(arg) {
        return arg !== null && arg !== undefined;
    }
    /**
     * detect devices will search for all devices and device states and load them to iobroker.
     */
    detectDevices() {
        const rooms = this.getBshcClient().getRooms({ timeout: this.long_timeout }).pipe((0, operators_1.tap)(() => this.bshb.log.info('Start detecting devices...')), (0, operators_1.switchMap)(response => {
            this.bshb.log.debug(`Found ${(response.parsedResponse.length)} rooms.`);
            return (0, rxjs_1.from)(response.parsedResponse);
        }), (0, operators_1.switchMap)(room => {
            this.cachedRooms.set(room.id, room);
            return (0, rxjs_1.of)(undefined);
        }), (0, operators_1.tap)({
            complete: () => {
                const result = {};
                this.cachedRooms.forEach((value, key) => {
                    result[key] = value;
                });
                // Cache result at the end
                this.bshb.setState('info.cache.rooms', { val: this.mapValueToStorage(result), ack: true });
            },
        }));
        const devices = this.getBshcClient().getDevices({ timeout: this.long_timeout }).pipe((0, operators_1.switchMap)(response => (0, rxjs_1.from)(response.parsedResponse)), (0, rxjs_1.mergeMap)(device => {
            const name = this.getDeviceName(device);
            this.bshb.log.debug(`Device ${device.id} detected.`);
            const deviceStatusId = `${device.id}.status`;
            return this.setObjectNotExistsAsync(device.id, {
                type: 'device',
                common: {
                    name: name,
                },
                native: { device: device },
            }).pipe((0, operators_1.tap)(obj => {
                if (obj && obj._bshbCreated) {
                    this.addRoom(device.id, undefined, undefined, device.roomId);
                }
            }), (0, operators_1.switchMap)(() => this.setObjectNotExistsAsync(deviceStatusId, {
                type: 'state',
                common: {
                    name: 'status',
                    type: 'string',
                    role: 'state',
                    read: true,
                    write: false,
                    states: {
                        AVAILABLE: 'AVAILABLE',
                        DISCOVERED: 'DISCOVERED',
                        UNAVAILABLE: 'UNAVAILABLE',
                        COMMUNICATION_ERROR: 'COMMUNICATION_ERROR',
                        UNDEFINED: 'UNDEFINED',
                    },
                },
                native: {},
            })), (0, operators_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getStateAsync(deviceStatusId))), (0, operators_1.switchMap)(state => this.setInitialStateValueIfNotSet(deviceStatusId, state, device.status)), (0, operators_1.switchMap)(() => {
                this.cachedDevices.set(this.bshb.namespace + '.' + device.id, device);
                const rootDeviceName = 'BSHC';
                // root device. This should be the bosch smart home controller only. It does not exist as a
                // separate device so we add it multiple times but due to unique id this should be ok
                return this.setObjectNotExistsAsync(device.rootDeviceId, {
                    type: 'device',
                    common: {
                        name: rootDeviceName,
                    },
                    native: {
                        device: {
                            id: device.rootDeviceId,
                            roomId: device.roomId,
                            name: rootDeviceName,
                        },
                    },
                });
            }), (0, operators_1.tap)(() => {
                this.cachedDevices.set(this.bshb.namespace + '.' + device.rootDeviceId, {
                    device: {
                        id: device.rootDeviceId,
                    },
                });
            }));
        }), (0, operators_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
        return (0, rxjs_1.concat)(rooms, devices, this.checkDeviceServices()).pipe((0, operators_1.tap)({
            complete: () => this.bshb.log.info('Detecting devices finished'),
        }));
    }
    checkDeviceServices() {
        return this.getBshcClient().getDevicesServices({ timeout: this.long_timeout }).pipe((0, operators_1.switchMap)(response => {
            this.bshb.log.debug(`Found ${response.parsedResponse ? response.parsedResponse.length : '0'} device services.`);
            return (0, rxjs_1.from)(response.parsedResponse);
        }), (0, rxjs_1.mergeMap)(deviceService => {
            this.bshb.log.debug(`Check device service ${deviceService.id}`);
            return (0, rxjs_1.from)(this.bshb.getObjectAsync(deviceService.deviceId)).pipe((0, operators_1.switchMap)(ioBrokerDevice => {
                if (!ioBrokerDevice) {
                    this.bshb.log.error('Found device but value is undefined. This should not happen: deviceId=' + deviceService.deviceId);
                    return (0, rxjs_1.of)(undefined);
                }
                else {
                    return this.importChannels(ioBrokerDevice.native.device, deviceService);
                }
            }));
        }), (0, operators_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
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
        return this.setObjectNotExistsAsync(id, {
            type: 'channel',
            common: {
                name: name,
            },
            native: { device: device, deviceService: deviceService },
        }).pipe((0, operators_1.tap)(obj => {
            if (obj && obj._bshbCreated) {
                this.addRoom(device.id, deviceService.id, undefined, device.roomId);
                this.addFunction(device.id, deviceService.id, undefined);
            }
        }), 
        // add fault holder
        (0, operators_1.switchMap)(() => this.importSimpleState(id, device, deviceService, 'faults', BshbDeviceHandler.getFaults(deviceService), false)), (0, operators_1.tap)(() => this.cachedDeviceServices.set(deviceService.path, {
            device: device,
            deviceService: deviceService,
        })), (0, operators_1.switchMap)(() => this.importStates(id, device, deviceService)));
    }
    importStates(idPrefix, device, deviceService) {
        // device service has a state
        // Only in case we have states
        if (deviceService.state) {
            return (0, rxjs_1.from)(Object.keys(deviceService.state)).pipe((0, rxjs_1.mergeMap)(stateKey => {
                if (stateKey === '@type') {
                    return (0, rxjs_1.of)(undefined);
                }
                return this.importSimpleState(idPrefix, device, deviceService, stateKey, deviceService.state[stateKey]);
            }));
        }
        else {
            return (0, rxjs_1.of)(undefined);
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
        const deviceType = deviceService && deviceService.state ? deviceService.state['@type'] : null;
        const role = bshb_definition_1.BshbDefinition.determineRole(deviceType, stateKey, stateValue);
        const unit = bshb_definition_1.BshbDefinition.determineUnit(deviceType, stateKey);
        const states = bshb_definition_1.BshbDefinition.determineStates(deviceType, stateKey);
        this.cachedStates.set(this.bshb.namespace + '.' + id, {
            device: device,
            deviceService: deviceService,
            id: id,
            stateKey: stateKey,
        });
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: name,
                type: bshb_definition_1.BshbDefinition.determineType(stateValue),
                role: role,
                read: true,
                write: typeof write === 'undefined' ? bshb_definition_1.BshbDefinition.determineWrite(deviceType, stateKey) : write,
                unit: unit,
                states: states,
            },
            native: { device: device, deviceService: deviceService, state: stateKey },
        }).pipe((0, operators_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getStateAsync(id))), (0, operators_1.switchMap)(state => this.setInitialStateValueIfNotSet(id, state, stateValue)));
    }
    addRoom(deviceId, deviceServiceId, itemId, roomId) {
        if (roomId) {
            const room = this.getRoomById(roomId);
            if (room) {
                this.addRoomEnum(room.name, deviceId, deviceServiceId, itemId);
            }
        }
    }
    addFunction(deviceId, deviceServiceId, itemId) {
        let name = bshb_definition_1.BshbDefinition.determineFunction(deviceServiceId);
        this.addFunctionEnum(name, deviceId, deviceServiceId, itemId);
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
        if (stateKey) {
            return id + '.' + stateKey;
        }
        else {
            return id;
        }
    }
    // This are very special cases where values are not expected/visible/temporary/etc.
    handleBshcUpdateSpecialCases(id, device, deviceService, value) {
        if (id.includes('intrusionDetectionSystem.IntrusionDetectionControl.value')) {
            if (value === 'SYSTEM_DISARMED') {
                this.bshb.setState('intrusionDetectionSystem.IntrusionDetectionControl.remainingTimeUntilArmed', {
                    val: -1,
                    ack: true,
                });
            }
            else if (value === 'SYSTEM_ARMED') {
                this.bshb.setState('intrusionDetectionSystem.IntrusionDetectionControl.remainingTimeUntilArmed', {
                    val: 0,
                    ack: true,
                });
            }
        }
    }
    name() {
        return 'deviceHandler';
    }
}
exports.BshbDeviceHandler = BshbDeviceHandler;
//# sourceMappingURL=bshb-device-handler.js.map