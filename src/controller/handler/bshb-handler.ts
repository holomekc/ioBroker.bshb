import {Bshb} from "../../main";
import {BoschSmartHomeBridge} from "bosch-smart-home-bridge";
import {Observable} from "rxjs";
import {ClientCert} from "../../client-cert";

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
    protected long_timeout = 5000;

    protected chain = Promise.resolve();

    /**
     * Create a new handler
     *
     * @param bshb
     *        adapter main class
     * @param boschSmartHomeBridge
     *        bshb
     */
    constructor(protected bshb: Bshb, protected boschSmartHomeBridge: BoschSmartHomeBridge) {
    }

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
    abstract sendUpdateToBshc(id: string, state: ioBroker.State): boolean;

    /**
     * Get bshb client
     */
    public getBshcClient() {
        return this.boschSmartHomeBridge.getBshcClient();
    }

    public mapValueToStorage(value: any): any {
        if (typeof value === "object") {
            return JSON.stringify(value);
        } else if (Array.isArray(value)) {
            return JSON.stringify(value);
        }
        return value;
    }

    public mapValueFromStorage(id: string, value: any): Observable<any> {
        return new Observable<any>(subscriber => {
            if (typeof value === "string") {
                // in case we see a string we check object.common.type for array or object.
                this.bshb.getObject(id, (error,object) => {
                    if (object && object.common && (object.common.type === 'array' || object.common.type === 'object')) {
                        try {
                            subscriber.next(JSON.parse(value));
                            subscriber.complete();
                            return;
                        } catch (e) {
                            this.bshb.log.info(`Could not parse value "${value}" for id "${id}". Continue with actual value: ${e.message}`);
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
}