import {BshbHandler} from './bshb-handler';
import {from, last, map, mergeMap, Observable, of, switchMap, tap} from 'rxjs';
import {catchError} from 'rxjs/operators';

/**
 * This handler is used to detect user defined states of bshc
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
export class BshbUserDefinedStatesHandler extends BshbHandler {
    private userDefinedStateRegex = /bshb\.\d+\.userDefinedStates\.(.*)/;

    public handleDetection(): Observable<void> {
        return this.detectUserDefinedStates().pipe(tap({
            subscribe: () => this.bshb.log.info('Start detecting user defined states...'),
            finalize: () => this.bshb.log.info('Detecting user defined states finished')
        }));
    }

    public handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry['@type'] === 'userDefinedState') {
            this.bshb.log.debug(`Received updated for user defined state id=${resultEntry['id']} and value=${resultEntry['state']}`);

            const id = `userDefinedStates.${resultEntry['id']}`;
            from(this.bshb.setState(id, {val: resultEntry['state'], ack: true}))
                .subscribe(this.handleBshcUpdateError(`id=${resultEntry['id']}`));
            return true;
        }
        return false;
    }

    public sendUpdateToBshc(id: string, state: ioBroker.State): Observable<boolean> {
        const match = this.userDefinedStateRegex.exec(id);

        let result = of(false);

        if (match) {
            this.bshb.log.debug(`Found user defined state with id=${match[1]} and value=${state.val}`);
            result = this.getBshcClient().setUserDefinedState(
                match[1], state.val as boolean, {timeout: this.long_timeout}
            ).pipe(
                tap(this.handleBshcSendError(`id=${match[1]}, value=${state.val}`)),
                map(() => true)
            );
        }

        return result;
    }

    private detectUserDefinedStates(): Observable<void> {
        return this.setObjectNotExistsAsync('userDefinedStates', {
            type: 'folder',
            common: {
                name: 'userDefinedStates',
                read: true
            },
            native: {
                id: 'userDefinedStates'
            },
        }).pipe(
            switchMap(() => this.getBshcClient().getUserDefinedStates(undefined, {timeout: this.long_timeout})),
            switchMap(response =>
                this.deleteMissingUserDefinedStates((response.parsedResponse)).pipe(
                    last(undefined, void 0),
                    switchMap(() => from(response.parsedResponse)))
            ),
            mergeMap(userDefinedState => {
                this.bshb.log.debug(`Found user defined state ${userDefinedState.id}, ${userDefinedState.name}`);
                const id = 'userDefinedStates.' + userDefinedState.id;

                // we overwrite object here on purpose because we reflect 1-1 the data from controller here.
                return from(this.bshb.setObject(id, {
                    type: 'state',
                    common: {
                        name: userDefinedState.name,
                        type: 'boolean',
                        role: 'switch',
                        write: true,
                        read: true
                    },
                    native: {
                        id: userDefinedState.id,
                        name: userDefinedState.name
                    },
                })).pipe(tap(() => this.bshb.setState(id, {val: userDefinedState.state, ack: true})))
            }),
            switchMap(() => of(undefined))
        );
    }

    private deleteMissingUserDefinedStates(userDefinedStates: any[]): Observable<void> {
        return from(this.bshb.getStatesOfAsync('userDefinedStates', '')).pipe(
            switchMap(objects => from(objects)),
            switchMap(object => {
                let found = false;
                for (let i = 0; i < userDefinedStates.length; i++) {
                    if (object.native.id === userDefinedStates[i].id) {
                        // found userDefinedState
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    return from(this.bshb.delObjectAsync(`userDefinedStates.${object.native.id}`)).pipe(
                        tap(() => this.bshb.log.info(
                            `User defined state with id=${object.native.id} removed because it does not exist anymore.`
                        )),
                        catchError(err => {
                            this.bshb.log.error(`Could not delete user defined state with id=${object.native.id} because: ` + err);
                            return of(undefined);
                        }));
                } else {
                    return of(undefined);
                }
            })
        );
    }

    name(): string {
        return 'userDefinedStatesHandler';
    }
}