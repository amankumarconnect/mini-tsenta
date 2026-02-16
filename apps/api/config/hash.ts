import { defineConfig, drivers } from "@adonisjs/core/hash";

// Configure the password hashing service.
const hashConfig = defineConfig({
  default: "scrypt", // Use 'scrypt' as the default driver.

  list: {
    scrypt: drivers.scrypt({
      cost: 16384, // CPU/memory cost parameter.
      blockSize: 8, // Block size parameter.
      parallelization: 1, // Parallelization factor.
      maxMemory: 33554432, // Max memory usage.
    }),
  },
});

export default hashConfig;

/**
 * Inferring types for the list of hashers you have configured
 * in your application.
 */
declare module "@adonisjs/core/types" {
  // Register the hash config types globally.
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
