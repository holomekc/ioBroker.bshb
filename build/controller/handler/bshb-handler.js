"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbHandler = void 0;
const rxjs_1 = require("rxjs");
/**
 * Abstract handler which can be used to handle the following things:<br/>
 * 1. detecting devices etc.<br/>
 * 2. handle updates from bshc controller.<br/>
 * 3. send messages to bshc controller.<br/>
 *
 * @author Christopher Holomek
 * @since 18.01.2020
 */
class BshbHandler {
    /**
     * Create a new handler
     *
     * @param bshb
     *        adapter main class
     * @param boschSmartHomeBridge
     *        bshb
     */
    constructor(bshb, boschSmartHomeBridge) {
        this.bshb = bshb;
        this.boschSmartHomeBridge = boschSmartHomeBridge;
        this.long_timeout = 5000;
        this.chain = Promise.resolve();
    }
    /**
     * Get bshb client
     */
    getBshcClient() {
        return this.boschSmartHomeBridge.getBshcClient();
    }
    mapValueToStorage(value) {
        if (typeof value === "object") {
            return JSON.stringify(value);
        }
        else if (Array.isArray(value)) {
            return JSON.stringify(value);
        }
        return value;
    }
    mapValueFromStorage(id, value) {
        return new rxjs_1.Observable(subscriber => {
            if (typeof value === "string") {
                // in case we see a string we check object.common.type for array or object.
                this.bshb.getObject(id, (error, object) => {
                    if (object && object.common && (object.common.type === 'array' || object.common.type === 'object')) {
                        try {
                            subscriber.next(JSON.parse(value));
                            subscriber.complete();
                            return;
                        }
                        catch (e) {
                            this.bshb.log.info(`Could not parse value "${value}" for id "${id}". Continue with actual value: ${e.message}`);
                        }
                    }
                    // If condition does not apply or something went wrong we continue with untouched value.
                    subscriber.next(value);
                    subscriber.complete();
                });
            }
            else {
                // No string so no mapping
                subscriber.next(value);
                subscriber.complete();
            }
        });
    }
}
exports.BshbHandler = BshbHandler;
