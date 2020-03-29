import {BshbHandler} from "./bshb-handler";
import {Observable} from "rxjs";

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
            this.detectMessages().subscribe(() => {
                // we do nothing here because we do not need to.
                this.bshb.log.debug('Updating messages finished');
            }, error => {
                this.bshb.log.warn('something went wrong during message detection');
                this.bshb.log.warn(error);
            });

            return true;
        }
        return false;
    }

    public handleDetection(): Observable<void> {
        this.bshb.log.info('Start detecting messages...');

        // we need to do that because of concat
        return new Observable<void>(subscriber => {
            this.detectMessages().subscribe(() => {
                this.bshb.log.info('Detecting messages finished');

                subscriber.next();
                subscriber.complete();
            });
        });
    }

    public sendUpdateToBshc(id: string, state: ioBroker.State): boolean {
        return false;
    }

    private detectMessages(): Observable<void> {
        return new Observable<void>(subscriber => {
            this.getBshcClient().getMessages({timeout: this.long_timeout}).subscribe(response => {
                const messages = response.parsedResponse;

                this.bshb.setObjectNotExists('messages', {
                    type: 'state',
                    common: {
                        name: 'messages',
                        type: 'object',
                        role: 'state',
                        write: false,
                        read: true
                    },
                    native: {
                        id: 'messages',
                        name: 'messages'
                    },
                });

                this.bshb.setState('messages', {val: messages, ack: true});

                subscriber.next();
                subscriber.complete();
            });
        });
    }

}