import * as fs from "fs";
import { Bshb } from "./main";
import { Utils } from "./utils";

/**
 * This class is used to migrate from old configuration to new one. This will be obsolete at some point.
 *
 * @author Christopher Holomek
 * @since 01.12.2019
 */
export class Migration {
  /**
   * Load certificate from old configuration
   * @param bshb
   *        adapter
   * @param certsPath
   *        directory where certificate is placed
   */
  public static loadCertificate(bshb: Bshb, certsPath: string): string {
    const path = `${certsPath}/${bshb.config.identifier}.pem`;
    if (!fs.existsSync(path)) {
      throw Utils.createError(
        bshb.log,
        `Could not find client certificate for identifier: ${bshb.config.identifier}.`,
      );
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
  public static loadPrivateKey(bshb: Bshb, certsPath: string): string {
    const path = `${certsPath}/${bshb.config.identifier}-key.pem`;
    if (!fs.existsSync(path)) {
      throw Utils.createError(
        bshb.log,
        `Could not find client certificate for identifier: ${bshb.config.identifier}.`,
      );
    }

    const result = fs.readFileSync(path, "utf-8");
    bshb.log.info("Client private key loaded successfully");
    return result;
  }
}
