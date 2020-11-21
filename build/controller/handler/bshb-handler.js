"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BshbHandler = void 0;
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
}
exports.BshbHandler = BshbHandler;
