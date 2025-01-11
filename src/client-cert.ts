/**
 * Container class for certificate and private key of client certificate.
 *
 * @author Christopher Holomek
 * @since 01.12.2019
 */
export class ClientCert {
  private readonly _certificate: string;
  private readonly _privateKey: string;

  constructor(certificate: string, privateKey: string) {
    this._certificate = certificate;
    this._privateKey = privateKey;
  }

  /**
   * Get certificate of client certificate
   */
  get certificate(): string {
    return this._certificate;
  }

  /**
   * Get private key of client certificate
   */
  get privateKey(): string {
    return this._privateKey;
  }
}
