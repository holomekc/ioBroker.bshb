"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bosch_smart_home_bridge_1 = require("bosch-smart-home-bridge");
const bshb_logger_1 = require("./bshb-logger");
const rxjs_1 = require("rxjs");
const bshb_definition_1 = require("./bshb-definition");
const operators_1 = require("rxjs/operators");
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
     */
    constructor(bshb) {
        this.bshb = bshb;
        this.cachedRooms = new Map();
        this.cachedDevices = new Map();
        this.cachedStates = new Map();
        this.cachedDeviceServices = new Map();
        this.clientName = 'ioBroker.bshb';
        this.chain = Promise.resolve();
        this.boschSmartHomeBridge = new bosch_smart_home_bridge_1.BoschSmartHomeBridge(bshb.config.host, bshb.config.identifier, bshb.config.certsPath, new bshb_logger_1.BshbLogger(bshb));
    }
    getBshbClient() {
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
        return this.boschSmartHomeBridge.pairIfNeeded(this.clientName, systemPassword, pairingDelay, 100);
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
        let cachedState = this.cachedStates.get(id);
        if (this.bshb.log.level === 'debug') {
            this.bshb.log.debug('Found cached state: ' + JSON.stringify(cachedState));
        }
        const data = {
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
     * @param deviceService object containing @type and values
     */
    setStateAck(deviceService) {
        if (deviceService.path) {
            const cachedDeviceService = this.cachedDeviceServices.get(deviceService.path);
            if (cachedDeviceService) {
                Object.keys(deviceService.state).forEach(stateKey => {
                    if (stateKey === '@type') {
                        return;
                    }
                    this.bshb.setState(this.getId(cachedDeviceService.device, cachedDeviceService.deviceService, stateKey), { val: deviceService.state[stateKey], ack: true });
                });
            }
        }
    }
    getId(device, deviceService, stateKey) {
        let id;
        if (device) {
            id = device.id + '.' + deviceService.id;
        }
        else {
            id = deviceService.id;
        }
        return id + '.' + stateKey;
    }
    /**
     * detect devices will search for all devices and device states and load them to iobroker.
     */
    detectDevices() {
        this.bshb.log.info('start detecting devices. This may take a while.');
        return new rxjs_1.Observable(observer => {
            this.boschSmartHomeBridge.getBshcClient().getRooms().pipe(operators_1.switchMap((rooms) => {
                rooms.forEach(room => {
                    this.cachedRooms.set(room.id, room);
                });
                return this.boschSmartHomeBridge.getBshcClient().getDevices();
            }), operators_1.switchMap((devices) => {
                devices.forEach(device => {
                    // this.cachedDevices.set(device.id, device);
                    this.bshb.setObject(device.id, {
                        type: 'device',
                        common: {
                            name: device.id,
                            read: true
                        },
                        native: { device: device },
                    });
                    this.cachedDevices.set(this.bshb.namespace + '.' + device.id, device);
                    // root device. This should be the bosch smart home controller only. It does not exist as a
                    // separate device so we add it multiple times but due to unique id this should be ok
                    this.bshb.setObject(device.rootDeviceId, {
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
                observer.next();
                observer.complete();
            });
        });
    }
    checkDeviceServices() {
        return new rxjs_1.Observable(observer => {
            this.boschSmartHomeBridge.getBshcClient().getDevicesServices().subscribe((deviceServices) => {
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
        const name = deviceService.id;
        this.bshb.setObject(id, {
            type: 'channel',
            common: {
                name: name,
                read: true,
            },
            native: { device: device, deviceService: deviceService },
        });
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
    importSimpleState(idPrefix, device, deviceService, stateKey, stateValue) {
        const id = idPrefix + '.' + stateKey;
        this.bshb.setObject(id, {
            type: 'state',
            common: {
                name: stateKey,
                type: bshb_definition_1.BshbDefinition.determineType(stateValue),
                role: bshb_definition_1.BshbDefinition.determineRole(deviceService.state ? deviceService.state['@type'] : null, stateKey),
                read: true,
                write: true,
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
            const room = this.cachedRooms.get(roomId);
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
}
exports.BshbController = BshbController;
