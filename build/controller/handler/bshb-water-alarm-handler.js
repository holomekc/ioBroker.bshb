"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbWaterAlarmHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const bshb_definition_1 = require("../../bshb-definition");
class BshbWaterAlarmHandler extends bshb_handler_1.BshbHandler {
    constructor() {
        super(...arguments);
        this.regex = /bshb\.\d+\.waterAlarm\..*/;
        this.cachedStates = new Map();
    }
    handleDetection() {
        return this.detectWaterAlarm().pipe((0, rxjs_1.switchMap)(() => this.createMuteAction()), (0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting water alarm...'),
            finalize: () => this.bshb.log.info('Detecting water alarm finished')
        }));
    }
    handleBshcUpdate(resultEntry) {
        // I am not sure about this. I cannot really test this. I would need to buy a compatible device to test this.
        if (resultEntry['@type'] === 'waterAlarmSystemState' || resultEntry['@type'] === 'waterAlarmSystemConfiguration') {
            const idPrefix = 'waterAlarm.waterAlarmSystemState';
            Object.keys(resultEntry).forEach(key => {
                const id = `${idPrefix}.${key}`;
                (0, rxjs_1.from)(this.bshb.getObjectAsync(id)).pipe((0, rxjs_1.switchMap)(obj => {
                    if (obj) {
                        this.bshb.setState(id, {
                            val: this.mapValueToStorage(resultEntry[key]),
                            ack: true
                        });
                        return (0, rxjs_1.of)(undefined);
                    }
                    else {
                        return this.importState(key, resultEntry);
                    }
                })).subscribe({
                    next: () => {
                        // nothing so far
                    },
                    error: error => {
                        this.bshb.log.warn(`Could not handle update for waterAlarmSystemState. ${error}`);
                    }
                });
            });
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        const match = this.regex.exec(id);
        if (match) {
            if (id === `${this.bshb.namespace}.waterAlarm.waterAlarmSystemState.mute`) {
                this.getBshcClient().muteWaterAlarm({ timeout: this.long_timeout }).subscribe({
                    next: () => {
                        this.bshb.setState(id, { val: false, ack: true });
                    },
                    error: error => {
                        this.bshb.log.warn(`Could not mute water alarm: ${error}`);
                    }
                });
            }
            else {
                (0, rxjs_1.zip)((0, rxjs_1.from)(this.bshb.getStateAsync('waterAlarm.waterAlarmSystemState.visualActuatorsAvailable')), (0, rxjs_1.from)(this.bshb.getStateAsync('waterAlarm.waterAlarmSystemState.videoActuatorsAvailable'))).pipe((0, rxjs_1.switchMap)(result => {
                    const data = {
                        visualActuatorsAvailable: result[0] ? result[0].val : false,
                        videoActuatorsAvailable: result[1] ? result[1].val : false,
                    };
                    return this.getBshcClient().updateWaterAlarm(data, { timeout: this.long_timeout });
                })).subscribe({
                    next: () => {
                        // nothing so far
                    },
                    error: error => {
                        this.bshb.log.warn(`Could not send update for waterAlarmSystemState and value=${state.val}: ${error}`);
                    }
                });
            }
            return true;
        }
        return false;
    }
    createMuteAction() {
        const id = 'waterAlarm.waterAlarmSystemState.mute';
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: 'Mute',
                type: 'boolean',
                role: 'switch',
                read: false,
                write: true
            },
            native: {}
        }).pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getStateAsync(id))), (0, rxjs_1.switchMap)(state => this.setInitialStateValueIfNotSet(id, state, false)));
    }
    detectWaterAlarm() {
        return this.setObjectNotExistsAsync('waterAlarm', {
            type: 'folder',
            common: {
                name: 'WaterAlarm',
                read: true
            },
            native: {}
        }).pipe((0, rxjs_1.switchMap)(() => this.getBshcClient().getWaterAlarm({ timeout: this.long_timeout })), (0, rxjs_1.map)(response => response.parsedResponse), (0, rxjs_1.switchMap)(waterAlarm => this.addWaterAlarm(waterAlarm)), (0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    addWaterAlarm(waterAlarm) {
        return this.setObjectNotExistsAsync('waterAlarm.waterAlarmSystemState', {
            type: 'channel',
            common: {
                name: 'WaterAlarmSystemState'
            },
            native: {}
        }).pipe((0, rxjs_1.mergeMap)(() => (0, rxjs_1.from)(Object.keys(waterAlarm))), (0, rxjs_1.mergeMap)(key => this.importState(key, waterAlarm)));
    }
    importState(key, waterAlarm) {
        if (key === '@type') {
            return (0, rxjs_1.of)(undefined);
        }
        const id = `waterAlarm.waterAlarmSystemState.${key}`;
        const value = waterAlarm[key];
        this.cachedStates.set(`${this.bshb.namespace}.${id}`, {
            key: key
        });
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: key,
                type: bshb_definition_1.BshbDefinition.determineType(value),
                role: bshb_definition_1.BshbDefinition.determineRole('waterAlarmSystemState', key, value),
                read: true,
                write: bshb_definition_1.BshbDefinition.determineWrite('waterAlarmSystemState', key),
                states: bshb_definition_1.BshbDefinition.determineStates('waterAlarmSystemState', key)
            },
            native: {}
        }).pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getStateAsync(id))), (0, rxjs_1.switchMap)(state => this.setInitialStateValueIfNotSet(id, state, value)));
    }
}
exports.BshbWaterAlarmHandler = BshbWaterAlarmHandler;
//# sourceMappingURL=bshb-water-alarm-handler.js.map