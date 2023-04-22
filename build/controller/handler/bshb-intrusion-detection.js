"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbIntrusionDetection = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const bshb_definition_1 = require("../../bshb-definition");
class BshbIntrusionDetection extends bshb_handler_1.BshbHandler {
    constructor() {
        super(...arguments);
        this.folderName = 'intrusionDetectionControl';
        this.intrusionDetectionControlRegex = /bshb\.\d+\.intrusionDetectionControl\.(.*)/;
    }
    handleBshcUpdate(resultEntry) {
        var _a, _b;
        if (resultEntry.id === 'IntrusionDetectionControl') {
            const activeProfile = (_a = resultEntry.state) === null || _a === void 0 ? void 0 : _a.activeProfile;
            const state = (_b = resultEntry.state) === null || _b === void 0 ? void 0 : _b.value;
            this.detectIntrusionDetectionControl(activeProfile, state).subscribe();
            return true;
        }
        else if (resultEntry['@type'] === 'systemAvailability' ||
            resultEntry['@type'] === 'armingState' ||
            resultEntry['@type'] === 'alarmState' ||
            resultEntry['@type'] === 'activeConfigurationProfile' ||
            resultEntry['@type'] === 'securityGapState') {
            (0, rxjs_1.from)(this.flattenData(resultEntry['@type'], resultEntry)).pipe((0, rxjs_1.mergeMap)(d => this.detectIntrusionData(d.type, d.key, d.value))).subscribe();
        }
        return false;
    }
    handleDetection() {
        return this.getBshcClient().getIntrusionDetectionSystemState().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting intrusion detection system...'),
        }), (0, rxjs_1.map)(r => r.parsedResponse), (0, rxjs_1.switchMap)(data => {
            var _a;
            return this.detectIntrusionDetectionControl(data.activeConfigurationProfile, (_a = data.armingState) === null || _a === void 0 ? void 0 : _a.state).pipe((0, rxjs_1.last)(), (0, rxjs_1.switchMap)(() => {
                const fl = this.flattenData('systemState', data);
                return (0, rxjs_1.from)(fl).pipe((0, rxjs_1.mergeMap)(d => this.detectIntrusionData(d.type, d.key, d.value)));
            }));
        }), (0, rxjs_1.tap)({
            finalize: () => this.bshb.log.info('Detecting intrusion detection system finished'),
        }));
    }
    sendUpdateToBshc(id, state) {
        const match = this.intrusionDetectionControlRegex.exec(id);
        if (match) {
            this.bshb.log.debug(`Found intrusionDetectionControl trigger with id=${match[1]} and value=${state.val}`);
            if (state.val) {
                const control = match[1];
                let command;
                switch (control) {
                    case 'fullProtection':
                        command = this.getBshcClient().armIntrusionDetectionSystem(0, { timeout: this.long_timeout });
                        break;
                    case 'partialProtection':
                        command = this.getBshcClient().armIntrusionDetectionSystem(1, { timeout: this.long_timeout });
                        break;
                    case 'individualProtection':
                        command = this.getBshcClient().armIntrusionDetectionSystem(2, { timeout: this.long_timeout });
                        break;
                    case 'disarmProtection':
                        command = this.getBshcClient().disarmIntrusionDetectionSystem({ timeout: this.long_timeout });
                        break;
                    case 'muteProtection':
                        command = this.getBshcClient().muteIntrusionDetectionSystem({ timeout: this.long_timeout });
                        break;
                    default:
                        return false;
                }
                command.subscribe(() => {
                    this.bshb.log.info(`intrusionDetectionControl with id=${match[1]} triggered`);
                    this.bshb.setState(id, { val: false, ack: true });
                }, error => {
                    this.bshb.log.warn(`Could not send trigger for intrusionDetectionControl with id=${match[1]} and value=${state.val}: ` + error);
                });
            }
            return true;
        }
        return false;
    }
    flattenData(type, data) {
        const result = [];
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'object' && !Array.isArray(value)) {
                result.push(...this.flattenData(key, value));
            }
            else if (key !== '@type' && key !== 'deleted') {
                result.push({
                    type: type,
                    key: key,
                    value: value,
                });
            }
        }
        return result;
    }
    detectIntrusionData(type, key, value) {
        const id = `${this.folderName}.${type}`;
        const stateId = `${this.folderName}.${type}.${key}`;
        const stateType = bshb_definition_1.BshbDefinition.determineType(value);
        const role = bshb_definition_1.BshbDefinition.determineRole(type, key, value);
        const unit = bshb_definition_1.BshbDefinition.determineUnit(type, key);
        const states = bshb_definition_1.BshbDefinition.determineStates(type, key);
        return this.setObjectNotExistsAsync(this.folderName, {
            type: 'folder',
            common: {
                name: 'Intrusion Detection Control',
                read: true,
            },
            native: {},
        }).pipe((0, rxjs_1.switchMap)(() => this.setObjectNotExistsAsync(id, {
            type: 'folder',
            common: {
                name: type,
                read: true,
                write: false,
            },
            native: {},
        }).pipe((0, rxjs_1.switchMap)(() => this.setObjectNotExistsAsync(stateId, {
            type: 'state',
            common: {
                name: key,
                type: stateType,
                role: role,
                read: true,
                write: false,
                unit: unit,
                states: states,
            },
            native: {},
        }).pipe((0, rxjs_1.tap)(() => this.bshb.setState(stateId, {
            val: this.mapValueToStorage(value),
            ack: true,
        })))))), (0, rxjs_1.switchMap)(() => this.handleSpecialCases(type, key, value)));
    }
    handleSpecialCases(type, key, value) {
        if (type === 'armingState' && key === 'state') {
            const keyName = 'remainingTimeUntilArmed';
            const stateId = `${this.folderName}.${type}.${keyName}`;
            const role = bshb_definition_1.BshbDefinition.determineRole(type, keyName, 0);
            const unit = bshb_definition_1.BshbDefinition.determineUnit(type, keyName);
            const states = bshb_definition_1.BshbDefinition.determineStates(type, keyName);
            return this.setObjectNotExistsAsync(stateId, {
                type: 'state',
                common: {
                    name: key,
                    type: 'number',
                    role: role,
                    read: true,
                    write: false,
                    unit: unit,
                    states: states
                },
                native: {},
            }).pipe((0, rxjs_1.tap)(() => {
                if (value === 'SYSTEM_DISARMED' || value === 'SYSTEM_ARMED') {
                    this.bshb.setState(stateId, {
                        val: this.mapValueToStorage(value === 'SYSTEM_DISARMED' ? -1 : 0),
                        ack: true,
                    });
                }
            }));
        }
        else {
            return rxjs_1.EMPTY;
        }
    }
    detectIntrusionDetectionControl(activateProfile, armingState) {
        return this.setObjectNotExistsAsync(this.folderName, {
            type: 'folder',
            common: {
                name: 'Intrusion Detection Control',
                read: true,
            },
            native: {
                id: this.folderName,
            },
        }).pipe((0, rxjs_1.switchMap)(() => {
            const idPrefix = this.folderName + '.';
            const observables = [];
            // full
            observables.push(this.addProfile(idPrefix, 'fullProtection', 'Full Protection', () => activateProfile === '0' && this.profileStatOk(armingState)));
            // partial
            observables.push(this.addProfile(idPrefix, 'partialProtection', 'Partial Protection', () => activateProfile === '1' && this.profileStatOk(armingState)));
            // individual
            observables.push(this.addProfile(idPrefix, 'individualProtection', 'Individual Protection', () => activateProfile === '2' && this.profileStatOk(armingState)));
            // disarm
            observables.push(this.addProfile(idPrefix, 'disarmProtection', 'Disarm Protection', () => armingState === 'SYSTEM_DISARMED'));
            // mute
            observables.push(this.addProfile(idPrefix, 'muteProtection', 'Mute Protection', () => armingState === 'MUTE_ALARM'));
            return (0, rxjs_1.concat)(...observables);
        }));
    }
    profileStatOk(armingState) {
        return armingState === 'SYSTEM_ARMED' || armingState === 'SYSTEM_ARMING';
    }
    addProfile(idPrefix, id, name, predicate) {
        return new rxjs_1.Observable(subscriber => {
            this.bshb.setObjectNotExists(idPrefix + id, {
                type: 'state',
                common: {
                    name: name,
                    type: 'boolean',
                    role: 'switch',
                    read: false,
                    write: true,
                },
                native: {
                    id: idPrefix + id,
                    name: name,
                },
            }, () => {
                this.bshb.setState(idPrefix + id, { val: predicate(), ack: true });
                subscriber.next();
                subscriber.complete();
            });
        });
    }
}
exports.BshbIntrusionDetection = BshbIntrusionDetection;
//# sourceMappingURL=bshb-intrusion-detection.js.map