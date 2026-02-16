import env from "#start/env";
import app from "@adonisjs/core/services/app";
import { defineConfig, targets } from "@adonisjs/core/logger";

// Configure the application logger.
const loggerConfig = defineConfig({
  default: "app", // Default logger instance.

  /**
   * The loggers object can be used to define multiple loggers.
   * By default, we configure only one logger (named "app").
   */
  loggers: {
    app: {
      enabled: true, // Enable logging.
      name: env.get("APP_NAME"), // App name from environment.
      level: env.get("LOG_LEVEL"), // Log level (e.g., info, debug) from environment.
      transport: {
        targets: targets()
          // Use pretty printing for logs if not in production.
          .pushIf(!app.inProduction, targets.pretty())
          // Log to a file if in production (descriptor 1 is usually stdout, but structure implies file target config).
          .pushIf(app.inProduction, targets.file({ destination: 1 }))
          .toArray(),
      },
    },
  },
});

export default loggerConfig;

/**
 * Inferring types for the list of loggers you have configured
 * in your application.
 */
declare module "@adonisjs/core/types" {
  // Register the logger config types globally.
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
