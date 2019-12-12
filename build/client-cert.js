"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Container class for certificate and private key of client certificate.
 *
 * @author Christopher Holomek
 * @since 01.12.2019
 */
class ClientCert {
    constructor(certificate, privateKey) {
        this._certificate = certificate;
        this._privateKey = privateKey;
    }
    /**
     * Get certificate of client certificate
     */
    get certificate() {
        return this._certificate;
    }
    /**
     * Get private key of client certificate
     */
    get privateKey() {
        return this._privateKey;
    }
}
exports.ClientCert = ClientCert;
