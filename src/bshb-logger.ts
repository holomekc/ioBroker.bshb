import {Logger} from 'bosch-smart-home-bridge';
import {Bshb} from './main';

/**
 * This class implements the logger of bosch-smart-home-bridge and forward it to iobroker
 *
 * @author Christopher Holomek
 * @since 27.09.2019
 */
export class BshbLogger implements Logger {

    constructor(private adapter: Bshb) {
    }

    fine(message?: any, ...optionalParams: any[]): void {
        // We ignore fine so far. Because it is very detailed
        this.log('silly', message, optionalParams);
    }

    debug(message?: any, ...optionalParams: any[]): void {
        this.log('debug', message, optionalParams);
    }

    info(message?: any, ...optionalParams: any[]): void {
        this.log('info', message, optionalParams);
    }

    error(message?: any, ...optionalParams: any[]): void {
        // debug may look strange here but we do not care about the logs of errors during http calls because we handle
        // them in the adapter. Errors would only confuse users.
        this.log('debug', message, optionalParams);
    }

    warn(message?: any, ...optionalParams: any[]): void {
        this.log('warn', message, optionalParams);
    }

    private log(msgType: 'debug' | 'info' | 'warn' | 'error' | 'silly', message?: any, ...optionalParams: any[]) {
        if (message) {
            if (optionalParams[0].length > 0) {
                let concatMessage = message;
                optionalParams.forEach(value => {
                    if (typeof value === 'object') {
                        concatMessage += ' - ' + JSON.stringify(value);
                    } else {
                        concatMessage += ' - ' + value;
                    }
                });
                this.adapter.log[msgType](concatMessage);
            } else {
                this.adapter.log[msgType](message);
            }
        } else {
            if (optionalParams[0].length > 0) {
                let concatMessage = '';
                optionalParams.forEach(value => {
                    if (typeof value === 'object') {
                        concatMessage += ' - ' + JSON.stringify(value);
                    } else {
                        concatMessage += ' - ' + value;
                    }
                });
                this.adapter.log[msgType](concatMessage);
            } else {
                this.adapter.log[msgType]('');
            }
        }
    }
}