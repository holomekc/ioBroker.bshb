"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbGeneralUpdateHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
class BshbGeneralUpdateHandler extends bshb_handler_1.BshbHandler {
    handleBshcUpdate(resultEntry) {
        (0, rxjs_1.from)(this.bshb.setState("updates", {
            val: this.mapValueToStorage(resultEntry),
            ack: true,
        })).subscribe(this.handleBshcUpdateError(`id=${resultEntry.id}`));
        // We do not mark all updates as handled.
        return false;
    }
    handleDetection() {
        return this.setObjectNotExistsAsync("updates", {
            type: "state",
            common: {
                name: "Updates",
                type: "object",
                role: "json",
                write: false,
                read: true,
            },
            native: {
                id: "updates",
            },
        }).pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    sendUpdateToBshc(_id, _state) {
        // not needed
        return (0, rxjs_1.of)(false);
    }
    name() {
        return "generalUpdateHandler";
    }
}
exports.BshbGeneralUpdateHandler = BshbGeneralUpdateHandler;
//# sourceMappingURL=bshb-general-update-handler.js.map