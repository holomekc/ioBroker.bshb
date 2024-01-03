import {BshbHandler} from './bshb-handler';
import {from, map, mergeMap, Observable, of, switchMap, tap} from 'rxjs';
import {BshbDefinition} from '../../bshb-definition';

export class BshbMotionLightsHandler extends BshbHandler {

    private regex = /bshb\.\d+\.motionlight\.(.*)/;
    private cachedStates = new Map<string, any>();

    handleDetection(): Observable<void> {
        return this.detectMotionLights().pipe(tap({
            subscribe: () => this.bshb.log.info('Start detecting motion lights...'),
            finalize: () => this.bshb.log.info('Detecting motion lights finished')
        }));
    }

    handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry['@type'] === 'motionlight') {

            const idPrefix = `motionlight.${resultEntry.id}`;

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
                ).subscribe(this.handleBshcUpdateError(`id=${resultEntry.id}`));
            });
            return true;
        }
        return false;
    }


    sendUpdateToBshc(id: string, state: ioBroker.State): Observable<boolean> {
        const match = this.regex.exec(id);

        let result = of(false);

        if (match) {
            const cachedState = this.cachedStates.get(id);
            const data: any = {};

            result = this.mapValueFromStorage(id, state.val).pipe(
                map(mappedValue => data[cachedState.key] = mappedValue),
                switchMap(() => this.getBshcClient().updateMotionLights(cachedState.id, data, {timeout: this.long_timeout}))
            ).pipe(
                tap(this.handleBshcSendError(`id=${match[1]}, value=${state.val}`)),
                map(() => true)
            );
        }
        return result;
    }

    private detectMotionLights(): Observable<void> {
        return this.setObjectNotExistsAsync('motionlight', {
            type: 'folder',
            common: {
                name: 'motionlight',
                read: true
            },
            native: {}
        }).pipe(
            switchMap(() => this.getBshcClient().getMotionLights({timeout: this.long_timeout})),
            mergeMap(response => from(response.parsedResponse)),
            mergeMap(waterLight => this.addMotionLight(waterLight)),
            switchMap(() => of(undefined))
        );
    }

    private addMotionLight(motionLight: any): Observable<any> {
        return this.getBshcClient().getDevice(motionLight.id).pipe(
            map(response => response.parsedResponse),
            switchMap(device => this.setObjectNotExistsAsync(`motionlight.${motionLight.id}`, {
                type: 'channel',
                common: {
                    name: device ? device.name : motionLight.id
                },
                native: {}
            })),
            mergeMap(() => from(Object.keys(motionLight))),
            mergeMap(key => this.importState(key, motionLight))
        )
    }

    private importState(key: string, motionLight: any): Observable<any> {
        if (key === '@type' || key === 'id' || key === 'motionDetectorId') {
            return of(undefined);
        }

        const id = `motionlight.${motionLight.id}.${key}`;
        const value = motionLight[key];
        this.cachedStates.set(`${this.bshb.namespace}.${id}`, {
            id: motionLight.id,
            key: key
        });
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: key,
                type: BshbDefinition.determineType(value),
                role: BshbDefinition.determineRole('motionlight', key, value),
                read: true,
                write: true
            },
            native: {}
        }).pipe(
            switchMap(() => from(this.bshb.getStateAsync(id))),
            switchMap(state => this.setInitialStateValueIfNotSet(id, state, value))
        );
    }

    name(): string {
        return 'motionLightsHandler';
    }
}
