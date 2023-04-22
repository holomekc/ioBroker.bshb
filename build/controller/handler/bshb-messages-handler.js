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
            this.detectMessages().subscribe(this.handleBshcUpdateError(`id=${resultEntry.id}`));
            return true;
        }
        return false;
    }
    handleDetection() {
        return this.detectMessages().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info('Start detecting messages...'),
            finalize: () => this.bshb.log.info('Detecting messages finished'),
        }));
    }
    sendUpdateToBshc(id, state) {
        return false;
    }
    detectMessages() {
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
        }).pipe((0, operators_1.switchMap)(() => this.getBshcClient().getMessages({ timeout: this.long_timeout })), (0, rxjs_1.map)(response => response.parsedResponse), (0, rxjs_1.tap)(messages => this.bshb.setState('messages', { val: this.mapValueToStorage(messages), ack: true })), (0, operators_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    name() {
        return 'messageHandler';
    }
}
exports.BshbMessagesHandler = BshbMessagesHandler;
//# sourceMappingURL=bshb-messages-handler.js.map