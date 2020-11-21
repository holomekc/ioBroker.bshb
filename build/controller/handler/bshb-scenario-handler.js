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
    constructor() {
        super(...arguments);
        this.scenarioRegex = /bshb\.\d+\.scenarios\.(.*)/;
    }
    handleDetection() {
        this.bshb.log.info('Start detecting scenarios...');
        // we need to do that because of concat
        return new rxjs_1.Observable(subscriber => {
            this.detectScenarios().subscribe(() => {
                this.bshb.log.info('Detecting scenarios finished');
                subscriber.next();
                subscriber.complete();
            }, err => {
                subscriber.error(err);
            });
        });
    }
    handleBshcUpdate(resultEntry) {
        if (resultEntry['@type'] === 'scenario') {
            this.bshb.log.debug('Updating scenarios...');
            // we just trigger detection on changes of scenarios
            this.detectScenarios().subscribe(() => {
                // we do nothing here because we do not need to.
                this.bshb.log.debug('Updating scenarios finished');
            }, error => {
                this.bshb.log.warn('something went wrong during scenario detection');
                this.bshb.log.warn(error);
            });
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        const match = this.scenarioRegex.exec(id);
        if (match) {
            this.bshb.log.debug(`Found scenario trigger with id=${match[1]} and value=${state.val}`);
            if (state.val) {
                this.getBshcClient().triggerScenario(match[1]).subscribe(() => {
                    this.bshb.log.info(`Scenario with id=${match[1]} triggered`);
                    this.bshb.setState(id, { val: false, ack: true });
                }, error => {
                    this.bshb.log.warn(`Could not send trigger for scenario with id=${match[1]} and value=${state.val}`);
                });
            }
            return true;
        }
        return false;
    }
    detectScenarios() {
        return new rxjs_1.Observable(subscriber => {
            this.getBshcClient().getScenarios({ timeout: this.long_timeout }).subscribe(response => {
                const scenarios = response.parsedResponse;
                this.bshb.setObjectNotExists('scenarios', {
                    type: 'folder',
                    common: {
                        name: 'scenarios',
                        read: true
                    },
                    native: {
                        id: 'scenarios'
                    },
                });
                this.deleteMissingScenarios(scenarios);
                scenarios.forEach(scenario => {
                    // hmm do we want to see more?
                    const id = 'scenarios.' + scenario.id;
                    // we overwrite object here on purpose because we reflect 1-1 the data from controller here.
                    this.bshb.setObject(id, {
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
            }, err => {
                subscriber.error(err);
            });
        });
    }
    deleteMissingScenarios(scenarios) {
        this.bshb.getStatesOf('scenarios', undefined, (err, objects) => {
            if (objects) {
                objects.forEach(object => {
                    let found = false;
                    for (let i = 0; i < scenarios.length; i++) {
                        if (object.native.id === scenarios[i].id) {
                            // found scenario
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        // removed scenario
                        //this.bshb.namespace +
                        this.bshb.deleteState('scenarios', undefined, object.native.id, undefined, (err) => {
                            if (err) {
                                this.bshb.log.error(`Could not delete scenario with id=${object.native.id} because: ` + err);
                            }
                        });
                        this.bshb.log.info(`scenario with id=${object.native.id} removed because it does not exist anymore.`);
                    }
                });
            }
        });
    }
}
exports.BshbScenarioHandler = BshbScenarioHandler;
