"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ClientCert {
    constructor(certificate, privateKey) {
        this._certificate = certificate;
        this._privateKey = privateKey;
    }
    get certificate() {
        return this._certificate;
    }
    get privateKey() {
        return this._privateKey;
    }
}
exports.ClientCert = ClientCert;
