"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbAirPurityGuardianHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const bshb_definition_1 = require("../../bshb-definition");
const operators_1 = require("rxjs/operators");
class BshbAirPurityGuardianHandler extends bshb_handler_1.BshbHandler {
    regex = /bshb\.\d+\.airPurityGuardian\.(.*)/;
    roomRegex = /^airPurityGuardian_(.*)$/;
    cachedStates = new Map();
    handleDetection() {
        return this.detectAirPurityGuardian().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting air purity guardian...'),
            finalize: () => this.bshb.log.info('Detecting air purity guardian finished'),
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
                            ack: true,
                        });
                        return (0, rxjs_1.of)(undefined);
                    }
                    else {
                        return this.importState(key, resultEntry);
                    }
                })).subscribe(this.handleBshcUpdateError(`id=${resultEntry.id}`));
            });
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        const match = this.regex.exec(id);
        let result = (0, rxjs_1.of)(false);
        if (match) {
            const cachedState = this.cachedStates.get(id);
            const data = {};
            return this.mapValueFromStorage(id, state.val).pipe((0, rxjs_1.map)(mappedValue => data[cachedState.key] = mappedValue), (0, rxjs_1.switchMap)(() => this.getBshcClient().updateAirPurityGuardian(cachedState.id, data, { timeout: this.long_timeout }))).pipe((0, rxjs_1.tap)(this.handleBshcSendError(`id=${match[1]}, value=${state.val}`)), (0, rxjs_1.map)(() => true));
        }
        return result;
    }
    detectAirPurityGuardian() {
        return this.setObjectNotExistsAsync('airPurityGuardian', {
            type: 'folder',
            common: {
                name: 'airPurityGuardian',
                read: true,
            },
            native: {},
        }).pipe((0, rxjs_1.switchMap)(() => this.getBshcClient().getAirPurityGuardian({ timeout: this.long_timeout })), (0, rxjs_1.mergeMap)(response => (0, rxjs_1.from)(response.parsedResponse)), (0, rxjs_1.mergeMap)(airPurityGuardian => this.addAirPurityGuardian(airPurityGuardian)), (0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    addAirPurityGuardian(airPurityGuardian) {
        const match = this.roomRegex.exec(airPurityGuardian.id);
        let roomAndFunctions;
        if (match) {
            roomAndFunctions = this.getBshcClient().getRoom(match ? match[1] : match[1]).pipe((0, rxjs_1.map)(response => response.parsedResponse), (0, operators_1.catchError)(() => (0, rxjs_1.of)(undefined)));
        }
        else {
            roomAndFunctions = (0, rxjs_1.throwError)(() => new Error('No room could be extracted from airPurityGuardian.'));
        }
        return (0, rxjs_1.zip)(this.setObjectNotExistsAsync(`airPurityGuardian.${airPurityGuardian.id}`, {
            type: 'channel',
            common: {
                name: airPurityGuardian.name,
            },
            native: {},
        }), roomAndFunctions).pipe((0, rxjs_1.tap)(objAndRoom => {
            const obj = objAndRoom[0];
            const room = objAndRoom[1];
            if (obj && room && obj._bshbCreated) {
                this.addRoomEnum(room.name, 'airPurityGuardian', airPurityGuardian.id, undefined);
                this.addFunctionEnum(bshb_definition_1.BshbDefinition.determineFunction('airPurityGuardian'), 'airPurityGuardian', airPurityGuardian.id, undefined);
            }
        }), (0, rxjs_1.mergeMap)(() => (0, rxjs_1.from)(Object.keys(airPurityGuardian))), (0, rxjs_1.mergeMap)(key => this.importState(key, airPurityGuardian)));
    }
    importState(key, airPurityGuardian) {
        if (key === '@type' || key === 'name' || key === 'id') {
            return (0, rxjs_1.of)(undefined);
        }
        const id = `airPurityGuardian.${airPurityGuardian.id}.${key}`;
        const value = airPurityGuardian[key];
        this.cachedStates.set(`${this.bshb.namespace}.${id}`, {
            id: airPurityGuardian.id,
            key: key,
        });
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: key,
                type: bshb_definition_1.BshbDefinition.determineType(value),
                role: bshb_definition_1.BshbDefinition.determineRole('airPurityGuardian', key, value),
                read: true,
                write: true,
            },
            native: {},
        }).pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getStateAsync(id))), (0, rxjs_1.switchMap)(state => this.setInitialStateValueIfNotSet(id, state, value)));
    }
    name() {
        return 'airPurityGuardianHander';
    }
}
exports.BshbAirPurityGuardianHandler = BshbAirPurityGuardianHandler;
//# sourceMappingURL=bshb-air-purity-guardian-handler.js.map