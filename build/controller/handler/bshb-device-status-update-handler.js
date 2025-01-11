"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbDeviceStatusUpdateHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
class BshbDeviceStatusUpdateHandler extends bshb_handler_1.BshbHandler {
    handleDetection() {
        // No detection needed here. This is part of the device handler. Initial values also handled there.
        return (0, rxjs_1.of)(undefined);
    }
    sendUpdateToBshc(_id, _state) {
        // Only read. So no sending.
        return (0, rxjs_1.of)(false);
    }
    handleBshcUpdate(resultEntry) {
        if (resultEntry["@type"] === "message" &&
            resultEntry.sourceType === "DEVICE" &&
            resultEntry.sourceId) {
            this.bshb.log.debug("Try updating status of device " + resultEntry.sourceId);
            const statusId = `${resultEntry.sourceId}.status`;
            this.getBshcClient()
                .getDevice(resultEntry.sourceId)
                .pipe((0, operators_1.switchMap)((result) => this.setInitialStateValueIfNotSet(statusId, null, result.parsedResponse.status)))
                .subscribe(this.handleBshcUpdateError(`id=${resultEntry.id}`));
            return true;
        }
        return false;
    }
    name() {
        return "deviceStatusUpdateHandler";
    }
}
exports.BshbDeviceStatusUpdateHandler = BshbDeviceStatusUpdateHandler;
//# sourceMappingURL=bshb-device-status-update-handler.js.map