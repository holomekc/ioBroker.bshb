import {BshbHandler} from './bshb-handler';
import {concat, EMPTY, from, last, map, mergeMap, Observable, of, switchMap, tap} from 'rxjs';
import {BshbDefinition} from '../../bshb-definition';
import {BshbResponse} from 'bosch-smart-home-bridge/dist/bshb-response';

export class BshbIntrusionDetectionHandler extends BshbHandler {
    private readonly folderName: string = 'intrusionDetectionControl';
    private intrusionDetectionControlRegex = /bshb\.\d+\.intrusionDetectionControl\.(.*)/;


    handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry.id === 'IntrusionDetectionControl') {
            const activeProfile = resultEntry.state?.activeProfile;
            const state = resultEntry.state?.value;
            this.detectIntrusionDetectionControl(activeProfile, state).subscribe();

            return true;
        } else if (resultEntry['@type'] === 'systemAvailability' ||
            resultEntry['@type'] === 'armingState' ||
            resultEntry['@type'] === 'alarmState' ||
            resultEntry['@type'] === 'activeConfigurationProfile' ||
            resultEntry['@type'] === 'securityGapState') {
            from(this.flattenData(resultEntry['@type'], resultEntry)).pipe(
                mergeMap(d => this.detectIntrusionData(d.type, d.key, d.value)),
            ).subscribe(this.handleBshcUpdateError(`id=${resultEntry.id}`));
        }

        return false;
    }

    handleDetection(): Observable<any> {
        return this.getBshcClient().getIntrusionDetectionSystemState().pipe(
            tap({
                subscribe: () => this.bshb.log.info('Start detecting intrusion detection system...'),
            }),
            map(r => r.parsedResponse),
            switchMap(data => this.detectIntrusionDetectionControl(data.activeConfigurationProfile,
                data.armingState?.state).pipe(
                last(),
                switchMap(() => {
                    const fl = this.flattenData('systemState', data);
                    return from(fl).pipe(
                        mergeMap(d => this.detectIntrusionData(d.type, d.key, d.value)),
                    );
                }),
            )),
            tap({
                finalize: () => this.bshb.log.info('Detecting intrusion detection system finished'),
            }),
        );
    }

    sendUpdateToBshc(id: string, state: ioBroker.State): Observable<boolean> {
        const match = this.intrusionDetectionControlRegex.exec(id);

        let result = of(false);

        if (match) {
            this.bshb.log.debug(`Found intrusionDetectionControl trigger with id=${match[1]}, value=${state.val}`);

            if (state.val) {
                const control = match[1];

                let command: Observable<BshbResponse<any>>;
                switch (control) {
                    case 'fullProtection':
                        command = this.getBshcClient().armIntrusionDetectionSystem(0, {timeout: this.long_timeout});
                        break;
                    case 'partialProtection':
                        command = this.getBshcClient().armIntrusionDetectionSystem(1, {timeout: this.long_timeout});
                        break;
                    case 'individualProtection':
                        command = this.getBshcClient().armIntrusionDetectionSystem(2, {timeout: this.long_timeout});
                        break;
                    case 'disarmProtection':
                        command = this.getBshcClient().disarmIntrusionDetectionSystem({timeout: this.long_timeout});
                        break;
                    case 'muteProtection':
                        command = this.getBshcClient().muteIntrusionDetectionSystem({timeout: this.long_timeout});
                        break;
                    default:
                        return of(false);
                }

                result = command.pipe(
                    tap(() => this.bshb.setState(id, {val: false, ack: true})),
                    tap(this.handleBshcSendError(`id=${match[1]}, value=${state.val}`)),
                    map(() => true)
                );
            }
        }

        return result;
    }

    private flattenData(type: string, data: any) {
        const result: {
            type: string,
            key: string,
            value: any,
        }[] = [];

        for (const [ key, value ] of Object.entries(data)) {
            if (typeof value === 'object' && !Array.isArray(value)) {
                result.push(...this.flattenData(key, value));
            } else if (key !== '@type' && key !== 'deleted') {
                result.push({
                    type: type,
                    key: key,
                    value: value,
                });
            }
        }

        return result;
    }

    private detectIntrusionData(type: string, key: string, value: any) {
        const id = `${this.folderName}.${type}`;
        const stateId = `${this.folderName}.${type}.${key}`;

        const stateType = BshbDefinition.determineType(value);
        const role = BshbDefinition.determineRole(type, key, value);
        const unit = BshbDefinition.determineUnit(type, key);
        const states = BshbDefinition.determineStates(type, key);

        return this.setObjectNotExistsAsync(this.folderName, {
            type: 'folder',
            common: {
                name: 'Intrusion Detection Control',
                read: true,
            },
            native: {},
        }).pipe(
            switchMap(() => this.setObjectNotExistsAsync(id, {
                type: 'folder',
                common: {
                    name: type,
                    read: true,
                    write: false,
                },
                native: {},
            }).pipe(
                switchMap(() => this.setObjectNotExistsAsync(stateId, {
                    type: 'state',
                    common: {
                        name: key,
                        type: stateType,
                        role: role,
                        read: true,
                        write: false,
                        unit: unit,
                        states: states,
                    },
                    native: {},
                }).pipe(
                    tap(() => this.bshb.setState(stateId, {
                        val: this.mapValueToStorage(value),
                        ack: true,
                    })),
                )),
            )),
            switchMap(() => this.handleSpecialCases(type, key, value)),
        );
    }

    private handleSpecialCases(type: string, key: string, value: any) {
        if (type === 'armingState' && key === 'state') {
            const keyName = 'remainingTimeUntilArmed';
            const stateId = `${this.folderName}.${type}.${keyName}`;

            const role = BshbDefinition.determineRole(type, keyName, 0);
            const unit = BshbDefinition.determineUnit(type, keyName);
            const states = BshbDefinition.determineStates(type, keyName);

            return this.setObjectNotExistsAsync(stateId, {
                type: 'state',
                common: {
                    name: key,
                    type: 'number',
                    role: role,
                    read: true,
                    write: false,
                    unit: unit,
                    states: states,
                },
                native: {},
            }).pipe(
                tap(() => {
                    if (value === 'SYSTEM_DISARMED' || value === 'SYSTEM_ARMED') {
                        this.bshb.setState(stateId, {
                            val: this.mapValueToStorage(value === 'SYSTEM_DISARMED' ? -1 : 0),
                            ack: true,
                        });
                    }
                }),
            );
        } else {
            return EMPTY;
        }
    }

    private detectIntrusionDetectionControl(activateProfile: string, armingState: string): Observable<void> {
        return this.setObjectNotExistsAsync(this.folderName, {
            type: 'folder',
            common: {
                name: 'Intrusion Detection Control',
                read: true,
            },
            native: {
                id: this.folderName,
            },
        }).pipe(
            switchMap(() => {
                const idPrefix = this.folderName + '.';

                const observables = [];

                // full
                observables.push(this.addProfile(idPrefix, 'fullProtection', 'Full Protection',
                    () => activateProfile === '0' && this.profileStatOk(armingState)));
                // partial
                observables.push(this.addProfile(idPrefix, 'partialProtection', 'Partial Protection',
                    () => activateProfile === '1' && this.profileStatOk(armingState)));
                // individual
                observables.push(this.addProfile(idPrefix, 'individualProtection', 'Individual Protection',
                    () => activateProfile === '2' && this.profileStatOk(armingState)));
                // disarm
                observables.push(this.addProfile(idPrefix, 'disarmProtection', 'Disarm Protection',
                    () => armingState === 'SYSTEM_DISARMED'));
                // mute
                observables.push(this.addProfile(idPrefix, 'muteProtection', 'Mute Protection',
                    () => armingState === 'MUTE_ALARM'));

                return concat(...observables);
            }),
        );
    }

    private profileStatOk(armingState: string) {
        return armingState === 'SYSTEM_ARMED' || armingState === 'SYSTEM_ARMING';
    }

    private addProfile(idPrefix: string, id: string, name: string, predicate: () => boolean) {
        return new Observable<void>(subscriber => {
            this.bshb.setObjectNotExists(idPrefix + id, {
                type: 'state',
                common: {
                    name: name,
                    type: 'boolean',
                    role: 'switch',
                    read: false,
                    write: true,
                },
                native: {
                    id: idPrefix + id,
                    name: name,
                },
            }, () => {
                this.bshb.setState(idPrefix + id, {val: predicate(), ack: true});

                subscriber.next();
                subscriber.complete();
            });
        });
    }

    name(): string {
        return 'intrusionDetectionHandler';
    }
}