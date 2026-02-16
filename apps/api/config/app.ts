import env from "#start/env";
import app from "@adonisjs/core/services/app";
import { Secret } from "@adonisjs/core/helpers";
import { defineConfig } from "@adonisjs/core/http";

/**
 * The app key is used for encrypting cookies, generating signed URLs,
 * and by the "encryption" module.
 *
 * The encryption module will fail to decrypt data if the key is lost or
 * changed. Therefore it is recommended to keep the app key secure.
 */
// Initialize the app key secret from environment variables.
export const appKey = new Secret(env.get("APP_KEY"));

/**
 * The configuration settings used by the HTTP server
 */
export const http = defineConfig({
  generateRequestId: true, // Generate a unique ID for each HTTP request.
  allowMethodSpoofing: false, // Disable method spoofing (e.g. using _method input to simulate PUT/DELETE).

  /**
   * Enabling async local storage will let you access HTTP context
   * from anywhere inside your application.
   */
  useAsyncLocalStorage: false, // Disabled by default for performance/simplicity.

  /**
   * Manage cookies configuration. The settings for the session id cookie are
   * defined inside the "config/session.ts" file.
   */
  cookie: {
    domain: "", // Cookie domain (empty means current domain).
    path: "/", // Cookie path.
    maxAge: "2h", // Cookie expiration time.
    httpOnly: true, // Prevent JavaScript access to cookies (security).
    secure: app.inProduction, // Send cookies only over HTTPS in production.
    sameSite: "lax", // CSRF protection setting.
  },
});
