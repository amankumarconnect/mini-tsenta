import { defineConfig } from "@adonisjs/cors";

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
// Define Cross-Origin Resource Sharing (CORS) settings.
const corsConfig = defineConfig({
  enabled: true, // Enable CORS middleware.
  origin: true, // Allow requests from any origin (reflects the Origin header).
  methods: ["GET", "HEAD", "POST", "PUT", "DELETE"], // Allowed HTTP methods.
  headers: true, // Allow all requested headers.
  exposeHeaders: [], // Headers exposed to the browser.
  credentials: true, // Allow cookies/headers for authentication.
  maxAge: 90, // Cache preflight response for 90 seconds.
});

export default corsConfig;
