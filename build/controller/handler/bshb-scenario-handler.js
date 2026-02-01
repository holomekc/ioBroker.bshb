"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbScenarioHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
/**
 * This handler is used to detect scenarios of bshc
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
class BshbScenarioHandler extends bshb_handler_1.BshbHandler {
    scenarioRegex = /bshb\.\d+\.scenarios\.(.*)/;
    handleDetection() {
        return this.detectScenarios().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting scenarios...'),
            finalize: () => this.bshb.log.info('Detecting scenarios finished'),
        }));
    }
    handleBshcUpdate(resultEntry) {
        if (resultEntry['@type'] === 'scenario') {
            this.bshb.log.debug('Updating scenarios...');
            // we just trigger detection on changes of scenarios
            this.detectScenarios().subscribe(this.handleBshcUpdateError());
            return true;
        }
        else if (resultEntry['@type'] === 'scenarioTriggered') {
            // Shortly mark scenario as true and then after 1s switch back to false
            const id = `scenarios.${resultEntry['id']}`;
            (0, rxjs_1.from)(this.bshb.setState(id, { val: true, ack: true }))
                .pipe((0, rxjs_1.delay)(1000), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.setState(id, {
                val: false,
                ack: true,
            }))))
                .subscribe(this.handleBshcUpdateError(`id=${resultEntry['id']}`));
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        const match = this.scenarioRegex.exec(id);
        let result = (0, rxjs_1.of)(false);
        if (match) {
            this.bshb.log.debug(`Found scenario trigger with id=${match[1]} and value=${state.val}`);
            if (state.val) {
                result = this.getBshcClient()
                    .triggerScenario(match[1], { timeout: this.long_timeout })
                    .pipe((0, rxjs_1.tap)(this.handleBshcSendError(`id=${match[1]}, value=${state.val}`)), (0, rxjs_1.map)(() => true));
            }
            else {
                result = (0, rxjs_1.of)(true);
            }
        }
        return result;
    }
    detectScenarios() {
        return this.setObjectNotExistsAsync('scenarios', {
            type: 'folder',
            common: {
                name: 'scenarios',
                read: true,
            },
            native: {
                id: 'scenarios',
            },
        }).pipe((0, rxjs_1.switchMap)(() => this.getBshcClient().getScenarios({ timeout: this.long_timeout })), (0, rxjs_1.switchMap)(response => this.deleteMissingScenarios(response.parsedResponse).pipe((0, rxjs_1.last)(undefined, void 0), (0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(response.parsedResponse)))), (0, rxjs_1.mergeMap)(scenario => {
            this.bshb.log.debug(`Found scenario ${scenario.id}, ${scenario.name || 'Unknown'}`);
            const id = 'scenarios.' + scenario.id;
            const scenarioName = scenario.name || scenario.id || 'Unknown';
            // we overwrite object here on purpose because we reflect 1-1 the data from controller here.
            return (0, rxjs_1.from)(this.bshb.setObject(id, {
                type: 'state',
                common: {
                    name: scenarioName,
                    type: 'boolean',
                    role: 'switch',
                    write: true,
                    read: false,
                },
                native: {
                    id: scenario.id,
                    name: scenarioName,
                },
            })).pipe((0, rxjs_1.tap)(() => this.bshb.setState(id, { val: false, ack: true })));
        }), (0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    deleteMissingScenarios(scenarios) {
        return (0, rxjs_1.from)(this.bshb.getStatesOfAsync('scenarios', '')).pipe((0, rxjs_1.switchMap)(objects => (0, rxjs_1.from)(objects)), (0, rxjs_1.switchMap)(object => {
            let found = false;
            for (let i = 0; i < scenarios.length; i++) {
                if (object.native.id === scenarios[i].id) {
                    // found scenario
                    found = true;
                    break;
                }
            }
            if (!found) {
                return (0, rxjs_1.from)(this.bshb.delObjectAsync(`scenarios.${object.native.id}`)).pipe((0, rxjs_1.tap)(() => this.bshb.log.info(`scenario with id=${object.native.id} removed because it does not exist anymore.`)), (0, rxjs_1.catchError)(err => {
                    this.bshb.log.error(`Could not delete scenario with id=${object.native.id} because: ` + err);
                    return (0, rxjs_1.of)(undefined);
                }));
            }
            else {
                return (0, rxjs_1.of)(undefined);
            }
        }));
    }
    name() {
        return 'scenarioHandler';
    }
}
exports.BshbScenarioHandler = BshbScenarioHandler;
//# sourceMappingURL=bshb-scenario-handler.js.map