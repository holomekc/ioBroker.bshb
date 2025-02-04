"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbClimateHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const bshb_definition_1 = require("../../bshb-definition");
class BshbClimateHandler extends bshb_handler_1.BshbHandler {
    climateTextActivateRegex = /bshb\.\d+\.(roomClimateControl_hz_\d+)\.ClimateSchedule\.activeScheduleId/;
    climateSwitchActivateRegex = /bshb\.\d+\.(roomClimateControl_hz_\d+)\.ClimateSchedule\.(.*?)\.active/;
    handleDetection() {
        return this.detectClimateSchedules().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting climate schedules...'),
            finalize: () => this.bshb.log.info('Detecting climate schedules finished'),
        }));
    }
    handleBshcUpdate(resultEntry) {
        if (resultEntry.id === 'RoomClimateControl') {
            this.getAndProcessDeviceSchedule(resultEntry.deviceId, resultEntry.state?.roomControlMode).subscribe(this.handleBshcUpdateError(`deviceId=${resultEntry.deviceId}`));
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        const matchTextActivate = this.climateTextActivateRegex.exec(id);
        const matchSwitchActivate = this.climateSwitchActivateRegex.exec(id);
        let result = (0, rxjs_1.of)(false);
        if (matchTextActivate) {
            this.bshb.log.debug(`Found climate trigger with deviceId=${matchTextActivate[1]}, value=${state.val}`);
            result = this.mapValueFromStorage(id, state.val).pipe((0, rxjs_1.switchMap)(val => this.getBshcClient().activateClimateSchedules(matchTextActivate[1], val)), (0, rxjs_1.tap)(this.handleBshcSendError(`deviceId=${matchTextActivate[1]}, value=${state.val}`)), (0, rxjs_1.map)(() => true));
        }
        else if (matchSwitchActivate) {
            this.bshb.log.debug(`Found climate trigger with deviceId=${matchSwitchActivate[1]}, id=${matchSwitchActivate[2]}, value=${state.val}`);
            result = this.getBshcClient()
                .activateClimateSchedules(matchSwitchActivate[1], matchSwitchActivate[2])
                .pipe((0, rxjs_1.tap)(this.handleBshcSendError(`deviceId=${matchSwitchActivate[1]}, id=${matchSwitchActivate[2]}, value=${state.val}`)), (0, rxjs_1.map)(() => true));
        }
        return result;
    }
    detectClimateSchedules() {
        return this.getBshcClient()
            .getDevices()
            .pipe((0, rxjs_1.switchMap)(devices => (0, rxjs_1.from)(devices.parsedResponse)), (0, rxjs_1.filter)(device => device.deviceServiceIds.includes('RoomClimateControl')), (0, rxjs_1.mergeMap)(device => this.getBshcClient()
            .getDeviceServices(device.id, 'RoomClimateControl')
            .pipe((0, rxjs_1.map)(d => d.parsedResponse), (0, rxjs_1.map)(data => {
            let rcc;
            if (Array.isArray(data)) {
                rcc = data[0];
            }
            else {
                rcc = data;
            }
            return rcc;
        }), (0, rxjs_1.filter)(rcc => rcc !== null && typeof rcc !== 'undefined'), (0, rxjs_1.filter)(rcc => rcc?.state?.roomControlMode === 'HEATING' || rcc?.state?.roomControlMode === 'COOLING'), (0, rxjs_1.mergeMap)(rcc => this.getAndProcessDeviceSchedule(device.id, rcc.state.roomControlMode)))));
    }
    getAndProcessDeviceSchedule(deviceId, roomControlModel) {
        return this.getBshcClient()
            .getClimateSchedules(deviceId, roomControlModel)
            .pipe((0, rxjs_1.map)(d => d.parsedResponse), (0, rxjs_1.switchMap)(schedule => this.processDeviceSchedule(deviceId, schedule)));
    }
    processDeviceSchedule(deviceId, schedule) {
        return this.setObjectNotExistsAsync(deviceId, {
            type: 'device',
            common: {
                name: schedule.name || schedule.id,
            },
            native: {},
        }).pipe((0, rxjs_1.switchMap)(() => this.setObjectNotExistsAsync(`${deviceId}.ClimateSchedule`, {
            type: 'channel',
            common: {
                name: 'ClimateSchedule',
            },
            native: {},
        })), (0, rxjs_1.switchMap)(() => {
            const id = `${deviceId}.ClimateSchedule.activeScheduleId`;
            return this.setObjectNotExistsAsync(id, {
                type: 'state',
                common: {
                    name: 'activeScheduleId',
                    type: 'string',
                    role: 'text',
                    read: true,
                    write: true,
                },
                native: {},
            }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(id, {
                val: this.mapValueToStorage(schedule.activeScheduleId),
                ack: true,
            })));
        }), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(schedule.scheduleData)), (0, rxjs_1.mergeMap)(data => this.setObjectNotExistsAsync(`${deviceId}.ClimateSchedule.${data.id}`, {
            type: 'folder',
            common: {
                name: data.name || data.id,
            },
            native: {},
        }).pipe((0, rxjs_1.switchMap)(() => {
            const id = `${deviceId}.ClimateSchedule.${data.id}.profiles`;
            return this.setObjectNotExistsAsync(id, {
                type: 'state',
                common: {
                    name: 'profiles',
                    type: 'object',
                    role: 'state',
                    read: true,
                    write: false,
                },
                native: {},
            }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(id, {
                val: this.mapValueToStorage(data.profiles),
                ack: true,
            })));
        }), (0, rxjs_1.switchMap)(() => {
            const id = `${deviceId}.ClimateSchedule.${data.id}.ScheduleType`;
            return this.setObjectNotExistsAsync(id, {
                type: 'state',
                common: {
                    name: 'ScheduleType',
                    type: 'string',
                    role: 'text',
                    read: true,
                    write: false,
                    states: bshb_definition_1.BshbDefinition.determineStates('ClimateSchedule', 'ScheduleType'),
                },
                native: {},
            }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(id, {
                val: this.mapValueToStorage(data.attributeExtensionMap?.ScheduleType),
                ack: true,
            })));
        }), (0, rxjs_1.switchMap)(() => {
            const id = `${deviceId}.ClimateSchedule.${data.id}.ClimateRoomControlMode`;
            return this.setObjectNotExistsAsync(id, {
                type: 'state',
                common: {
                    name: 'ClimateRoomControlMode',
                    type: 'string',
                    role: 'text',
                    read: true,
                    write: false,
                    states: bshb_definition_1.BshbDefinition.determineStates('climateControlState', 'roomControlMode'),
                },
                native: {},
            }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(id, {
                val: this.mapValueToStorage(data.attributeExtensionMap?.ClimateRoomControlMode),
                ack: true,
            })));
        }), (0, rxjs_1.switchMap)(() => {
            const id = `${deviceId}.ClimateSchedule.${data.id}.active`;
            return this.setObjectNotExistsAsync(id, {
                type: 'state',
                common: {
                    name: 'active',
                    type: 'boolean',
                    role: 'switch',
                    read: false,
                    write: true,
                },
                native: {},
            }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(id, {
                val: this.mapValueToStorage(data.id === schedule.activeScheduleId),
                ack: true,
            })));
        }))));
    }
    name() {
        return 'climateHandler';
    }
}
exports.BshbClimateHandler = BshbClimateHandler;
//# sourceMappingURL=bshb-climate-handler.js.map
