import {
  BoschSmartHomeBridge,
  BoschSmartHomeBridgeBuilder,
} from "bosch-smart-home-bridge";
import { Bshb } from "./main";
import { BshbLogger } from "./bshb-logger";
import {
  BehaviorSubject,
  concat,
  concatMap,
  last,
  merge,
  Observable,
  of,
  Subject,
  timer,
} from "rxjs";
import { catchError, delay, takeUntil, tap } from "rxjs/operators";
import { Utils } from "./utils";
import { BshbHandler } from "./controller/handler/bshb-handler";
import { BshbScenarioHandler } from "./controller/handler/bshb-scenario-handler";
import { BshbDeviceHandler } from "./controller/handler/bshb-device-handler";
import { BshbMessagesHandler } from "./controller/handler/bshb-messages-handler";
import { BshbOpenDoorWindowHandler } from "./controller/handler/bshb-open-door-window-handler";
import { BshbIntrusionDetectionHandler } from "./controller/handler/bshb-intrusion-detection-handler";
import { BshbGeneralUpdateHandler } from "./controller/handler/bshb-general-update-handler";
import { BshbAirPurityGuardianHandler } from "./controller/handler/bshb-air-purity-guardian-handler";
import { BshbMotionLightsHandler } from "./controller/handler/bshb-motion-lights-handler";
import { BshbWaterAlarmHandler } from "./controller/handler/bshb-water-alarm-handler";
import { BshbRoomHandler } from "./controller/handler/bshb-room-handler";
import { BshbDeviceStatusUpdateHandler } from "./controller/handler/bshb-device-status-update-handler";
import { BshbClimateHandler } from "./controller/handler/bshb-climate-handler";
import { BshbUserDefinedStatesHandler } from "./controller/handler/bshb-user-defined-states-handler";
import { rateLimit } from "./rate-limiter";
import { BshbAutomationHandler } from "./controller/handler/bshb-automation-handler";
import { BshbBackupHandler } from "./controller/handler/bshb-backup-handler";

/**
 * This controller encapsulates bosch-smart-home-bridge and provides it to iobroker.bshb
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
export class BshbController {
  private readonly boschSmartHomeBridge: BoschSmartHomeBridge;
  private clientName = "ioBroker.bshb";

  private $rateLimit = new Subject<{ id: string; state: ioBroker.State }>();
  public alive = new Subject<boolean>();

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
  constructor(
    private bshb: Bshb,
    clientCert: string,
    clientPrivateKey: string,
  ) {
    try {
      this.boschSmartHomeBridge = BoschSmartHomeBridgeBuilder.builder()
        .withHost(bshb.config.host)
        .withClientCert(clientCert)
        .withClientPrivateKey(clientPrivateKey)
        .withLogger(new BshbLogger(bshb))
        .withIgnoreCertificateCheck(this.bshb.config.skipServerCertificateCheck)
        .build();

      this.handlers = [];
      this.handlers.push(
        new BshbGeneralUpdateHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbScenarioHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbAutomationHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbUserDefinedStatesHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbDeviceStatusUpdateHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbMessagesHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbIntrusionDetectionHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbAirPurityGuardianHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbMotionLightsHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbWaterAlarmHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbRoomHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbDeviceHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbOpenDoorWindowHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbClimateHandler(this.bshb, this.boschSmartHomeBridge),
      );
      this.handlers.push(
        new BshbBackupHandler(this.bshb, this.boschSmartHomeBridge),
      );

      this.$rateLimit
        .pipe(
          rateLimit(this.bshb.config.rateLimit, this.bshb),
          concatMap((data) => {
            const observables: Observable<boolean>[] = [];

            for (let i = 0; i < this.handlers.length; i++) {
              observables.push(
                this.handlers[i].sendUpdateToBshc(data.id, data.state).pipe(
                  // Protect controller
                  catchError((err) => {
                    this.bshb.log.silly(
                      `Handler "${this.handlers[i].constructor.name}" failed with ${err}. This might happen when the controller answers with an error.`,
                    );
                    return of(true);
                  }),
                  tap((handled) => {
                    if (handled) {
                      this.bshb.log.silly(
                        `Handler "${this.handlers[i].constructor.name}" send message to controller with state id=${data.id} and value=${data.state.val}`,
                      );
                    }
                  }),
                ),
              );
            }
            return merge(...observables);
          }),
          takeUntil(this.alive),
        )
        .subscribe();
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw Utils.createError(bshb.log, e.message);
      } else {
        throw Utils.createError(bshb.log, e as string);
      }
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

    // Retry pairIfNeeded logic. It is a bit more complicated compared to before because pairIfNeeded completes stream after attempts.
    // Community wants that it reconnects all the time. But pairIfNeeded might not be suitable because client may be paired already but
    // connection is broken. Then pairIfNeeded never goes back to test if client is paired and is stuck.
    // Here we retry the pairIfNeeded without attempts configured. So we try once. If something is not ok we wait
    // for pairing delay before we try again. We use takeUntil to make sure that we stop streams if adapter shuts-down
    // takeUntil must be last in pipe to prevent issues.
    return new Observable((subscriber) => {
      const retry = new BehaviorSubject<boolean>(true);
      retry
        .pipe(
          catchError((err) => err.pipe(delay(pairingDelay))),
          tap(() => {
            this.boschSmartHomeBridge
              .pairIfNeeded(
                this.clientName,
                this.bshb.config.identifier,
                systemPassword,
                pairingDelay,
                -1,
              )
              .pipe(takeUntil(this.bshb.alive))
              .subscribe({
                next: (response) => {
                  // Everything is ok. We can stop all.
                  this.bshb.log.info("Ok with pairing");
                  subscriber.next(response);
                  subscriber.complete();
                  retry.complete();
                },
                error: (err) => {
                  this.bshb.log.error(err);
                  // Something went wrong. Already logged by lib. We just wait and retry.
                  timer(pairingDelay)
                    .pipe(takeUntil(this.bshb.alive))
                    .subscribe(() => {
                      retry.next(true);
                    });
                },
              });
          }),
          takeUntil(this.bshb.alive),
        )
        .subscribe(() => {
          // We do not care
        });
    });
  }

  /**
   * Start overall detection
   *
   * @return observable with no content
   */
  public startDetection(): Observable<void> {
    this.bshb.log.info("Start detection");
    return concat(
      ...this.handlers.map((value) => value.handleDetection()),
    ).pipe(last(undefined, void 0));
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
    this.$rateLimit.next({ id: id, state: state });
  }

  /**
   * Changes from bshc controller which results in updates on ioBroker state
   *
   * @param resultEntry
   *        entry of changes which will be mapped to a state
   */
  public setStateAck(resultEntry: any) {
    for (let i = 0; i < this.handlers.length; i++) {
      const handled = this.handlers[i].handleBshcUpdate(resultEntry);
      if (handled) {
        this.bshb.log.silly(
          `Handler "${this.handlers[i].constructor.name}" handled update form controller with result entry: ${JSON.stringify(resultEntry)} `,
        );
      }
    }
  }

  public close() {
    this.alive.next(true);
    this.alive.complete();
  }
}
