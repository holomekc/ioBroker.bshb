import {LogLevel} from './log-level';

/**
 * This class contains helpful methods for the adapter
 *
 * @author Christopher Holomek
 * @since 01.12.2019
 */
export class Utils {

    /**
     * Get key (identifier) for certificates stored in ioBroker itself
     *
     * @param identifier
     *        identifier is part of key so it is needed here
     */
    public static getCertificateKeys(identifier: string) {
        return {
            cert: 'bshb_' + identifier + '_cert',
            key: 'bshb_' + identifier + '_key'
        }
    }

    /**
     * Create and log error
     * @param log
     *        logger to use
     * @param message
     *        message for log and error
     */
    public static createError(log: ioBroker.Logger, message: string) {
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
    public static isLevelActive(level: string, toCheck: LogLevel) {
        if (!level) {
            return false;
        }
        let result = false;
        switch (level) {
            case 'silly':
                result = toCheck >= LogLevel.silly;
                break;
            case 'debug':
                result = toCheck >= LogLevel.debug;
                break;
            case 'info':
                result = toCheck >= LogLevel.info;
                break;
            case 'warn':
                result = toCheck >= LogLevel.warn;
                break;
            case 'error':
                result = toCheck >= LogLevel.error;
                break;
        }
        return result;

    }
}