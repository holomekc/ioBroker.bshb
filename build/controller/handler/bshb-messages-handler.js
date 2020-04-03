"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
/**
 * This handler is used to detect messages from bshc
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
class BshbMessagesHandler extends bshb_handler_1.BshbHandler {
    handleBshcUpdate(resultEntry) {
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
    handleDetection() {
        this.bshb.log.info('Start detecting messages...');
        // we need to do that because of concat
        return new rxjs_1.Observable(subscriber => {
            this.detectMessages().subscribe(() => {
                this.bshb.log.info('Detecting messages finished');
                subscriber.next();
                subscriber.complete();
            });
        });
    }
    sendUpdateToBshc(id, state) {
        return false;
    }
    detectMessages() {
        return new rxjs_1.Observable(subscriber => {
            this.getBshcClient().getMessages({ timeout: this.long_timeout }).subscribe(response => {
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
                this.bshb.setState('messages', { val: messages, ack: true });
                subscriber.next();
                subscriber.complete();
            }, err => {
                subscriber.error(err);
            });
        });
    }
}
exports.BshbMessagesHandler = BshbMessagesHandler;
