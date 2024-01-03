import {BshbHandler} from './bshb-handler';
import {map, Observable, of, tap} from 'rxjs';
import {switchMap} from 'rxjs/operators';

/**
 * This handler is used to detect messages from bshc
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
export class BshbMessagesHandler extends BshbHandler {

    public handleBshcUpdate(resultEntry: any): boolean {
        if (resultEntry['@type'] === 'message') {

            this.bshb.log.debug('Updating messages...');
            // we just trigger detection on changes of scenarios
            this.detectMessages().subscribe(this.handleBshcUpdateError(`id=${resultEntry.id}`));

            return true;
        }
        return false;
    }

    public handleDetection(): Observable<void> {
        return this.detectMessages().pipe(tap({
            subscribe: () => this.bshb.log.info('Start detecting messages...'),
            finalize: () => this.bshb.log.info('Detecting messages finished'),
        }));
    }

    public sendUpdateToBshc(id: string, state: ioBroker.State): Observable<boolean> {
        return of(false);
    }

    private detectMessages(): Observable<void> {
        return this.setObjectNotExistsAsync('messages', {
            type: 'state',
            common: {
                name: 'messages',
                type: 'array',
                role: 'list',
                write: false,
                read: true,
            },
            native: {
                id: 'messages',
                name: 'messages',
            },
        }).pipe(
            switchMap(() => this.getBshcClient().getMessages({timeout: this.long_timeout})),
            map(response => response.parsedResponse),
            tap(messages => this.bshb.setState('messages', {val: this.mapValueToStorage(messages), ack: true})),
            switchMap(() => of(undefined)),
        );
    }

    name(): string {
        return 'messageHandler';
    }
}