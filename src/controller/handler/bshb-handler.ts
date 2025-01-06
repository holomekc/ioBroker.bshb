import {tap} from 'rxjs/operators';
import {Bshb} from '../../main';
import {BoschSmartHomeBridge} from 'bosch-smart-home-bridge';
import {concatMap, from, map, Observable, Observer, of, Subject, switchMap} from 'rxjs';
import {Utils} from '../../utils';

/**
 * Abstract handler which can be used to handle the following things:<br/>
 * 1. detecting devices etc.<br/>
 * 2. handle updates from bshc controller.<br/>
 * 3. send messages to bshc controller.<br/>
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
export abstract class BshbHandler {
    protected long_timeout = 20000;

    private enumChain = new Subject<{
        type: string,
        name: string,
        deviceId: string,
        deviceServiceId: string,
        itemId?: string
    }>();

    /**
     * Create a new handler
     *
     * @param bshb
     *        adapter main class
     * @param boschSmartHomeBridge
     *        bshb
     */
    constructor(protected bshb: Bshb, protected boschSmartHomeBridge: BoschSmartHomeBridge) {
        this.enumChain.pipe(concatMap(enumObj => {
            if (enumObj.itemId) {
                return from(this.bshb.addStateToEnumAsync(enumObj.type, enumObj.name, enumObj.deviceId, enumObj.deviceServiceId, enumObj.itemId));
            } else {
                return from(this.bshb.addChannelToEnumAsync(enumObj.type, enumObj.name, enumObj.deviceId, enumObj.deviceServiceId));
            }
        })).subscribe({
            next: () => {
            },
            error: err => this.bshb.log.warn(Utils.handleError('Could not add enum', err))
        });
    }

    abstract name(): string;

    /**
     * detect devices or something else of bshc
     */
    abstract handleDetection(): Observable<void>;

    /**
     * handle updates from bshc
     *
     * @param resultEntry
     *        entry of result list
     */
    abstract handleBshcUpdate(resultEntry: any): boolean;

    /**
     * Send a message to bshc to inform about a change
     * @param id
     *        id of state which was changed
     * @param state
     *        state itself
     */
    abstract sendUpdateToBshc(id: string, state: ioBroker.State): Observable<boolean>;

    /**
     * Get bshb client
     */
    public getBshcClient() {
        return this.boschSmartHomeBridge.getBshcClient();
    }

    public addRoomEnum(name: string, deviceId: string, deviceServiceId: string, itemId?: string) {
        if (name) {
            name = name.trim();

            if (name && name.length > 0) {
                this.addEnum('rooms', name, deviceId, deviceServiceId, itemId);
            }
        }
    }

    public addFunctionEnum(name: string, deviceId: string, deviceServiceId: string, itemId?: string) {
        if (name) {
            name = name.trim();

            if (name && name.length > 0) {
                this.addEnum('functions', name, deviceId, deviceServiceId, itemId);
            }
        }
    }

    public addEnum(type: string, name: string, deviceId: string, deviceServiceId: string, itemId?: string) {
        this.enumChain.next({
            type: type,
            name: name,
            deviceId: deviceId,
            deviceServiceId: deviceServiceId,
            itemId: itemId
        });
    }

    public mapValueToStorage(value: any): any {
        if (typeof value === 'object') {
            return JSON.stringify(value);
        } else if (Array.isArray(value)) {
            return JSON.stringify(value);
        }
        return value;
    }

    public mapValueFromStorage(id: string, value: any): Observable<any> {
        return new Observable<any>(subscriber => {
            if (typeof value === 'string') {
                // in case we see a string we check object.common.type for array or object.
                this.bshb.getObject(id, (error, object) => {
                    if (object && object.common && (object.common.type === 'array' || object.common.type === 'object' || object.common.type === 'json')) {
                        try {
                            subscriber.next(JSON.parse(value));
                            subscriber.complete();
                            return;
                        } catch (e: unknown) {
                            if (e instanceof Error) {
                                this.bshb.log.info(`Could not parse value "${value}" for id "${id}". Continue with actual value: ${e.message}`);
                            } else {
                                this.bshb.log.info(`Could not parse value "${value}" for id "${id}". Continue with actual value: ${e as string}`);
                            }
                        }
                    }
                    // If condition does not apply or something went wrong we continue with untouched value.
                    subscriber.next(value);
                    subscriber.complete();
                });
            } else {
                // No string so no mapping
                subscriber.next(value);
                subscriber.complete();
            }
        });
    }

    /**
     * A custom implementation of setObjectNotExistsAsync object is always provided, and it does not
     * matter if object was created or not. At the moment there is no way to distinguish between creation
     * and no creation. We will see if this is sufficient.
     * @param id id to set
     * @param object object ot create if not exists
     * @param options optional options
     */
    public setObjectNotExistsAsync(id: string, object: ioBroker.SettableObject,
                                   options?: unknown)
        : Observable<{ id: string, _bshbCreated: boolean }> {

        return from(this.bshb.getObjectAsync(id, options)).pipe(
            switchMap(obj => {
                if (!obj) {
                    return from(this.bshb.setObjectAsync(id, object)).pipe(
                        tap(o => (o as any)._bshbCreated = true),
                        map(o => o as unknown as { id: string, _bshbCreated: boolean })
                    );
                } else {
                    (obj as any)._bshbCreated = false;
                    return of(obj as unknown as { id: string, _bshbCreated: boolean });
                }
            })
        );
    }

    public setInitialStateValueIfNotSet(id: string, state: ioBroker.State | null | undefined, value: any) {
        if (state) {
            return this.mapValueFromStorage(id, state.val).pipe(
                tap(value => {
                    if (value !== value) {
                        // only set again if a change is detected.
                        this.bshb.setState(id, {val: this.mapValueToStorage(value), ack: true});
                    }
                }),
                switchMap(() => of(undefined))
            );
        } else {
            // no previous state so we set it
            this.bshb.setState(id, {val: this.mapValueToStorage(value), ack: true});
            // we do not wait
            return of(undefined);
        }
    }

    public handleBshcUpdateError(...params: any[]): Partial<Observer<any>> {
        return {
            next: () => this.bshb.log.debug(`Handled update for "${this.name()}" successfully.`),
            error: err => this.logWarn(`Could not handle update for "${this.name()}" with ${params}.`, err)
        };
    }

    public handleBshcSendError(...params: any[]): Partial<Observer<any>> {
        return {
            next: () => this.bshb.log.debug(`Send message for "${this.name()}" successfully.`),
            error: err => this.logWarn(`Could not send update for "${this.name()}" with ${params}.`, err)
        };
    }

    public logWarn(message?: string, cause?: Error) {
        this.bshb.log.warn(Utils.handleError(message, cause))
    }
}