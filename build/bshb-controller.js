"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbController = void 0;
const bosch_smart_home_bridge_1 = require("bosch-smart-home-bridge");
const bshb_logger_1 = require("./bshb-logger");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const utils_1 = require("./utils");
const bshb_scenario_handler_1 = require("./controller/handler/bshb-scenario-handler");
const bshb_device_handler_1 = require("./controller/handler/bshb-device-handler");
const bshb_messages_handler_1 = require("./controller/handler/bshb-messages-handler");
const bshb_open_door_window_handler_1 = require("./controller/handler/bshb-open-door-window-handler");
const bshb_intrusion_detection_handler_1 = require("./controller/handler/bshb-intrusion-detection-handler");
const bshb_general_update_handler_1 = require("./controller/handler/bshb-general-update-handler");
const bshb_air_purity_guardian_handler_1 = require("./controller/handler/bshb-air-purity-guardian-handler");
const bshb_motion_lights_handler_1 = require("./controller/handler/bshb-motion-lights-handler");
const bshb_water_alarm_handler_1 = require("./controller/handler/bshb-water-alarm-handler");
const bshb_room_handler_1 = require("./controller/handler/bshb-room-handler");
const bshb_device_status_update_handler_1 = require("./controller/handler/bshb-device-status-update-handler");
const bshb_climate_handler_1 = require("./controller/handler/bshb-climate-handler");
const bshb_user_defined_states_handler_1 = require("./controller/handler/bshb-user-defined-states-handler");
const rate_limiter_1 = require("./rate-limiter");
const bshb_automation_handler_1 = require("./controller/handler/bshb-automation-handler");
/**
 * This controller encapsulates bosch-smart-home-bridge and provides it to iobroker.bshb
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
class BshbController {
    bshb;
    boschSmartHomeBridge;
    clientName = 'ioBroker.bshb';
    $rateLimit = new rxjs_1.Subject();
    alive = new rxjs_1.Subject();
    handlers;
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
        try {
            this.boschSmartHomeBridge = bosch_smart_home_bridge_1.BoschSmartHomeBridgeBuilder.builder()
                .withHost(bshb.config.host)
                .withClientCert(clientCert)
                .withClientPrivateKey(clientPrivateKey)
                .withLogger(new bshb_logger_1.BshbLogger(bshb))
                .withIgnoreCertificateCheck(this.bshb.config.skipServerCertificateCheck)
                .build();
            this.handlers = [];
            this.handlers.push(new bshb_general_update_handler_1.BshbGeneralUpdateHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_scenario_handler_1.BshbScenarioHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_automation_handler_1.BshbAutomationHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_user_defined_states_handler_1.BshbUserDefinedStatesHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_device_status_update_handler_1.BshbDeviceStatusUpdateHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_messages_handler_1.BshbMessagesHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_intrusion_detection_handler_1.BshbIntrusionDetectionHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_air_purity_guardian_handler_1.BshbAirPurityGuardianHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_motion_lights_handler_1.BshbMotionLightsHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_water_alarm_handler_1.BshbWaterAlarmHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_room_handler_1.BshbRoomHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_device_handler_1.BshbDeviceHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_open_door_window_handler_1.BshbOpenDoorWindowHandler(this.bshb, this.boschSmartHomeBridge));
            this.handlers.push(new bshb_climate_handler_1.BshbClimateHandler(this.bshb, this.boschSmartHomeBridge));
            this.$rateLimit.pipe((0, rate_limiter_1.rateLimit)(this.bshb.config.rateLimit, this.bshb), (0, rxjs_1.concatMap)(data => {
                const observables = [];
                for (let i = 0; i < this.handlers.length; i++) {
                    observables.push(this.handlers[i].sendUpdateToBshc(data.id, data.state).pipe(
                    // Protect controller
                    (0, operators_1.catchError)(err => {
                        this.bshb.log.silly(`Handler "${this.handlers[i].constructor.name}" failed with ${err}. This might happen when the controller answers with an error.`);
                        return (0, rxjs_1.of)(true);
                    }), (0, operators_1.tap)(handled => {
                        if (handled) {
                            this.bshb.log.silly(`Handler "${this.handlers[i].constructor.name}" send message to controller with state id=${data.id} and value=${data.state.val}`);
                        }
                    })));
                }
                return (0, rxjs_1.merge)(...observables);
            }), (0, operators_1.takeUntil)(this.alive)).subscribe();
        }
        catch (e) {
            if (e instanceof Error) {
                throw utils_1.Utils.createError(bshb.log, e.message);
            }
            else {
                throw utils_1.Utils.createError(bshb.log, e);
            }
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
        // Retry pairIfNeeded logic. It is a bit more complicated compared to before because pairIfNeeded completes stream after attempts.
        // Community wants that it reconnects all the time. But pairIfNeeded might not be suitable because client may be paired already but
        // connection is broken. Then pairIfNeeded never goes back to test if client is paired and is stuck.
        // Here we retry the pairIfNeeded without attempts configured. So we try once. If something is not ok we wait
        // for pairing delay before we try again. We use takeUntil to make sure that we stop streams if adapter shuts-down
        // takeUntil must be last in pipe to prevent issues.
        return new rxjs_1.Observable(subscriber => {
            const retry = new rxjs_1.BehaviorSubject(true);
            retry.pipe((0, operators_1.catchError)(err => err.pipe((0, operators_1.delay)(pairingDelay))), (0, operators_1.tap)(() => {
                this.boschSmartHomeBridge.pairIfNeeded(this.clientName, this.bshb.config.identifier, systemPassword, pairingDelay, -1).pipe((0, operators_1.takeUntil)(this.bshb.alive)).subscribe({
                    next: response => {
                        // Everything is ok. We can stop all.
                        this.bshb.log.info('Ok with pairing');
                        subscriber.next(response);
                        subscriber.complete();
                        retry.complete();
                    }, error: err => {
                        this.bshb.log.error(err);
                        // Something went wrong. Already logged by lib. We just wait and retry.
                        (0, rxjs_1.timer)(pairingDelay).pipe((0, operators_1.takeUntil)(this.bshb.alive)).subscribe(() => {
                            retry.next(true);
                        });
                    }
                });
            }), (0, operators_1.takeUntil)(this.bshb.alive)).subscribe(() => {
                // We do not care
            });
        });
    }
    /**
     * Start overall detection
     *
     * @return observable with no content
     */
    startDetection() {
        this.bshb.log.info('Start detection');
        return (0, rxjs_1.concat)(...this.handlers.map(value => value.handleDetection())).pipe((0, rxjs_1.last)(undefined, void 0));
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
        this.$rateLimit.next({ id: id, state: state });
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
    close() {
        this.alive.next(true);
        this.alive.complete();
    }
}
exports.BshbController = BshbController;
//# sourceMappingURL=bshb-controller.js.map