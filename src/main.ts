import * as utils from "@iobroker/adapter-core";
import { BshbController } from "./bshb-controller";
import {
  BehaviorSubject,
  EMPTY,
  from,
  map,
  Observable,
  Subject,
  Subscriber,
} from "rxjs";
import { catchError, switchMap, takeUntil, tap } from "rxjs/operators";
import { Migration } from "./migration";
import { Utils } from "./utils";
import { ClientCert } from "./client-cert";
import { BshbError, BshbErrorType, BshbUtils } from "bosch-smart-home-bridge";
import { LogLevel } from "./log-level";
import * as fs from "fs";
import Timeout = NodeJS.Timeout;

/**
 * @author Christopher Holomek
 * @since 27.09.2019
 */
export class Bshb extends utils.Adapter {
  private bshbController: BshbController | undefined;
  private pollingTrigger = new BehaviorSubject(true);
  private pollTimeout: Timeout | null = null;
  private startPollingTimeout: Timeout | null = null;
  public alive = new Subject<boolean>();

  public constructor(options: Partial<utils.AdapterOptions> = {}) {
    super({
      ...options,
      name: "bshb",
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }

  /**
   * Is called when databases are connected and adapter received configuration.
   */
  private async onReady(): Promise<void> {
    // Overwrite configuration
    // make sure that identifier is valid regarding Bosch T&C
    this.log.silly("onReady called. Load configuration");

    if (!this.config.identifier) {
      this.config.identifier = BshbUtils.generateIdentifier();
      this.updateConfig({
        identifier: this.config.identifier,
      }).then();
    }

    this.config.host = this.config.host ? this.config.host.trim() : "";
    const notPrefixedIdentifier = this.config.identifier
      ? this.config.identifier.trim()
      : "";
    this.config.identifier = "ioBroker.bshb_" + notPrefixedIdentifier;
    this.config.systemPassword = this.config.systemPassword
      ? this.config.systemPassword.trim()
      : "";
    this.config.certsPath = this.config.certsPath
      ? this.config.certsPath.trim()
      : "";

    if (typeof this.config.skipServerCertificateCheck === "undefined") {
      this.config.skipServerCertificateCheck = false;
    } else if (this.config.skipServerCertificateCheck) {
      this.log.warn(
        "Server certificate check skipped due to configuration. Use at your own risk.",
      );
    }

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // this.config:
    this.log.debug("config host: " + this.config.host);
    this.log.debug("config identifier: " + this.config.identifier);
    this.log.debug(
      "config systemPassword: " + (this.config.systemPassword != undefined),
    );
    this.log.debug("config pairingDelay: " + this.config.pairingDelay);
    if (this.config.rateLimit) {
      // When I started testing the rateLimit was a string. So we add the ability to parse it
      if ((typeof this.config.rateLimit as unknown) === "string") {
        try {
          this.config.rateLimit = parseInt(
            this.config.rateLimit as unknown as string,
          );
        } catch (e) {
          this.config.rateLimit = 1000;
        }
        this.updateConfig({
          rateLimit: this.config.rateLimit,
        }).then();
      }
      this.log.debug("config rateLimit: " + this.config.rateLimit);
    } else {
      this.log.info("rateLimit is NOT set");
      this.config.rateLimit = 1000;
      this.log.debug("config rateLimit not set using default: 1000");
      this.updateConfig({
        rateLimit: this.config.rateLimit,
      }).then();
    }

    if (!notPrefixedIdentifier) {
      throw Utils.createError(
        this.log,
        "Identifier not defined but it is a mandatory parameter.",
      );
    }

    this.loadCertificates(notPrefixedIdentifier).subscribe({
      next: (clientCert) => {
        this.handleAdapterInformation();
        // Create controller for bosch-smart-home-bridge
        this.bshbController = new BshbController(
          this,
          clientCert.certificate,
          clientCert.privateKey,
        );
        this.init(this.bshbController);
      },
      error: (error) => {
        this.log.error(
          Utils.handleError(
            "Could not initialize adapter. See more details in error",
            error,
          ),
        );
      },
    });
  }

  /**
   * load certificates:<br/>
   * 1. load from system.certificates<br/>
   * 2. If not found search for old configuration to allow smooth migration<br/>
   * 3. If not found generate a new certificate<br/>
   *
   * @param notPrefixedIdentifier
   *        identifier without "ioBroker.bshb_" prefix which is used for system.certificates
   */
  private loadCertificates(notPrefixedIdentifier: string) {
    return new Observable<ClientCert>((subscriber) => {
      this.getForeignObject("system.certificates", (err, obj) => {
        if (err || !obj) {
          subscriber.error(
            Utils.createError(
              this.log,
              "Could not load certificates. This should not happen. Error: " +
                err,
            ),
          );
          subscriber.complete();
          return;
        }

        const certificateKeys = Utils.getCertificateKeys(notPrefixedIdentifier);

        const clientCert = new ClientCert(
          obj.native.certificates[certificateKeys.cert],
          obj.native.certificates[certificateKeys.key],
        );

        if (clientCert.certificate && clientCert.privateKey) {
          this.readCertificate(clientCert, subscriber);
        } else {
          this.generateCertificate(
            clientCert,
            obj,
            certificateKeys,
            subscriber,
          );
        }
      });
    });
  }

  private generateCertificate(
    clientCert: ClientCert,
    obj: ioBroker.Object,
    certificateKeys: {
      cert: string;
      key: string;
    },
    subscriber: Subscriber<ClientCert>,
  ) {
    // no certificates found.
    this.log.info(
      "Could not find client certificate. Check for old configuration",
    );
    const migrationResult = this.migration();
    if (migrationResult) {
      clientCert = migrationResult;
    } else {
      this.log.info(
        "No client certificate found in old configuration or it failed. Generate new certificate",
      );
      clientCert = Bshb.generateCertificate();
    }
    // store information
    this.storeCertificate(obj, certificateKeys, clientCert).subscribe({
      next: () => {
        subscriber.next(clientCert);
        subscriber.complete();
      },
      error: (error) => {
        subscriber.error(error);
        subscriber.complete();
      },
    });
  }

  private readCertificate(
    clientCert: ClientCert,
    subscriber: Subscriber<ClientCert>,
  ) {
    // found certificates
    this.log.info("Client certificate found in system.certificates");

    this.log.info("Check if certificate is file reference or actual content");
    const actualCert = this.loadFromFile(clientCert.certificate, "certificate");
    const actualPrivateKey = this.loadFromFile(
      clientCert.privateKey,
      "private key",
    );
    clientCert = new ClientCert(actualCert, actualPrivateKey);

    subscriber.next(clientCert);
    subscriber.complete();
  }

  private loadFromFile(file: string, type: string): string {
    try {
      if (fs.existsSync(file)) {
        this.log.info(`${type} is a file reference. Read from file`);
        return fs.readFileSync(file, "utf-8");
      } else {
        this.log.info(
          `${type} seems to be actual content. Use value from state.`,
        );
        return file;
      }
    } catch (e) {
      this.log.info(
        `${type} seems to be actual content or reading from file failed. Use value from state. For more details restart adapter with debug log level.`,
      );
      this.log.debug(`Error during reading file: ${e}`);
      return file;
    }
  }

  private storeCertificate(
    obj: ioBroker.Object,
    certificateKeys: { cert: string; key: string },
    clientCert: ClientCert,
  ): Observable<void> {
    // store information
    obj.native.certificates[certificateKeys.cert] = clientCert.certificate;
    obj.native.certificates[certificateKeys.key] = clientCert.privateKey;

    return from(
      this.setForeignObjectAsync("system.certificates", obj as any),
    ).pipe(
      catchError((err) => {
        throw Utils.createError(
          this.log,
          "Could not store client certificate in system.certificates due to an error:" +
            err,
        );
      }),
      tap(() =>
        this.log.info("Client certificate stored in system.certificates."),
      ),
      map(() => undefined),
    );
  }

  private migration() {
    // migration:
    const certsPath: string = (this.config as any).certsPath;
    if (!certsPath) {
      // We abort if we could nof find the certificate path
      return undefined;
    }

    this.log.info(
      `Found old configuration in certsPath: ${certsPath}. Try to read information`,
    );

    try {
      const result = new ClientCert(
        Migration.loadCertificate(this, certsPath),
        Migration.loadPrivateKey(this, certsPath),
      );
      this.log.info(
        `Load client certificate from old configuration successful. Consider removing them from: ${certsPath}. They are not needed anymore`,
      );
      return result;
    } catch (err) {
      // something went wrong we abort. Logging was already done.
      return undefined;
    }
  }

  private static generateCertificate(): ClientCert {
    const certificateDefinition = BshbUtils.generateClientCertificate();
    return new ClientCert(
      certificateDefinition.cert,
      certificateDefinition.private,
    );
  }

  private init(bshbController: BshbController) {
    // start pairing if needed
    bshbController
      .pairDeviceIfNeeded(this.config.systemPassword)
      .pipe(
        catchError((err: any) => {
          this.log.error(
            Utils.handleError(
              "Something went wrong during initialization",
              err,
            ),
          );
          return EMPTY;
        }),
        // Everything is ok. We check for devices first
        switchMap(() =>
          bshbController.startDetection().pipe(
            catchError((err: any) => {
              this.log.error(
                Utils.handleError("Something went wrong during detection", err),
              );
              return EMPTY;
            }),
          ),
        ),
        takeUntil(this.alive),
      )
      .subscribe({
        next: () => {
          this.log.info("Subscribe to ioBroker states");

          // register for changes
          this.subscribeStates("*");

          // now we want to subscribe to BSHC for changes
          this.startPolling(bshbController);
        },
      });
  }

  private poll = (delay?: number) => {
    delay = delay ? delay : 0;
    this.pollTimeout = setTimeout(() => {
      this.pollTimeout = null;
      this.pollingTrigger.next(true);
    }, delay);
  };

  private startPolling = (bshbController: BshbController, delay?: number) => {
    this.log.info("Listen to changes");
    delay = delay ? delay : 0;
    this.startPollingTimeout = setTimeout(() => {
      this.startPollingTimeout = null;
      this.subscribeAndPoll(bshbController);
    }, delay);
  };

  private handleAdapterInformation() {
    this.setObjectNotExists(
      "info",
      {
        type: "channel",
        common: {
          name: "Information",
        },
        native: {},
      },
      (_err, obj) => {
        if (obj) {
          // channel created we create all other stuff now.
          this.setObjectNotExists(
            "info.connection",
            {
              type: "state",
              common: {
                name: "If connected to BSHC",
                type: "boolean",
                role: "indicator.connected",
                read: true,
                write: false,
                def: false,
              },
              native: {},
            },
            (_err, obj) => {
              if (obj) {
                // we start with disconnected
                this.setState("info.connection", { val: false, ack: true });
              }
            },
          );
        }
      },
    );
  }

  private updateInfoConnectionState(connected: boolean) {
    this.getState("info.connection", (_err, state) => {
      if (state) {
        if (state.val === connected) {
          return;
        }
      }
      this.setState("info.connection", { val: connected, ack: true });
    });
  }

  private subscribeAndPoll = (bshbController: BshbController) => {
    this.pollingTrigger.next(false);
    this.pollingTrigger.complete();

    this.pollingTrigger = new BehaviorSubject<boolean>(true);

    bshbController
      .getBshcClient()
      .subscribe()
      .subscribe((response) => {
        this.pollingTrigger.subscribe((keepPolling) => {
          if (keepPolling) {
            bshbController
              .getBshcClient()
              .longPolling(response.parsedResponse.result, 30000, 2000)
              .subscribe({
                next: (infoResponse) => {
                  if (infoResponse.incomingMessage.statusCode !== 200) {
                    this.updateInfoConnectionState(false);

                    if (infoResponse.incomingMessage.statusCode === 503) {
                      this.log.warn(
                        `BSHC is starting. Try to reconnect asap. HTTP=${infoResponse.incomingMessage.statusCode}, data=${infoResponse.parsedResponse}`,
                      );
                    } else {
                      this.log.warn(
                        `Something went wrong during long polling. HTTP=${infoResponse.incomingMessage.statusCode}, data=${infoResponse.parsedResponse}`,
                      );
                    }
                    // something went wrong we delay polling
                    this.poll(10000);
                  } else {
                    this.updateInfoConnectionState(true);

                    const information = infoResponse.parsedResponse;

                    // handle updates
                    information.result.forEach((resultEntry) => {
                      if (Utils.isLevelActive(this.log.level, LogLevel.debug)) {
                        this.log.debug(JSON.stringify(resultEntry));
                      }
                      bshbController.setStateAck(resultEntry);
                    });

                    // poll further data.
                    this.poll();
                  }
                },
                error: (error) => {
                  this.updateInfoConnectionState(false);

                  if (
                    (error as BshbError).errorType === BshbErrorType.POLLING
                  ) {
                    const bshbError = error as BshbError;
                    if (
                      bshbError.cause &&
                      bshbError.cause instanceof BshbError
                    ) {
                      if (bshbError.errorType === BshbErrorType.TIMEOUT) {
                        this.log.info(
                          "LongPolling connection timed-out before BSHC closed connection.  Try to reconnect.",
                        );
                      } else if (bshbError.errorType === BshbErrorType.ABORT) {
                        this.log.warn(
                          "Connection to BSHC closed by adapter. Try to reconnect.",
                        );
                      } else {
                        this.log.warn(
                          "Something went wrong during long polling. Try to reconnect.",
                        );
                      }
                    } else {
                      this.log.warn(
                        "Something went wrong during long polling. Try to reconnect.",
                      );
                    }

                    this.startPolling(bshbController, 5000);
                  } else {
                    this.log.warn(
                      "Something went wrong during long polling. Try again later.",
                    );
                    this.poll(10000);
                  }
                },
              });
          } else {
            bshbController
              .getBshcClient()
              .unsubscribe(response.parsedResponse.result)
              .subscribe(() => {
                this.updateInfoConnectionState(false);
              });
          }
        });
      });
  };

  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  private onUnload(callback: () => void): void {
    try {
      this.log.info("unloading...");
      this.alive.next(false);
      this.alive.complete();

      // we want to stop polling. So false
      this.pollingTrigger.next(false);
      this.pollingTrigger.complete();

      // and we clear timeouts as well
      if (this.pollTimeout) {
        clearTimeout(this.pollTimeout);
        this.pollTimeout = null;
      }
      if (this.startPollingTimeout) {
        clearTimeout(this.startPollingTimeout);
        this.startPollingTimeout = null;
      }
      this.bshbController?.close();
      this.log.info("unload complete");
      callback();
    } catch (e) {
      callback();
    }
  }

  /**
   * Is called if a subscribed state changes
   */
  private onStateChange(
    id: string,
    state: ioBroker.State | null | undefined,
  ): void {
    if (!this.bshbController) {
      this.log.warn(
        "Could not handle state change because controller was not initialized yet: " +
          id,
      );
      return;
    }
    if (state) {
      if (!state.ack) {
        // The state was changed
        this.log.debug(
          `state ${id} changed: ${state.val} (ack = ${state.ack})`,
        );
        this.bshbController.setState(id, state);
      }
    } else {
      // The state was deleted
      // Currently we do not need this
    }
  }
}

if (require.main !== module) {
  // Export the constructor in compact mode
  module.exports = (options: Partial<utils.AdapterOptions> | undefined) =>
    new Bshb(options);
} else {
  // otherwise start the instance directly
  (() => new Bshb())();
}
