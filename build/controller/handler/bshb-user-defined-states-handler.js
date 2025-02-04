"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbUserDefinedStatesHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
/**
 * This handler is used to detect user defined states of bshc
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
class BshbUserDefinedStatesHandler extends bshb_handler_1.BshbHandler {
    userDefinedStateRegex = /bshb\.\d+\.userDefinedStates\.(.*)/;
    handleDetection() {
        return this.detectUserDefinedStates().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting user defined states...'),
            finalize: () => this.bshb.log.info('Detecting user defined states finished'),
        }));
    }
    handleBshcUpdate(resultEntry) {
        if (resultEntry['@type'] === 'userDefinedState') {
            this.bshb.log.debug(`Received updated for user defined state id=${resultEntry['id']} and value=${resultEntry['state']}`);
            const id = `userDefinedStates.${resultEntry['id']}`;
            (0, rxjs_1.from)(this.bshb.setState(id, { val: resultEntry['state'], ack: true })).subscribe(this.handleBshcUpdateError(`id=${resultEntry['id']}`));
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        const match = this.userDefinedStateRegex.exec(id);
        let result = (0, rxjs_1.of)(false);
        if (match) {
            this.bshb.log.debug(`Found user defined state with id=${match[1]} and value=${state.val}`);
            result = this.getBshcClient()
                .setUserDefinedState(match[1], state.val, {
                timeout: this.long_timeout,
            })
                .pipe((0, rxjs_1.tap)(this.handleBshcSendError(`id=${match[1]}, value=${state.val}`)), (0, rxjs_1.map)(() => true));
        }
        return result;
    }
    detectUserDefinedStates() {
        return this.setObjectNotExistsAsync('userDefinedStates', {
            type: 'folder',
            common: {
                name: 'userDefinedStates',
                read: true,
            },
            native: {
                id: 'userDefinedStates',
            },
        }).pipe((0, rxjs_1.switchMap)(() => this.getBshcClient().getUserDefinedStates(undefined, {
            timeout: this.long_timeout,
        })), (0, rxjs_1.switchMap)(response => this.deleteMissingUserDefinedStates(response.parsedResponse).pipe((0, rxjs_1.last)(undefined, void 0), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(response.parsedResponse)))), (0, rxjs_1.mergeMap)(userDefinedState => {
            this.bshb.log.debug(`Found user defined state ${userDefinedState.id}, ${userDefinedState.name}`);
            const id = 'userDefinedStates.' + userDefinedState.id;
            // we overwrite object here on purpose because we reflect 1-1 the data from controller here.
            return (0, rxjs_1.from)(this.bshb.setObject(id, {
                type: 'state',
                common: {
                    name: userDefinedState.name,
                    type: 'boolean',
                    role: 'switch',
                    write: true,
                    read: true,
                },
                native: {
                    id: userDefinedState.id,
                    name: userDefinedState.name,
                },
            })).pipe((0, rxjs_1.tap)(() => this.bshb.setState(id, { val: userDefinedState.state, ack: true })));
        }), (0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    deleteMissingUserDefinedStates(userDefinedStates) {
        return (0, rxjs_1.from)(this.bshb.getStatesOfAsync('userDefinedStates', '')).pipe((0, rxjs_1.switchMap)(objects => (0, rxjs_1.from)(objects)), (0, rxjs_1.switchMap)(object => {
            let found = false;
            for (let i = 0; i < userDefinedStates.length; i++) {
                if (object.native.id === userDefinedStates[i].id) {
                    // found userDefinedState
                    found = true;
                    break;
                }
            }
            if (!found) {
                return (0, rxjs_1.from)(this.bshb.delObjectAsync(`userDefinedStates.${object.native.id}`)).pipe((0, rxjs_1.tap)(() => this.bshb.log.info(`User defined state with id=${object.native.id} removed because it does not exist anymore.`)), (0, operators_1.catchError)(err => {
                    this.bshb.log.error(`Could not delete user defined state with id=${object.native.id} because: ` + err);
                    return (0, rxjs_1.of)(undefined);
                }));
            }
            else {
                return (0, rxjs_1.of)(undefined);
            }
        }));
    }
    name() {
        return 'userDefinedStatesHandler';
    }
}
exports.BshbUserDefinedStatesHandler = BshbUserDefinedStatesHandler;
//# sourceMappingURL=bshb-user-defined-states-handler.js.map
