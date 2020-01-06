"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bosch_smart_home_bridge_1 = require("bosch-smart-home-bridge");
const bshb_logger_1 = require("./bshb-logger");
const rxjs_1 = require("rxjs");
const bshb_definition_1 = require("./bshb-definition");
const operators_1 = require("rxjs/operators");
const log_level_1 = require("./log-level");
const utils_1 = require("./utils");
/**
 * This controller encapsulates bosch-smart-home-bridge and provides it to iobroker.bshb
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
class BshbController {
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
    constructor(bshb, clientCert, clientPrivateKey) {
        this.bshb = bshb;
        this.cachedRooms = new Map();
        this.cachedDevices = new Map();
        this.cachedStates = new Map();
        this.cachedDeviceServices = new Map();
        this.clientName = 'ioBroker.bshb';
        this.scenarioRegex = /bshb\.\d+\.scenarios\.(.*)/;
        this.chain = Promise.resolve();
        try {
            this.boschSmartHomeBridge = bosch_smart_home_bridge_1.BoschSmartHomeBridgeBuilder.builder()
                .withHost(bshb.config.host)
                .withClientCert(clientCert)
                .withClientPrivateKey(clientPrivateKey)
                .withLogger(new bshb_logger_1.BshbLogger(bshb))
                .build();
        }
        catch (e) {
            throw utils_1.Utils.createError(bshb.log, e);
        }
    }
    getBshcClient() {
        return this.boschSmartHomeBridge.getBshcClient();
    }
    /**
     * Pair devices if needed
     *
     * @param systemPassword
     *        system password of BSHC
     */
    pairDeviceIfNeeded(systemPassword) {
        let pairingDelay = 5000;
        if (this.bshb.config.pairingDelay && this.bshb.config.pairingDelay > 5000) {
            pairingDelay = this.bshb.config.pairingDelay;
        }
        return this.boschSmartHomeBridge.pairIfNeeded(this.clientName, this.bshb.config.identifier, systemPassword, pairingDelay, 100);
    }
    /**
     * iobroker state changed. Change it via bosch-smart-home-bridge
     *
     * @param id
     *        identifier of state
     * @param state
     *        new state value
     */
    setState(id, state) {
        const match = this.scenarioRegex.exec(id);
        if (match) {
            this.bshb.log.debug(`Found scenario trigger with id=${match[1]} and value=${state.val}`);
            if (state.val) {
                this.getBshcClient().triggerScenario(match[1]).subscribe(() => {
                    this.bshb.setState(id, { val: false, ack: true });
                });
            }
            return;
        }
        let cachedState = this.cachedStates.get(id);
        if (utils_1.Utils.isLevelActive(this.bshb.log.level, log_level_1.LogLevel.debug)) {
            this.bshb.log.debug('Found cached state: ' + JSON.stringify(cachedState));
        }
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
    }
    /**
     * Set a state with ack. All values of deviceService - state type are set
     *
     * @param resultEntry object containing @type and values
     */
    setStateAck(resultEntry) {
        if (resultEntry.path) {
            const cachedDeviceService = this.cachedDeviceServices.get(resultEntry.path);
            if (cachedDeviceService) {
                // found cached device
                if (resultEntry.state) {
                    Object.keys(resultEntry.state).forEach(stateKey => {
                        if (stateKey === '@type') {
                            return;
                        }
                        this.bshb.setState(BshbController.getId(cachedDeviceService.device, cachedDeviceService.deviceService, stateKey), { val: resultEntry.state[stateKey], ack: true });
                    });
                }
                // fault handling
                if (resultEntry.faults && resultEntry.faults.entries && resultEntry.faults.entries.length > 0) {
                    // set faults
                    this.bshb.setState(BshbController.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'), { val: this.getFaults(resultEntry), ack: true });
                }
                else {
                    // clear faults
                    this.bshb.setState(BshbController.getId(cachedDeviceService.device, cachedDeviceService.deviceService, 'faults'), { val: this.getFaults(undefined), ack: true });
                }
            }
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
    detectScenarios() {
        return new rxjs_1.Observable(subscriber => {
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
                    this.bshb.setState(id, { val: false, ack: true });
                });
                subscriber.next();
                subscriber.complete();
            });
        });
    }
    /**
     * detect devices will search for all devices and device states and load them to iobroker.
     */
    detectDevices() {
        this.bshb.log.info('Start detecting devices. This may take a while.');
        return new rxjs_1.Observable(subscriber => {
            this.getBshcClient().getRooms().pipe(operators_1.switchMap(response => {
                const rooms = response.parsedResponse;
                rooms.forEach(room => {
                    this.cachedRooms.set(room.id, room);
                });
                return this.getBshcClient().getDevices();
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
            });
        });
    }
    checkDeviceServices() {
        return new rxjs_1.Observable(observer => {
            this.getBshcClient().getDevicesServices().subscribe(response => {
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
        });
        // add fault holder
        this.importSimpleState(id, device, deviceService, 'faults', this.getFaults(deviceService), false);
        this.addRoom(device.id, deviceService.id, undefined, device.roomId);
        this.addFunction(device.id, deviceService.id, undefined);
        if (deviceService.state) {
            this.importStates(id, device, deviceService);
        }
    }
    importStates(idPrefix, device, deviceService) {
        // device service has a state
        Object.keys(deviceService.state).forEach(stateKey => {
            if (stateKey === '@type') {
                return;
            }
            this.importSimpleState(idPrefix, device, deviceService, stateKey, deviceService.state[stateKey]);
        });
        this.cachedDeviceServices.set(deviceService.path, { device: device, deviceService: deviceService });
    }
    importSimpleState(idPrefix, device, deviceService, stateKey, stateValue, write) {
        const id = idPrefix + '.' + stateKey;
        let name = '';
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
        return name;
    }
    getRoomById(roomId) {
        return this.cachedRooms.get(roomId);
    }
    getFaults(object) {
        if (object && object.faults && object.faults.entries && object.faults.entries.length > 0) {
            return object.faults.entries;
        }
        else {
            return [];
        }
    }
}
exports.BshbController = BshbController;
