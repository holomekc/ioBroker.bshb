"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbMotionLightsHandler = void 0;
const bshb_handler_1 = require("./bshb-handler");
const rxjs_1 = require("rxjs");
const bshb_definition_1 = require("../../bshb-definition");
class BshbMotionLightsHandler extends bshb_handler_1.BshbHandler {
    regex = /bshb\.\d+\.motionlight\.(.*)/;
    cachedStates = new Map();
    handleDetection() {
        return this.detectMotionLights().pipe((0, rxjs_1.tap)({
            subscribe: () => this.bshb.log.info("Start detecting motion lights..."),
            finalize: () => this.bshb.log.info("Detecting motion lights finished"),
        }));
    }
    handleBshcUpdate(resultEntry) {
        if (resultEntry["@type"] === "motionlight") {
            const idPrefix = `motionlight.${resultEntry.id}`;
            Object.keys(resultEntry).forEach((key) => {
                const id = `${idPrefix}.${key}`;
                (0, rxjs_1.from)(this.bshb.getObjectAsync(id))
                    .pipe((0, rxjs_1.switchMap)((obj) => {
                    if (obj) {
                        this.bshb.setState(id, {
                            val: this.mapValueToStorage(resultEntry[key]),
                            ack: true,
                        });
                        return (0, rxjs_1.of)(undefined);
                    }
                    else {
                        return this.importState(key, resultEntry);
                    }
                }))
                    .subscribe(this.handleBshcUpdateError(`id=${resultEntry.id}`));
            });
            return true;
        }
        return false;
    }
    sendUpdateToBshc(id, state) {
        const match = this.regex.exec(id);
        let result = (0, rxjs_1.of)(false);
        if (match) {
            const cachedState = this.cachedStates.get(id);
            const data = {};
            result = this.mapValueFromStorage(id, state.val)
                .pipe((0, rxjs_1.map)((mappedValue) => (data[cachedState.key] = mappedValue)), (0, rxjs_1.switchMap)(() => this.getBshcClient().updateMotionLights(cachedState.id, data, {
                timeout: this.long_timeout,
            })))
                .pipe((0, rxjs_1.tap)(this.handleBshcSendError(`id=${match[1]}, value=${state.val}`)), (0, rxjs_1.map)(() => true));
        }
        return result;
    }
    detectMotionLights() {
        return this.setObjectNotExistsAsync("motionlight", {
            type: "folder",
            common: {
                name: "motionlight",
                read: true,
            },
            native: {},
        }).pipe((0, rxjs_1.switchMap)(() => this.getBshcClient().getMotionLights({ timeout: this.long_timeout })), (0, rxjs_1.mergeMap)((response) => (0, rxjs_1.from)(response.parsedResponse)), (0, rxjs_1.mergeMap)((waterLight) => this.addMotionLight(waterLight)), (0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
    }
    addMotionLight(motionLight) {
        return this.getBshcClient()
            .getDevice(motionLight.id)
            .pipe((0, rxjs_1.map)((response) => response.parsedResponse), (0, rxjs_1.switchMap)((device) => this.setObjectNotExistsAsync(`motionlight.${motionLight.id}`, {
            type: "channel",
            common: {
                name: device ? device.name : motionLight.id,
            },
            native: {},
        })), (0, rxjs_1.mergeMap)(() => (0, rxjs_1.from)(Object.keys(motionLight))), (0, rxjs_1.mergeMap)((key) => this.importState(key, motionLight)));
    }
    importState(key, motionLight) {
        if (key === "@type" || key === "id" || key === "motionDetectorId") {
            return (0, rxjs_1.of)(undefined);
        }
        const id = `motionlight.${motionLight.id}.${key}`;
        const value = motionLight[key];
        this.cachedStates.set(`${this.bshb.namespace}.${id}`, {
            id: motionLight.id,
            key: key,
        });
        return this.setObjectNotExistsAsync(id, {
            type: "state",
            common: {
                name: key,
                type: bshb_definition_1.BshbDefinition.determineType(value),
                role: bshb_definition_1.BshbDefinition.determineRole("motionlight", key, value),
                read: true,
                write: true,
            },
            native: {},
        }).pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.bshb.getStateAsync(id))), (0, rxjs_1.switchMap)((state) => this.setInitialStateValueIfNotSet(id, state, value)));
    }
    name() {
        return "motionLightsHandler";
    }
}
exports.BshbMotionLightsHandler = BshbMotionLightsHandler;
//# sourceMappingURL=bshb-motion-lights-handler.js.map