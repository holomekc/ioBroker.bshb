import {Bshb} from "../../main";
import {BoschSmartHomeBridge} from "bosch-smart-home-bridge";
import {Observable} from "rxjs";

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
}