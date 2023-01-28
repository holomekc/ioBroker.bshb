import {BshbHandler} from './bshb-handler';
import {from, Observable, of} from 'rxjs';
import {switchMap} from 'rxjs/operators';

export class BshbDeviceStatusUpdateHandler extends BshbHandler {
    handleDetection(): Observable<void> {
        // No detection needed here. This is part of the device handler. Initial values also handled there.
        return of(undefined);
    }

    sendUpdateToBshc(id: string, state: ioBroker.State): boolean {
        // Only read. So no sending.
        return false;
    }

    handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry['@type'] === 'message' && resultEntry.sourceType === 'DEVICE' && resultEntry.sourceId) {
            this.bshb.log.debug('Try updating status of device ' + resultEntry.sourceId);

            const statusId = `${resultEntry.sourceId}.status`;

            this.getBshcClient().getDevice(resultEntry.sourceId).pipe(
                switchMap(result => this.setInitialStateValueIfNotSet(statusId, null, result.parsedResponse.status))
            ).subscribe();

            return true;
        }
        return false;
    }

}