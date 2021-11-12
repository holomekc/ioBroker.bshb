import {BshbHandler} from './bshb-handler';
import {Observable, of, from, tap, switchMap, mergeMap, last} from 'rxjs';
import {catchError, delay} from 'rxjs/operators';

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

        return this.detectScenarios().pipe(tap({
            complete: () => this.bshb.log.info('Detecting scenarios finished')
        }));
    }

    public handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry['@type'] === 'scenario') {

            this.bshb.log.debug('Updating scenarios...');
            // we just trigger detection on changes of scenarios
            this.detectScenarios().subscribe({
                next: () => {
                    // we do nothing here because we do not need to.
                    this.bshb.log.debug('Updating scenarios finished');
                }, error: error => {
                    this.bshb.log.warn('something went wrong during scenario detection');
                    this.bshb.log.warn(error);
                }
            });

            return true;
        } else if (resultEntry['@type'] === 'scenarioTriggered') {
            // Shortly mark scenario as true and then after 1s switch back to false
            const id = `scenarios.${resultEntry['id']}`;
            from(this.bshb.setStateAsync(id, {val: true, ack: true})).pipe(
                delay(1000),
                switchMap(() => from(this.bshb.setStateAsync(id, {
                    val: false,
                    ack: true
                })))
            ).subscribe({
                next: () => {
                    // we do nothing here because we do not need to.
                    this.bshb.log.debug(`Scenario with id=${resultEntry['id']} was triggered.`);
                }, error: error => {
                    this.bshb.log.warn('Error occurred while updating scenario after it receiving trigger.');
                    this.bshb.log.warn(error);
                }
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
                this.getBshcClient().triggerScenario(match[1]).subscribe({
                    next: () => {
                        this.bshb.log.info(`Scenario with id=${match[1]} triggered`);
                    }, error: error => {
                        this.bshb.log.warn(`Could not send trigger for scenario with id=${match[1]} and value=${state.val}: ` + error)
                    }
                });
            }
            return true;
        }

        return false;
    }

    private detectScenarios(): Observable<void> {
        return from(this.bshb.setObjectNotExistsAsync('scenarios', {
            type: 'folder',
            common: {
                name: 'scenarios',
                read: true
            },
            native: {
                id: 'scenarios'
            },
        })).pipe(
            switchMap(() => this.getBshcClient().getScenarios({timeout: this.long_timeout})),
            switchMap(response =>
                this.deleteMissingScenarios((response.parsedResponse)).pipe(
                    last(undefined, void 0),
                    switchMap(() => from(response.parsedResponse)))
            ),
            mergeMap(scenario => {
                this.bshb.log.debug(`Found scenario ${scenario.id}, ${scenario.name}`);
                const id = 'scenarios.' + scenario.id;

                // we overwrite object here on purpose because we reflect 1-1 the data from controller here.
                return from(this.bshb.setObjectAsync(id, {
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
                })).pipe(tap(() => this.bshb.setState(id, {val: false, ack: true})))
            }),
            switchMap(() => of(undefined))
        );
    }

    private deleteMissingScenarios(scenarios: any[]): Observable<void> {
        return from(this.bshb.getStatesOfAsync('scenarios', undefined as unknown as string)).pipe(
            switchMap(objects => from(objects)),
            switchMap(object => {
                let found = false;
                for (let i = 0; i < scenarios.length; i++) {
                    if (object.native.id === scenarios[i].id) {
                        // found scenario
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    return from(this.bshb.deleteStateAsync('scenarios', undefined as unknown as string, object.native.id)).pipe(
                        tap(() => this.bshb.log.info(`scenario with id=${object.native.id} removed because it does not exist anymore.`)),
                        catchError(err => {
                            this.bshb.log.error(`Could not delete scenario with id=${object.native.id} because: ` + err);
                            return of(undefined);
                        }));
                } else {
                    return of(undefined);
                }
            })
        );
    }
}