"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_level_1 = require("./log-level");
class Utils {
    static getCertificateKeys(identifier) {
        return {
            cert: 'bshb_' + identifier + '_cert',
            key: 'bshb_' + identifier + '_key'
        };
    }
    static throwError(log, message) {
        log.error(message);
        return new Error(message);
    }
    static isLevelActive(level, toCheck) {
        if (!level) {
            return false;
        }
        let result = false;
        switch (level) {
            case 'silly':
                result = toCheck <= log_level_1.LogLevel.silly;
                break;
            case 'debug':
                result = toCheck <= log_level_1.LogLevel.debug;
                break;
            case 'info':
                result = toCheck <= log_level_1.LogLevel.info;
                break;
            case 'warn':
                result = toCheck <= log_level_1.LogLevel.warn;
                break;
            case 'error':
                result = toCheck <= log_level_1.LogLevel.error;
                break;
        }
        return result;
    }
}
exports.Utils = Utils;
