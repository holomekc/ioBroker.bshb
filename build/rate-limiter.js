"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = void 0;
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const rateLimit = (interval, bshb) => {
    let last = -1;
    return (0, rxjs_1.pipe)((0, rxjs_1.mergeMap)((v) => {
        let result = (0, rxjs_1.of)(v).pipe((0, operators_1.tap)(() => (last = Date.now())));
        if (interval === 0) {
            bshb.log.silly('rateLimit disabled.');
            // Disabled
        }
        else {
            const now = Date.now();
            if (last !== -1 && now - last < interval) {
                const newDelay = interval - (now - last);
                bshb.log.silly(`delay request due to rate limit for ${newDelay} ms.`);
                result = (0, rxjs_1.of)(v)
                    .pipe((0, operators_1.delay)(newDelay))
                    .pipe((0, operators_1.tap)(() => (last = Date.now())));
            }
        }
        return result;
    }));
};
exports.rateLimit = rateLimit;
//# sourceMappingURL=rate-limiter.js.map
