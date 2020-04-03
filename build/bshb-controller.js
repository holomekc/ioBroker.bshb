"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bosch_smart_home_bridge_1 = require("bosch-smart-home-bridge");
const bshb_logger_1 = require("./bshb-logger");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const utils_1 = require("./utils");
const bshb_scenario_handler_1 = require("./controller/handler/bshb-scenario-handler");
const bshb_device_handler_1 = require("./controller/handler/bshb-device-handler");
const bshb_messages_handler_1 = require("./controller/handler/bshb-messages-handler");
const bshb_open_door_window_handler_1 = require("./controller/handler/bshb-open-door-window-handler");
/**
 * This controller encapsulates bosch-smart-home-bridge and provides it to iobroker.bshb
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
class BshbController {
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
    constructor(bshb, clientCert, clientPrivateKey) {
        this.bshb = bshb;
        this.clientName = 'ioBroker.bshb';
        try {
            this.boschSmartHomeBridge = bosch_smart_home_bridge_1.BoschSmartHomeBridgeBuilder.builder()
                .withHost(bshb.config.host)
                .withClientCert(clientCert)
                .withClientPrivateKey(clientPrivateKey)
                .withLogger(new bshb_logger_1.BshbLogger(bshb))
                .build();
            this.handlers = [];
            this.handlers.push(new bshb_scenario_handler_1.BshbScenarioHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_messages_handler_1.BshbMessagesHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_device_handler_1.BshbDeviceHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_open_door_window_handler_1.BshbOpenDoorWindowHandler(this.bshb, this.boschSmartHomeBridge));
        }
        catch (e) {
            throw utils_1.Utils.createError(bshb.log, e);
        }
    }
    getBshcClient() {
        return this.boschSmartHomeBridge.getBshcClient();
    }
    /**
     * Pair devices if needed
     *
     * @param systemPassword
     *        system password of BSHC
     */
    pairDeviceIfNeeded(systemPassword) {
        let pairingDelay = 5000;
        if (this.bshb.config.pairingDelay && this.bshb.config.pairingDelay > 5000) {
            pairingDelay = this.bshb.config.pairingDelay;
        }
        return this.boschSmartHomeBridge.pairIfNeeded(this.clientName, this.bshb.config.identifier, systemPassword, pairingDelay, 100);
    }
    /**
     * Start overall detection
     *
     * @return observable with no content
     */
    startDetection() {
        return rxjs_1.concat(this.handlers.map(value => value.handleDetection())).pipe(operators_1.switchMap(value => value));
    }
    /**
     * Changes on a state which results in a call to bshc controller
     *
     * @param id
     *        id of state which changed
     * @param state
     *        state itself
     */
    setState(id, state) {
        for (let i = 0; i < this.handlers.length; i++) {
            let handled = this.handlers[i].sendUpdateToBshc(id, state);
            if (handled) {
                this.bshb.log.silly(`Handler "${this.handlers[i].constructor.name}" send message to controller with state id=${id} and value=${state.val}`);
            }
        }
    }
    /**
     * Changes from bshc controller which results in updates on ioBroker state
     *
     * @param resultEntry
     *        entry of changes which will be mapped to a state
     */
    setStateAck(resultEntry) {
        for (let i = 0; i < this.handlers.length; i++) {
            let handled = this.handlers[i].handleBshcUpdate(resultEntry);
            if (handled) {
                this.bshb.log.silly(`Handler "${this.handlers[i].constructor.name}" handled update form controller with result entry: ${JSON.stringify(resultEntry)} `);
            }
        }
    }
}
exports.BshbController = BshbController;
