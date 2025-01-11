import {
  filter,
  from,
  map,
  mergeMap,
  Observable,
  of,
  Subject,
  switchMap,
  take,
  tap,
} from "rxjs";
import { BshbHandler } from "./bshb-handler";
import { BshbDefinition } from "../../bshb-definition";
import * as utils from "@iobroker/adapter-core";
import { promises as fs } from "fs";
import path from "path";
import { BinaryResponse, BshbResponse } from "bosch-smart-home-bridge";

export class BshbBackupHandler extends BshbHandler {
  private backupRegex = /bshb\.\d+\.backup\.(createBackup|deleteBackup)/;

  private backupStatus$ = new Subject<string>();

  name(): string {
    return "backupHandler";
  }

  handleDetection(): Observable<void> {
    return this.detectBackup().pipe(
      tap({
        subscribe: () =>
          this.bshb.log.info("Start detecting backup information..."),
        finalize: () =>
          this.bshb.log.info("Detecting backup information finished"),
      }),
    );
  }

  handleBshcUpdate(resultEntry: any): boolean {
    let prefix: string | undefined = undefined;
    if (resultEntry["@type"] === "BackupStatus") {
      this.bshb.log.debug("Updating backup status...");
      prefix = "backup.backupStatus";
    } else if (resultEntry["@type"] === "RestoreStatus") {
      this.bshb.log.debug("Updating restore status...");
      prefix = "backup.restoreStatus";
    }

    if (prefix) {
      for (const [key, value] of Object.entries(resultEntry)) {
        if (key === "@type") {
          continue;
        }

        const id = `${prefix}.${key}`;
        from(
          this.bshb.setState(id, {
            val: value as any,
            ack: true,
          }),
        )
          .pipe(
            tap(() => {
              if (key === "state") {
                // internal backup status propagation after ioBroker state update.
                // Prevent a racing condition and make sure that a user is able to read the
                // READY state as well. In general the process of downloading and storing the file
                // should be super quick, so READY is most likely not visible for that long.
                this.backupStatus$.next(value + "");
              }
            }),
          )
          .subscribe(this.handleBshcUpdateError(`id=${id}`));
      }
      return true;
    }
    return false;
  }

  sendUpdateToBshc(id: string, state: ioBroker.State): Observable<boolean> {
    const match = this.backupRegex.exec(id);

    let result = of(false);

    if (match) {
      if (state.val) {
        if (id.endsWith("createBackup")) {
          result = this.createBackup().pipe(
            switchMap(() => this.waitForReadyState()),
            switchMap(() => this.getBackup()),
            switchMap((response) => this.storeBackupFile(response)),
            switchMap(() => this.deleteBackupFromController()),
            switchMap(() => {
              this.bshb.log.debug(
                "[Backup] Backup file stores. Delete file on controller.",
              );
              return from(this.bshb.setState(id, { val: false, ack: true }));
            }),
            tap(this.handleBshcUpdateError(`id=${id}`)),
            map(() => true),
          );
        } else {
          this.bshb.log.debug("Delete backup from controller triggered");
          result = this.getBshcClient()
            .deleteBackup({ timeout: this.long_timeout })
            .pipe(
              switchMap((_) =>
                from(this.bshb.setState(id, { val: false, ack: true })),
              ),
              tap(this.handleBshcUpdateError(`id=${id}`)),
              map(() => true),
            );
        }
      } else {
        result = of(true);
      }
    }

    return result;
  }

  private createBackup() {
    this.bshb.log.debug("[Backup] Creating backup triggered");
    return this.getBshcClient().createBackup(
      this.bshb.config.systemPassword,
      undefined,
      { timeout: this.long_timeout },
    );
  }

  private waitForReadyState() {
    this.bshb.log.debug(
      "[Backup] Backup creation triggered. Waiting for READY state",
    );
    return this.backupStatus$.pipe(
      filter((status) => status === "READY"),
      take(1),
    );
  }

  private getBackup() {
    this.bshb.log.debug("[Backup] READY state received. Downloading data.");
    return this.getBshcClient().getBackup();
  }

  private storeBackupFile(response: BshbResponse<BinaryResponse>) {
    const binaryResponse = response.parsedResponse;
    const backupDir = path.join(
      utils.getAbsoluteInstanceDataDir(this.bshb),
      "backups",
    );
    return from(this.ensureDirectoryExists(backupDir)).pipe(
      switchMap(() => {
        const filePath = path.join(
          backupDir,
          this.createFileName(binaryResponse.fileName),
        );
        this.bshb.log.info(
          `[Backup] Data downloaded and file created: ${filePath}.`,
        );
        return from(fs.writeFile(filePath, binaryResponse.data));
      }),
    );
  }

  private deleteBackupFromController() {
    return this.getBshcClient().deleteBackup({ timeout: this.long_timeout });
  }

  private detectBackup() {
    return this.createBackupFolder().pipe(
      switchMap(() => this.createBackupStatusFolder()),
      switchMap(() =>
        this.getBshcClient()
          .getBackupStatus({ timeout: this.long_timeout })
          .pipe(
            mergeMap((response) =>
              from(Object.entries<[string, any]>(response.parsedResponse)),
            ),
            filter(([key, _]) => key !== "@type"),
            mergeMap(([key, value]) =>
              this.addState("backup.backupStatus", "BackupStatus", key, value),
            ),
          ),
      ),
      switchMap(() => this.createRestoreStatusFolder()),
      switchMap(() =>
        this.getBshcClient()
          .getRestoreStatus({ timeout: this.long_timeout })
          .pipe(
            mergeMap((response) =>
              from(Object.entries<[string, any]>(response.parsedResponse)),
            ),
            filter(([key, _]) => key !== "@type"),
            mergeMap(([key, value]) =>
              this.addState(
                "backup.restoreStatus",
                "RestoreStatus",
                key,
                value,
              ),
            ),
          ),
      ),
      switchMap(() => this.createBackupState()),
      switchMap(() => this.deleteBackupState()),
      switchMap(() => of(undefined)),
    );
  }

  private createBackupFolder() {
    return this.setObjectNotExistsAsync("backup", {
      type: "folder",
      common: {
        name: "backup",
        read: true,
      },
      native: {
        id: "backup",
      },
    });
  }

  private createBackupStatusFolder() {
    return this.setObjectNotExistsAsync("backup.backupStatus", {
      type: "folder",
      common: {
        name: "backupStatus",
        read: true,
      },
      native: {
        id: "backup.backupStatus",
      },
    });
  }

  private createRestoreStatusFolder() {
    return this.setObjectNotExistsAsync("backup.restoreStatus", {
      type: "folder",
      common: {
        name: "restoreStatus",
        read: true,
      },
      native: {
        id: "backup.restoreStatus",
      },
    });
  }

  private createBackupState() {
    const id = "backup.createBackup";
    return this.setObjectNotExistsAsync(id, {
      type: "state",
      common: {
        name: "Create Backup",
        type: "boolean",
        role: "switch",
        read: false,
        write: true,
      },
      native: {
        id: id,
      },
    }).pipe(tap(() => this.bshb.setState(id, { val: false, ack: true })));
  }

  private deleteBackupState() {
    const id = "backup.deleteBackup";
    return this.setObjectNotExistsAsync(id, {
      type: "state",
      common: {
        name: "Delete backup file on Controller",
        type: "boolean",
        role: "switch",
        read: false,
        write: true,
      },
      native: {
        id: id,
      },
    }).pipe(tap(() => this.bshb.setState(id, { val: false, ack: true })));
  }

  private addState(prefix: string, type: string, key: string, value: any) {
    const id = `${prefix}.${key}`;
    return this.setObjectNotExistsAsync(id, {
      type: "state",
      common: {
        name: key,
        type: BshbDefinition.determineType(value),
        role: BshbDefinition.determineRole(type, key, value),
        read: true,
        write: false,
        unit: BshbDefinition.determineUnit(type, key),
        states: BshbDefinition.determineStates(type, key),
      },
      native: {
        id: id,
      },
    }).pipe(tap(() => this.bshb.setState(id, { val: value, ack: true })));
  }

  private async ensureDirectoryExists(directoryPath: string) {
    try {
      await fs.access(directoryPath, fs.constants.F_OK);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        await fs.mkdir(directoryPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  private createFileName(fileName: string | undefined) {
    if (fileName) {
      return fileName;
    }

    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-based
    const day = String(now.getDate()).padStart(2, "0");

    return `shc-${year}${month}${day}.home`;
  }
}
