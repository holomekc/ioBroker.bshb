import { BshbHandler } from "./bshb-handler";
import { from, Observable, of, switchMap } from "rxjs";

export class BshbGeneralUpdateHandler extends BshbHandler {
  handleBshcUpdate(resultEntry: any): boolean {
    from(
      this.bshb.setState("updates", {
        val: this.mapValueToStorage(resultEntry),
        ack: true,
      }),
    ).subscribe(this.handleBshcUpdateError(`id=${resultEntry.id}`));
    // We do not mark all updates as handled.
    return false;
  }

  handleDetection(): Observable<void> {
    return this.setObjectNotExistsAsync("updates", {
      type: "state",
      common: {
        name: "Updates",
        type: "object",
        role: "json",
        write: false,
        read: true,
      },
      native: {
        id: "updates",
      },
    }).pipe(switchMap(() => of(undefined)));
  }

  sendUpdateToBshc(_id: string, _state: ioBroker.State): Observable<boolean> {
    // not needed
    return of(false);
  }

  name(): string {
    return "generalUpdateHandler";
  }
}
