import {BshbHandler} from "./bshb-handler";
import {Observable, tap, of, from, map} from "rxjs";
import {switchMap} from "rxjs/operators";

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
            this.detectMessages().subscribe({
                next: () => {
                    // we do nothing here because we do not need to.
                    this.bshb.log.debug('Updating messages finished');
                }, error: error => {
                    this.bshb.log.warn('something went wrong during message detection');
                    this.bshb.log.warn(error);
                }
            });

            return true;
        }
        return false;
    }

    public handleDetection(): Observable<void> {
        this.bshb.log.info('Start detecting messages...');

        return this.detectMessages().pipe(tap({
            complete: () => this.bshb.log.info('Detecting messages finished')
        }));
    }

    public sendUpdateToBshc(id: string, state: ioBroker.State): boolean {
        return false;
    }

    private detectMessages(): Observable<void> {
        return from(this.bshb.setObjectNotExistsAsync('messages', {
            type: 'state',
            common: {
                name: 'messages',
                type: 'array',
                role: 'list',
                write: false,
                read: true
            },
            native: {
                id: 'messages',
                name: 'messages'
            },
        })).pipe(
            switchMap(() => this.getBshcClient().getMessages({timeout: this.long_timeout})),
            map(response => response.parsedResponse),
            tap(messages => this.bshb.setState('messages', {val: this.mapValueToStorage(messages), ack: true})),
            switchMap(() => of(undefined))
        );
    }

}