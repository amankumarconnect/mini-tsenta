/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from "@adonisjs/core/env";

// Define and validate environment variables.
export default await Env.create(new URL("../", import.meta.url), {
  // Node environment: development, production, or test.
  NODE_ENV: Env.schema.enum(["development", "production", "test"] as const),
  // Server port.
  PORT: Env.schema.number(),
  // Application key for encryption.
  APP_KEY: Env.schema.string(),
  // Server host.
  HOST: Env.schema.string({ format: "host" }),
  // Logging level.
  LOG_LEVEL: Env.schema.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  // Database configuration variables.
  DB_HOST: Env.schema.string({ format: "host" }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
  DATABASE_URL: Env.schema.string(), // Full connection string if used.
});
