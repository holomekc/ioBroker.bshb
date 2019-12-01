"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const utils_1 = require("./utils");
/**
 * This class is used to migrate from old configuration to new one. This will be obsolete at some point.
 *
 * @author Christopher Holomek
 * @since 01.12.2019
 */
class Migration {
    static loadCertificate(bshb, certsPath) {
        const path = `${certsPath}/${bshb.config.identifier}.pem`;
        if (!fs.existsSync(path)) {
            throw utils_1.Utils.throwError(bshb.log, `Could not find client certificate for identifier: ${bshb.config.identifier}.`);
        }
        const result = fs.readFileSync(path, 'utf-8');
        bshb.log.info('Client certificate loaded successfully');
        return result;
    }
    static loadPrivateKey(bshb, certsPath) {
        const path = `${certsPath}/${bshb.config.identifier}-key.pem`;
        if (!fs.existsSync(path)) {
            throw utils_1.Utils.throwError(bshb.log, `Could not find client certificate for identifier: ${bshb.config.identifier}.`);
        }
        const result = fs.readFileSync(path, 'utf-8');
        bshb.log.info('Client private key loaded successfully');
        return result;
    }
}
exports.Migration = Migration;
