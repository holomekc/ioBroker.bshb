"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbAirPurityGuardianHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const bshb_definition_1 = require("../../bshb-definition");
class BshbAirPurityGuardianHandler extends bshb_handler_1.BshbHandler {
    constructor() {
        super(...arguments);
        this.regex = /bshb\.\d+\.airPurityGuardian\.(.*)/;
        this.cachedStates = new Map();
    }
    handleDetection() {
        this.bshb.log.info('Start detecting air purity guardian...');
        return this.detectAirPurityGuardian().pipe((0, rxjs_1.tap)({
            complete: () => this.bshb.log.info('Detecting air purity guardian finished')
        }));
    }
    handleBshcUpdate(resultEntry) {
        if (resultEntry['@type'] === 'airPurityGuardian') {
            const idPrefix = `airPurityGuardian.${resultEntry.id}`;
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
                        this.bshb.log.warn(`Could not handle update for airPurityGuardian with id=${resultEntry.id}. ${error}`);
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
            const cachedState = this.cachedStates.get(id);
            const data = {};
            this.mapValueFromStorage(id, state.val).pipe((0, rxjs_1.map)(mappedValue => data[cachedState.key] = mappedValue), (0, rxjs_1.switchMap)(() => this.getBshcClient().updateAirPurityGuardian(cachedState.id, data, { timeout: this.long_timeout }))).subscribe({
                next: () => {
                    // nothing so far
                },
                error: error => {
                    this.bshb.log.warn(`Could not send update for airPurityGuardian with id=${match[1]} and value=${state.val}: ${error}`);
                }
            });
            return true;
        }
        return false;
    }
    detectAirPurityGuardian() {
        return this.setObjectNotExistsAsync('airPurityGuardian', {
            type: 'folder',
            common: {
                name: 'airPurityGuardian',
                read: true
            },
            native: {}
        }).pipe((0, rxjs_1.switchMap)(() => this.getBshcClient().getAirPurityGuardian({ timeout: this.long_timeout })), (0, rxjs_1.mergeMap)(response => (0, rxjs_1.from)(response.parsedResponse)), (0, rxjs_1.mergeMap)(airPurityGuardian => this.addAirPurityGuardian(airPurityGuardian)), (0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    addAirPurityGuardian(airPurityGuardian) {
        return this.setObjectNotExistsAsync(`airPurityGuardian.${airPurityGuardian.id}`, {
            type: 'channel',
            common: {
                name: airPurityGuardian.name
            },
            native: {}
        }).pipe((0, rxjs_1.mergeMap)(() => (0, rxjs_1.from)(Object.keys(airPurityGuardian))), (0, rxjs_1.mergeMap)(key => this.importState(key, airPurityGuardian)));
    }
    importState(key, airPurityGuardian) {
        if (key === '@type' || key === 'name' || key === 'id') {
            return (0, rxjs_1.of)(undefined);
        }
        const id = `airPurityGuardian.${airPurityGuardian.id}.${key}`;
        const value = airPurityGuardian[key];
        this.cachedStates.set(`${this.bshb.namespace}.${id}`, {
            id: airPurityGuardian.id,
            key: key
        });
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: key,
                type: bshb_definition_1.BshbDefinition.determineType(value),
                role: bshb_definition_1.BshbDefinition.determineRole('airPurityGuardian', key, value),
                read: true,
                write: true
            },
            native: {}
        }).pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getStateAsync(id))), (0, rxjs_1.switchMap)(state => this.setInitialStateValueIfNotSet(id, state, value)));
    }
}
exports.BshbAirPurityGuardianHandler = BshbAirPurityGuardianHandler;
//# sourceMappingURL=bshb-air-purity-guardian-handler.js.map