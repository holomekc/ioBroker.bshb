"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbMessagesHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
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
    handleDetection() {
        this.bshb.log.info('Start detecting messages...');
        return this.detectMessages().pipe((0, rxjs_1.tap)({
            complete: () => this.bshb.log.info('Detecting messages finished')
        }));
    }
    sendUpdateToBshc(id, state) {
        return false;
    }
    detectMessages() {
        return (0, rxjs_1.from)(this.bshb.setObjectNotExistsAsync('messages', {
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
        })).pipe((0, operators_1.switchMap)(() => this.getBshcClient().getMessages({ timeout: this.long_timeout })), (0, rxjs_1.map)(response => response.parsedResponse), (0, rxjs_1.tap)(messages => this.bshb.setState('messages', { val: this.mapValueToStorage(messages), ack: true })), (0, operators_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
}
exports.BshbMessagesHandler = BshbMessagesHandler;
