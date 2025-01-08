"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
        const result = fs.readFileSync(path, "utf-8");
        bshb.log.info("Client certificate loaded successfully");
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
        const result = fs.readFileSync(path, "utf-8");
        bshb.log.info("Client private key loaded successfully");
        return result;
    }
}
exports.Migration = Migration;
//# sourceMappingURL=migration.js.map