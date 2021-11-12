"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbGeneralUpdateHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
class BshbGeneralUpdateHandler extends bshb_handler_1.BshbHandler {
    handleBshcUpdate(resultEntry) {
        (0, rxjs_1.from)(this.bshb.setStateAsync('updates', { val: this.mapValueToStorage(resultEntry), ack: true })).subscribe({
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
    handleDetection() {
        return (0, rxjs_1.from)(this.bshb.setObjectNotExistsAsync('updates', {
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
        })).pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    sendUpdateToBshc(id, state) {
        // not needed
        return false;
    }
}
exports.BshbGeneralUpdateHandler = BshbGeneralUpdateHandler;
//# sourceMappingURL=bshb-general-update-handler.js.map