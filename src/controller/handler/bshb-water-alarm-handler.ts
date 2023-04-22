import {BshbHandler} from './bshb-handler';
import {from, map, merge, mergeMap, Observable, of, switchMap, tap, zip} from 'rxjs';
import {BshbDefinition} from '../../bshb-definition';

export class BshbWaterAlarmHandler extends BshbHandler {

    private regex = /bshb\.\d+\.waterAlarm\..*/;
    private cachedStates = new Map<string, any>();

    handleDetection(): Observable<void> {
        return this.detectWaterAlarm().pipe(
            switchMap(() => this.createMuteAction()),
            tap({
                subscribe: () => this.bshb.log.info('Start detecting water alarm...'),
                finalize: () => this.bshb.log.info('Detecting water alarm finished')
            })
        );
    }

    handleBshcUpdate(resultEntry: any): boolean {
        // I am not sure about this. I cannot really test this. I would need to buy a compatible device to test this.
        if (resultEntry['@type'] === 'waterAlarmSystemState' || resultEntry['@type'] === 'waterAlarmSystemConfiguration') {

            const idPrefix = 'waterAlarm.waterAlarmSystemState';

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
                        this.bshb.log.warn(`Could not handle update for waterAlarmSystemState. ${error}`);
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
            if(id === `${this.bshb.namespace}.waterAlarm.waterAlarmSystemState.mute`) {
                this.getBshcClient().muteWaterAlarm({timeout: this.long_timeout}).subscribe({
                    next: () => {
                        this.bshb.setState(id, {val: false, ack: true});
                    },
                    error: error => {
                        this.bshb.log.warn(`Could not mute water alarm: ${error}`);
                    }
                });
            } else {

                zip(
                    from(this.bshb.getStateAsync('waterAlarm.waterAlarmSystemState.visualActuatorsAvailable')),
                    from(this.bshb.getStateAsync('waterAlarm.waterAlarmSystemState.videoActuatorsAvailable'))
                ).pipe(
                    switchMap(result => {
                        const data: any = {
                            visualActuatorsAvailable: result[0] ? result[0].val : false,
                            videoActuatorsAvailable: result[1] ? result[1].val : false,
                        };
                        return this.getBshcClient().updateWaterAlarm(data, {timeout: this.long_timeout});
                    })
                ).subscribe({
                    next: () => {
                        // nothing so far
                    },
                    error: error => {
                        this.bshb.log.warn(`Could not send update for waterAlarmSystemState and value=${state.val}: ${error}`);
                    }
                });
            }
            return true
        }
        return false;
    }

    private createMuteAction(): Observable<any> {
        const id = 'waterAlarm.waterAlarmSystemState.mute';
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: 'Mute',
                type: 'boolean',
                role: 'switch',
                read: false,
                write: true
            },
            native: {}
        }).pipe(
            switchMap(() => from(this.bshb.getStateAsync(id))),
            switchMap(state => this.setInitialStateValueIfNotSet(id, state, false))
        );
    }

    private detectWaterAlarm(): Observable<void> {
        return this.setObjectNotExistsAsync('waterAlarm', {
            type: 'folder',
            common: {
                name: 'WaterAlarm',
                read: true
            },
            native: {}
        }).pipe(
            switchMap(() => this.getBshcClient().getWaterAlarm({timeout: this.long_timeout})),
            map(response => response.parsedResponse),
            switchMap(waterAlarm => this.addWaterAlarm(waterAlarm)),
            switchMap(() => of(undefined))
        );
    }

    private addWaterAlarm(waterAlarm: any): Observable<any> {
        return this.setObjectNotExistsAsync('waterAlarm.waterAlarmSystemState', {
            type: 'channel',
            common: {
                name: 'WaterAlarmSystemState'
            },
            native: {}
        }).pipe(
            mergeMap(() => from(Object.keys(waterAlarm))),
            mergeMap(key => this.importState(key, waterAlarm))
        );
    }

    private importState(key: string, waterAlarm: any): Observable<any> {
        if (key === '@type') {
            return of(undefined);
        }

        const id = `waterAlarm.waterAlarmSystemState.${key}`;
        const value = waterAlarm[key];
        this.cachedStates.set(`${this.bshb.namespace}.${id}`, {
            key: key
        });
        return this.setObjectNotExistsAsync(id, {
            type: 'state',
            common: {
                name: key,
                type: BshbDefinition.determineType(value),
                role: BshbDefinition.determineRole('waterAlarmSystemState', key, value),
                read: true,
                write: BshbDefinition.determineWrite('waterAlarmSystemState', key),
                states: BshbDefinition.determineStates('waterAlarmSystemState', key)
            },
            native: {}
        }).pipe(
            switchMap(() => from(this.bshb.getStateAsync(id))),
            switchMap(state => this.setInitialStateValueIfNotSet(id, state, value))
        );
    }
}
