import {BshbHandler} from './bshb-handler';
import {from, last, map, mergeMap, Observable, of, switchMap, tap} from 'rxjs';
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
        return this.detectScenarios().pipe(tap({
            subscribe: () => this.bshb.log.info('Start detecting scenarios...'),
            finalize: () => this.bshb.log.info('Detecting scenarios finished')
        }));
    }

    public handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry['@type'] === 'scenario') {

            this.bshb.log.debug('Updating scenarios...');
            // we just trigger detection on changes of scenarios
            this.detectScenarios().subscribe(this.handleBshcUpdateError());

            return true;
        } else if (resultEntry['@type'] === 'scenarioTriggered') {
            // Shortly mark scenario as true and then after 1s switch back to false
            const id = `scenarios.${resultEntry['id']}`;
            from(this.bshb.setState(id, {val: true, ack: true})).pipe(
                delay(1000),
                switchMap(() => from(this.bshb.setState(id, {
                    val: false,
                    ack: true
                })))
            ).subscribe(this.handleBshcUpdateError(`id=${resultEntry['id']}`));
            return true;
        }
        return false;
    }

    public sendUpdateToBshc(id: string, state: ioBroker.State): Observable<boolean> {
        const match = this.scenarioRegex.exec(id);

        let result = of(false);

        if (match) {
            this.bshb.log.debug(`Found scenario trigger with id=${match[1]} and value=${state.val}`);
            if (state.val) {
                result = this.getBshcClient().triggerScenario(match[1], {timeout: this.long_timeout})
                    .pipe(
                        tap(this.handleBshcSendError(`id=${match[1]}, value=${state.val}`)),
                        map(() => true)
                    );
            } else {
                result = of(true);
            }
        }

        return result;
    }

    private detectScenarios(): Observable<void> {
        return this.setObjectNotExistsAsync('scenarios', {
            type: 'folder',
            common: {
                name: 'scenarios',
                read: true
            },
            native: {
                id: 'scenarios'
            },
        }).pipe(
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
                return from(this.bshb.setObject(id, {
                    type: 'state',
                    common: {
                        name: scenario.name,
                        type: 'boolean',
                        role: 'switch',
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
        return from(this.bshb.getStatesOfAsync('scenarios', '')).pipe(
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
                    return from(this.bshb.delObjectAsync(`scenarios.${object.native.id}`)).pipe(
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

    name(): string {
        return 'scenarioHandler';
    }
}