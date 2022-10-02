import {BshbHandler} from './bshb-handler';
import {from, map, mergeMap, Observable, of, switchMap, tap} from 'rxjs';
import {BshbDefinition} from '../../bshb-definition';

export class BshbAirPurityGuardianHandler extends BshbHandler {

    private regex = /bshb\.\d+\.airPurityGuardian\.(.*)/;
    private cachedStates = new Map<string, any>();

    handleDetection(): Observable<void> {
        this.bshb.log.info('Start detecting air purity guardian...');

        return this.detectAirPurityGuardian().pipe(tap({
            complete: () => this.bshb.log.info('Detecting air purity guardian finished')
        }));
    }

    handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry['@type'] === 'airPurityGuardian') {

            const idPrefix = `airPurityGuardian.${resultEntry.id}`;

            Object.keys(resultEntry).forEach(key => {
                const id = `${idPrefix}.${key}`;
                from(this.bshb.getObjectAsync(id)).pipe(
                    switchMap(obj => {
                        if (obj) {
                            this.bshb.setState(id, {
                                val: this.mapValueToStorage(resultEntry[key]),
                                ack: true
                            });
                            return of(undefined);
                        } else {
                            return this.importState(key, resultEntry);
                        }
                    })
                ).subscribe({
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


    sendUpdateToBshc(id: string, state: ioBroker.State): boolean {
        const match = this.regex.exec(id);

        if (match) {
            const cachedState = this.cachedStates.get(id);
            const data: any = {};

            this.mapValueFromStorage(id, state.val).pipe(
                map(mappedValue => data[cachedState.key] = mappedValue),
                switchMap(() => this.getBshcClient().updateAirPurityGuardian(cachedState.id, data, {timeout: this.long_timeout}))
            ).subscribe({
                next: () => {
                    // nothing so far
                },
                error: error => {
                    this.bshb.log.warn(`Could not send update for airPurityGuardian with id=${match[1]} and value=${state.val}: ${error}`);
                }
            });
            return true
        }
        return false;
    }

    private detectAirPurityGuardian(): Observable<void> {
        return this.setObjectNotExistsAsync('airPurityGuardian', {
            type: 'folder',
            common: {
                name: 'airPurityGuardian',
                read: true
            },
            native: {}
        }).pipe(
            switchMap(() => this.getBshcClient().getAirPurityGuardian({timeout: this.long_timeout})),
            mergeMap(response => from(response.parsedResponse)),
            mergeMap(airPurityGuardian => this.addAirPurityGuardian(airPurityGuardian)),
            switchMap(() => of(undefined))
        );
    }

    private addAirPurityGuardian(airPurityGuardian: any): Observable<any> {
        return this.setObjectNotExistsAsync(`airPurityGuardian.${airPurityGuardian.id}`, {
            type: 'channel',
            common: {
                name: airPurityGuardian.name
            },
            native: {}
        }).pipe(
            mergeMap(() => from(Object.keys(airPurityGuardian))),
            mergeMap(key => this.importState(key, airPurityGuardian))
        );
    }

    private importState(key: string, airPurityGuardian: any): Observable<any> {
        if (key === '@type' || key === 'name' || key === 'id') {
            return of(undefined);
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
                type: BshbDefinition.determineType(value),
                role: BshbDefinition.determineRole('airPurityGuardian', key, value),
                read: true,
                write:  true
            },
            native: {}
        }).pipe(
            switchMap(() => from(this.bshb.getStateAsync(id))),
            switchMap(state => this.setInitialStateValueIfNotSet(id, state, value))
        );
    }
}
