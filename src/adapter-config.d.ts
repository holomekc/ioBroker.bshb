// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig

declare global {
  namespace ioBroker {
    interface AdapterConfig {
      // Define the shape of your options here (recommended)
      host: string;
      identifier: string;
      systemPassword: string;
      pairingDelay: number;
      rateLimit: number;
      skipServerCertificateCheck: boolean;

      // Or use a catch-all approach
      [key: string]: any;
    }
  }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
