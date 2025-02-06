"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbHandler = void 0;
const operators_1 = require("rxjs/operators");
const rxjs_1 = require("rxjs");
const utils_1 = require("../../utils");
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
    bshb;
    boschSmartHomeBridge;
    long_timeout = 20000;
    enumChain = new rxjs_1.Subject();
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
        this.enumChain
            .pipe((0, rxjs_1.concatMap)(enumObj => {
            if (enumObj.itemId) {
                return (0, rxjs_1.from)(this.bshb.addStateToEnumAsync(enumObj.type, enumObj.name, enumObj.deviceId, enumObj.deviceServiceId, enumObj.itemId));
            }
            else {
                return (0, rxjs_1.from)(this.bshb.addChannelToEnumAsync(enumObj.type, enumObj.name, enumObj.deviceId, enumObj.deviceServiceId));
            }
        }))
            .subscribe({
            next: () => { },
            error: err => this.bshb.log.warn(utils_1.Utils.handleError('Could not add enum', err)),
        });
    }
    /**
     * Get bshb client
     */
    getBshcClient() {
        return this.boschSmartHomeBridge.getBshcClient();
    }
    addRoomEnum(name, deviceId, deviceServiceId, itemId) {
        if (name) {
            name = name.trim();
            if (name && name.length > 0) {
                this.addEnum('rooms', name, deviceId, deviceServiceId, itemId);
            }
        }
    }
    addFunctionEnum(name, deviceId, deviceServiceId, itemId) {
        if (name) {
            name = name.trim();
            if (name && name.length > 0) {
                this.addEnum('functions', name, deviceId, deviceServiceId, itemId);
            }
        }
    }
    addEnum(type, name, deviceId, deviceServiceId, itemId) {
        this.enumChain.next({
            type: type,
            name: name,
            deviceId: deviceId,
            deviceServiceId: deviceServiceId,
            itemId: itemId,
        });
    }
    mapValueToStorage(value) {
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        else if (Array.isArray(value)) {
            return JSON.stringify(value);
        }
        return value;
    }
    mapValueFromStorage(id, value) {
        return new rxjs_1.Observable(subscriber => {
            if (typeof value === 'string') {
                // in case we see a string we check object.common.type for array or object.
                this.bshb.getObject(id, (_error, object) => {
                    if (object &&
                        object.common &&
                        (object.common.type === 'array' || object.common.type === 'object' || object.common.type === 'json')) {
                        try {
                            subscriber.next(JSON.parse(value));
                            subscriber.complete();
                            return;
                        }
                        catch (e) {
                            if (e instanceof Error) {
                                this.bshb.log.info(`Could not parse value "${value}" for id "${id}". Continue with actual value: ${e.message}`);
                            }
                            else {
                                this.bshb.log.info(`Could not parse value "${value}" for id "${id}". Continue with actual value: ${e}`);
                            }
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
    /**
     * A custom implementation of setObjectNotExistsAsync object is always provided, and it does not
     * matter if object was created or not. At the moment there is no way to distinguish between creation
     * and no creation. We will see if this is sufficient.
     * @param id id to set
     * @param object object ot create if not exists
     * @param options optional options
     */
    setObjectNotExistsAsync(id, object, options) {
        return (0, rxjs_1.from)(this.bshb.getObjectAsync(id, options)).pipe((0, rxjs_1.switchMap)(obj => {
            if (!obj) {
                return (0, rxjs_1.from)(this.bshb.setObject(id, object)).pipe((0, operators_1.tap)(o => {
                    if (o) {
                        o._bshbCreated = true;
                    }
                }), (0, rxjs_1.map)(o => o));
            }
            else {
                obj._bshbCreated = false;
                return (0, rxjs_1.of)(obj);
            }
        }));
    }
    setInitialStateValueIfNotSet(id, state, value) {
        if (state) {
            return this.mapValueFromStorage(id, state.val).pipe((0, operators_1.tap)(value => {
                if (value !== value) {
                    // only set again if a change is detected.
                    this.bshb.setState(id, {
                        val: this.mapValueToStorage(value),
                        ack: true,
                    });
                }
            }), (0, rxjs_1.switchMap)(() => (0, rxjs_1.of)(undefined)));
        }
        else {
            // no previous state so we set it
            this.bshb.setState(id, { val: this.mapValueToStorage(value), ack: true });
            // we do not wait
            return (0, rxjs_1.of)(undefined);
        }
    }
    handleBshcUpdateError(...params) {
        return {
            next: () => this.bshb.log.debug(`Handled update for "${this.name()}" successfully.`),
            error: err => this.logWarn(`Could not handle update for "${this.name()}" with ${params}.`, err),
        };
    }
    handleBshcSendError(...params) {
        return {
            next: () => this.bshb.log.debug(`Send message for "${this.name()}" successfully.`),
            error: err => this.logWarn(`Could not send update for "${this.name()}" with ${params}.`, err),
        };
    }
    logWarn(message, cause) {
        this.bshb.log.warn(utils_1.Utils.handleError(message, cause));
    }
}
exports.BshbHandler = BshbHandler;
//# sourceMappingURL=bshb-handler.js.map