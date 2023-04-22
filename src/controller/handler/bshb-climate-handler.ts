import {BshbHandler} from './bshb-handler';
import {filter, from, map, mergeMap, Observable, switchMap, tap} from 'rxjs';
import {BshbDefinition} from '../../bshb-definition';

export class BshbClimateHandler extends BshbHandler {
    private climateTextActivateRegex = /bshb\.\d+\.(roomClimateControl_hz_\d+)\.ClimateSchedule\.activeScheduleId/;
    private climateSwitchActivateRegex = /bshb\.\d+\.(roomClimateControl_hz_\d+)\.ClimateSchedule\.(.*?)\.active/;

    handleDetection(): Observable<void> {
        return this.detectClimateSchedules().pipe(tap({
            subscribe: () => this.bshb.log.info('Start detecting climate schedules...'),
            finalize: () => this.bshb.log.info('Detecting climate schedules finished'),
        }));
    }

    handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry.id === 'RoomClimateControl') {
            this.getAndProcessDeviceSchedule(resultEntry.deviceId, resultEntry.state?.roomControlMode)
                .subscribe(this.handleBshcUpdateError(`deviceId=${resultEntry.deviceId}`));

            return true;
        }

        return false;
    }

    sendUpdateToBshc(id: string, state: ioBroker.State): boolean {
        const matchTextActivate = this.climateTextActivateRegex.exec(id);
        const matchSwitchActivate = this.climateSwitchActivateRegex.exec(id);

        if (matchTextActivate) {
            this.bshb.log.debug(`Found climate trigger with deviceId=${matchTextActivate[1]}, value=${state.val}`);

            this.mapValueFromStorage(id, state.val).pipe(
                switchMap(val => this.getBshcClient().activateClimateSchedules(matchTextActivate[1], val)),
            ).subscribe(this.handleBshcSendError(`deviceId=${matchTextActivate[1]}, value=${state.val}`));

            return true;
        } else if (matchSwitchActivate) {
            this.bshb.log.debug(`Found climate trigger with deviceId=${matchSwitchActivate[1]}, id=${matchSwitchActivate[2]}, value=${state.val}`);

            this.getBshcClient().activateClimateSchedules(matchSwitchActivate[1], matchSwitchActivate[2])
                .subscribe(this.handleBshcSendError(`deviceId=${matchSwitchActivate[1]}, id=${matchSwitchActivate[2]}, value=${state.val}`));
        }
        return false;
    }

    private detectClimateSchedules(): Observable<any> {
        return this.getBshcClient().getDevices().pipe(
            switchMap(devices => from(devices.parsedResponse)),
            filter(device => device.deviceServiceIds.includes('RoomClimateControl')),
            mergeMap(device => this.getBshcClient().getDeviceServices(device.id, 'RoomClimateControl').pipe(
                    map(d => d.parsedResponse),
                    map(data => {
                        let rcc: any;
                        if (Array.isArray(data)) {
                            rcc = data[0];
                        } else {
                            rcc = data;
                        }
                        return rcc;
                    }),
                    filter(rcc => rcc !== null && typeof rcc !== 'undefined'),
                    filter(rcc => rcc?.state?.roomControlMode === 'HEATING' || rcc?.state?.roomControlMode === 'COOLING'),
                    mergeMap(rcc => this.getAndProcessDeviceSchedule(device.id, rcc.state.roomControlMode)),
                ),
            ),
        );
    }

    private getAndProcessDeviceSchedule(deviceId: string, roomControlModel: string) {
        return this.getBshcClient().getClimateSchedules(deviceId, roomControlModel).pipe(
            map(d => d.parsedResponse),
            switchMap(schedule => this.processDeviceSchedule(deviceId, schedule)),
        );
    }

    private processDeviceSchedule(deviceId: string, schedule: any): Observable<any> {
        return this.setObjectNotExistsAsync(deviceId, {
            type: 'device',
            common: {
                name: schedule.name || schedule.id,
            },
            native: {},
        }).pipe(
            switchMap(() => this.setObjectNotExistsAsync(`${deviceId}.ClimateSchedule`, {
                type: 'channel',
                common: {
                    name: 'ClimateSchedule',
                },
                native: {},
            })),
            switchMap(() => {
                const id = `${deviceId}.ClimateSchedule.activeScheduleId`;
                return this.setObjectNotExistsAsync(id, {
                    type: 'state',
                    common: {
                        name: 'activeScheduleId',
                        type: 'string',
                        role: 'text',
                        read: true,
                        write: true,
                    },
                    native: {},
                }).pipe(
                    tap(() => this.bshb.setState(id, {
                        val: this.mapValueToStorage(schedule.activeScheduleId),
                        ack: true,
                    })),
                );
            }),
            switchMap(() => from(schedule.scheduleData as any[])),
            mergeMap(data => this.setObjectNotExistsAsync(`${deviceId}.ClimateSchedule.${data.id}`, {
                type: 'folder',
                common: {
                    name: data.name || data.id,
                },
                native: {},
            }).pipe(
                switchMap(() => {
                    const id = `${deviceId}.ClimateSchedule.${data.id}.profiles`;
                    return this.setObjectNotExistsAsync(id, {
                        type: 'state',
                        common: {
                            name: 'profiles',
                            type: 'object',
                            role: 'state',
                            read: true,
                            write: false,
                        },
                        native: {},
                    }).pipe(
                        tap(() => this.bshb.setState(id, {
                            val: this.mapValueToStorage(data.profiles),
                            ack: true,
                        })),
                    );
                }),
                switchMap(() => {
                    const id = `${deviceId}.ClimateSchedule.${data.id}.ScheduleType`;
                    return this.setObjectNotExistsAsync(id, {
                        type: 'state',
                        common: {
                            name: 'ScheduleType',
                            type: 'string',
                            role: 'text',
                            read: true,
                            write: false,
                            states: BshbDefinition.determineStates('ClimateSchedule', 'ScheduleType'),
                        },
                        native: {},
                    }).pipe(
                        tap(() => this.bshb.setState(id, {
                            val: this.mapValueToStorage(data.attributeExtensionMap?.ScheduleType),
                            ack: true,
                        })),
                    );
                }),
                switchMap(() => {
                    const id = `${deviceId}.ClimateSchedule.${data.id}.ClimateRoomControlMode`;
                    return this.setObjectNotExistsAsync(id, {
                        type: 'state',
                        common: {
                            name: 'ClimateRoomControlMode',
                            type: 'string',
                            role: 'text',
                            read: true,
                            write: false,
                            states: BshbDefinition.determineStates('climateControlState', 'roomControlMode'),
                        },
                        native: {},
                    }).pipe(
                        tap(() => this.bshb.setState(id, {
                            val: this.mapValueToStorage(data.attributeExtensionMap?.ClimateRoomControlMode),
                            ack: true,
                        })),
                    );
                }),
                switchMap(() => {
                    const id = `${deviceId}.ClimateSchedule.${data.id}.active`;
                    return this.setObjectNotExistsAsync(id, {
                        type: 'state',
                        common: {
                            name: 'active',
                            type: 'boolean',
                            role: 'switch',
                            read: false,
                            write: true,
                        },
                        native: {},
                    }).pipe(
                        tap(() => this.bshb.setState(id, {
                            val: this.mapValueToStorage(data.id === schedule.activeScheduleId),
                            ack: true,
                        })),
                    );
                }),
            )),
        );
    }

    name(): string {
        return 'climateHandler';
    }
}