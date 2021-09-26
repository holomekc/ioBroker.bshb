"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration = void 0;
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
/**
 * This class is used to migrate from old configuration to new one. This will be obsolete at some point.
 *
 * @author Christopher Holomek
 * @since 01.12.2019
 */
class Migration {
    /**
     * Load certificate from old configuration
     * @param bshb
     *        adapter
     * @param certsPath
     *        directory where certificate is placed
     */
    static loadCertificate(bshb, certsPath) {
        const path = `${certsPath}/${bshb.config.identifier}.pem`;
        if (!fs.existsSync(path)) {
            throw utils_1.Utils.createError(bshb.log, `Could not find client certificate for identifier: ${bshb.config.identifier}.`);
        }
        const result = fs.readFileSync(path, 'utf-8');
        bshb.log.info('Client certificate loaded successfully');
        return result;
    }
    /**
     * Load private key from old configuration
     * @param bshb
     *        adapter
     * @param certsPath
     *        directory where private key is placed
     */
    static loadPrivateKey(bshb, certsPath) {
        const path = `${certsPath}/${bshb.config.identifier}-key.pem`;
        if (!fs.existsSync(path)) {
            throw utils_1.Utils.createError(bshb.log, `Could not find client certificate for identifier: ${bshb.config.identifier}.`);
        }
        const result = fs.readFileSync(path, 'utf-8');
        bshb.log.info('Client private key loaded successfully');
        return result;
    }
}
exports.Migration = Migration;
//# sourceMappingURL=migration.js.map