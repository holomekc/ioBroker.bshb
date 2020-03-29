import {BshbHandler} from "./bshb-handler";
import {Observable} from "rxjs";

/**
 * This handler is used to detect scenarios of bshc
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
export class BshbScenarioHandler extends BshbHandler {
    private scenarioRegex = /bshb\.\d+\.scenarios\.(.*)/;

    public handleDetection(): Observable<void> {
        this.bshb.log.info('Start detecting scenarios...');

        // we need to do that because of concat
        return new Observable<void>(subscriber => {
            this.detectScenarios().subscribe(() => {
                this.bshb.log.info('Detecting scenarios finished');

                subscriber.next();
                subscriber.complete();
            });
        });
    }

    public handleBshcUpdate(resultEntry: any): boolean {
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

    public sendUpdateToBshc(id: string, state: ioBroker.State): boolean {
        const match = this.scenarioRegex.exec(id);

        if (match) {
            this.bshb.log.debug(`Found scenario trigger with id=${match[1]} and value=${state.val}`);
            if (state.val) {
                this.getBshcClient().triggerScenario(match[1]).subscribe(() => {
                    this.bshb.setState(id, {val: false, ack: true});
                }, error => {
                    this.bshb.log.warn(`Could not send trigger for scenario with id=${match[1]} and value=${state.val}`)
                });
            }
            return true;
        }

        return false;
    }

    private detectScenarios(): Observable<void> {
        return new Observable<void>(subscriber => {
            this.getBshcClient().getScenarios({timeout: this.long_timeout}).subscribe(response => {
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

                    this.bshb.setState(id, {val: false, ack: true});
                });

                subscriber.next();
                subscriber.complete();
            });
        });
    }

    private deleteMissingScenarios(scenarios: any[]) {
        this.bshb.getStatesOf('scenarios', undefined as unknown as string, (err, objects) => {
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
                        this.bshb.deleteState(object.native.id);
                        this.bshb.log.info(`scenario with id=${object.native.id} removed because it does not exist anymore.`);
                    }
                });
            }
        });
    }
}