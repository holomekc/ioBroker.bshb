import {BshbHandler} from './bshb-handler';
import {from, Observable, of, switchMap} from 'rxjs';

export class BshbGeneralUpdateHandler extends BshbHandler {

    handleBshcUpdate(resultEntry: any): boolean {
        from(this.bshb.setStateAsync('updates', {val: this.mapValueToStorage(resultEntry), ack: true})).subscribe({
            next: () => {
                // We do not log this because all updates can be seen on silly anyway and this would be too much I guess.
            }, error: error => {
                this.bshb.log.warn('Error occurred while updating "updates" state.');
                this.bshb.log.warn(error);
            }
        });
        // We do not mark all updates as handled.
        return false;
    }

    handleDetection(): Observable<void> {
        return this.setObjectNotExistsAsync('updates', {
            type: 'state',
            common: {
                name: 'Updates',
                type: 'object',
                role: 'json',
                write: false,
                read: true
            },
            native: {
                id: 'updates'
            }
        }).pipe(
            switchMap(() => of(undefined))
        );
    }

    sendUpdateToBshc(id: string, state: ioBroker.State): boolean {
        // not needed
        return false;
    }
}
