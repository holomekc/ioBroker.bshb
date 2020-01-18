import {BoschSmartHomeBridge, BoschSmartHomeBridgeBuilder} from 'bosch-smart-home-bridge';
import {Bshb} from './main';
import {BshbLogger} from './bshb-logger';
import {concat, Observable} from 'rxjs';
import {switchMap} from "rxjs/operators";
import {Utils} from "./utils";
import {BshbHandler} from "./controller/handler/bshb-handler";
import {BshbScenarioHandler} from "./controller/handler/bshb-scenario-handler";
import {BshbDeviceHandler} from "./controller/handler/bshb-device-handler";
import {BshbMessagesHandler} from "./controller/handler/bshb-messages-handler";

/**
 * This controller encapsulates bosch-smart-home-bridge and provides it to iobroker.bshb
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
export class BshbController {

    private boschSmartHomeBridge: BoschSmartHomeBridge;
    private clientName = 'ioBroker.bshb';

    private handlers: BshbHandler[];

    /**
     * Create a new instance of {@link BshbController}
     *
     * @param bshb
     *        instance of {@link Bshb}
     * @param clientCert
     *        client certificate
     * @param clientPrivateKey
     *        client private key
     */
    constructor(private bshb: Bshb, clientCert: string, clientPrivateKey: string) {
        try {
            this.boschSmartHomeBridge = BoschSmartHomeBridgeBuilder.builder()
                .withHost(bshb.config.host)
                .withClientCert(clientCert)
                .withClientPrivateKey(clientPrivateKey)
                .withLogger(new BshbLogger(bshb))
                .build();

            this.handlers = [];
            this.handlers.push(new BshbScenarioHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new BshbMessagesHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new BshbDeviceHandler(this.bshb, this.boschSmartHomeBridge));

        } catch (e) {
            throw Utils.createError(bshb.log, e);
        }
    }

    public getBshcClient() {
        return this.boschSmartHomeBridge.getBshcClient();
    }

    /**
     * Pair devices if needed
     *
     * @param systemPassword
     *        system password of BSHC
     */
    public pairDeviceIfNeeded(systemPassword: string) {

        let pairingDelay = 5000;
        if (this.bshb.config.pairingDelay && this.bshb.config.pairingDelay > 5000) {
            pairingDelay = this.bshb.config.pairingDelay;
        }

        return this.boschSmartHomeBridge.pairIfNeeded(this.clientName, this.bshb.config.identifier,
            systemPassword, pairingDelay, 100);
    }

    /**
     * Start overall detection
     *
     * @return observable with no content
     */
    public startDetection(): Observable<void> {
        return concat(this.handlers.map(value => value.handleDetection())).pipe(switchMap(value => value));
    }

    /**
     * Changes on a state which results in a call to bshc controller
     *
     * @param id
     *        id of state which changed
     * @param state
     *        state itself
     */
    public setState(id: string, state: ioBroker.State) {
        for (let i = 0; i < this.handlers.length; i++) {
            if (this.handlers[i].sendUpdateToBshc(id, state)) {
                break;
            }
        }
    }

    /**
     * Changes from bshc controller which results in updates on ioBroker state
     *
     * @param resultEntry
     *        entry of changes which will be mapped to a state
     */
    public setStateAck(resultEntry: any) {
        for (let i = 0; i < this.handlers.length; i++) {
            if (this.handlers[i].handleBshcUpdate(resultEntry)) {
                break;
            }
        }
    }
}