import {BshbHandler} from './bshb-handler';
import {Observable, of} from 'rxjs';
import {switchMap} from 'rxjs/operators';

export class BshbDeviceStatusUpdateHandler extends BshbHandler {
    handleDetection(): Observable<void> {
        // No detection needed here. This is part of the device handler. Initial values also handled there.
        return of(undefined);
    }

    sendUpdateToBshc(_id: string, _state: ioBroker.State): Observable<boolean> {
        // Only read. So no sending.
        return of(false);
    }

    handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry['@type'] === 'message' && resultEntry.sourceType === 'DEVICE' && resultEntry.sourceId) {
            this.bshb.log.debug('Try updating status of device ' + resultEntry.sourceId);

            const statusId = `${resultEntry.sourceId}.status`;

            this.getBshcClient().getDevice(resultEntry.sourceId).pipe(
                switchMap(result => this.setInitialStateValueIfNotSet(statusId, null, result.parsedResponse.status))
            ).subscribe(this.handleBshcUpdateError(`id=${resultEntry.id}`));

            return true;
        }
        return false;
    }

    name(): string {
        return 'deviceStatusUpdateHandler';
    }

}