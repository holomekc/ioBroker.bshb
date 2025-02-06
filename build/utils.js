"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utils = void 0;
const log_level_1 = require("./log-level");
/**
 * This class contains helpful methods for the adapter
 *
 * @author Christopher Holomek
 * @since 01.12.2019
 */
class Utils {
    /**
     * Get key (identifier) for certificates stored in ioBroker itself
     *
     * @param identifier
     *        identifier is part of key so it is needed here
     */
    static getCertificateKeys(identifier) {
        return {
            cert: 'bshb_' + identifier + '_cert',
            key: 'bshb_' + identifier + '_key',
        };
    }
    /**
     * Create and log error
     * @param log
     *        logger to use
     * @param message
     *        message for log and error
     */
    static createError(log, message) {
        log.error(message);
        return new Error(message);
    }
    /**
     * Check if the specified level is active due to LogLevel
     * @param level
     *        actual log level
     * @param toCheck
     *        specify the LogLevel against you want to check the actual level.
     */
    static isLevelActive(level, toCheck) {
        if (!level) {
            return false;
        }
        let result = false;
        switch (level) {
            case 'silly':
                result = toCheck >= log_level_1.LogLevel.silly;
                break;
            case 'debug':
                result = toCheck >= log_level_1.LogLevel.debug;
                break;
            case 'info':
                result = toCheck >= log_level_1.LogLevel.info;
                break;
            case 'warn':
                result = toCheck >= log_level_1.LogLevel.warn;
                break;
            case 'error':
                result = toCheck >= log_level_1.LogLevel.error;
                break;
        }
        return result;
    }
    static handleError(message, cause) {
        return Utils.errorToString(new Error(message, { cause: cause }));
    }
    static errorToString(error) {
        let result = '';
        if (error) {
            result += error;
            const cause = error.cause;
            if (cause && cause instanceof Error) {
                result += '\n  [cause] ' + this.errorToString(cause);
            }
        }
        return result;
    }
}
exports.Utils = Utils;
//# sourceMappingURL=utils.js.map