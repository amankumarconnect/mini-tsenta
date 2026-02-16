import { defineConfig } from "@adonisjs/core/app"; // Import 'defineConfig' to create a type-safe AdonisJS application configuration.

export default defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Experimental flags
  |--------------------------------------------------------------------------
  |
  | The following features will be enabled by default in the next major release
  | of AdonisJS. You can opt into them today to avoid any breaking changes
  | during upgrade.
  |
  */
  experimental: {
    mergeMultipartFieldsAndFiles: true, // Enable merging of multipart fields and files in the request body.
    shutdownInReverseOrder: true, // graceful shutdown in reverse order of boot.
  },

  /*
  |--------------------------------------------------------------------------
  | Commands
  |--------------------------------------------------------------------------
  |
  | List of ace commands to register from packages. The application commands
  | will be scanned automatically from the "./commands" directory.
  |
  */
  commands: [
    () => import("@adonisjs/core/commands"), // Lazy load core AdonisJS commands.
    () => import("@adonisjs/lucid/commands"), // Lazy load Lucid (ORM) commands.
  ],

  /*
  |--------------------------------------------------------------------------
  | Service providers
  |--------------------------------------------------------------------------
  |
  | List of service providers to import and register when booting the
  | application
  |
  */
  providers: [
    () => import("@adonisjs/core/providers/app_provider"), // Register the main application provider (Core).
    () => import("@adonisjs/core/providers/hash_provider"), // Register the hashing service provider.
    {
      file: () => import("@adonisjs/core/providers/repl_provider"), // Register the REPL provider for interactive shell.
      environment: ["repl", "test"], // Only load the REPL provider in 'repl' and 'test' environments.
    },
    () => import("@adonisjs/core/providers/vinejs_provider"), // Register VineJS for data validation.
    () => import("@adonisjs/cors/cors_provider"), // Register the CORS provider for handling Cross-Origin Resource Sharing.
    () => import("@adonisjs/lucid/database_provider"), // Register Lucid database provider (ORM).
    () => import("@adonisjs/auth/auth_provider"), // Register the Authentication provider.
  ],

  /*
  |--------------------------------------------------------------------------
  | Preloads
  |--------------------------------------------------------------------------
  |
  | List of modules to import before starting the application.
  |
  */
  preloads: [
    () => import("#start/routes"), // Import the routes definition file.
    () => import("#start/kernel"), // Import the HTTP kernel (middleware pipeline).
  ],

  /*
  |--------------------------------------------------------------------------
  | Tests
  |--------------------------------------------------------------------------
  |
  | List of test suites to organize tests by their type. Feel free to remove
  | and add additional suites.
  |
  */
  tests: {
    suites: [
      {
        files: ["tests/unit/**/*.spec(.ts|.js)"], // Glob pattern to find unit tests.
        name: "unit", // Name of the test suite.
        timeout: 2000, // Timeout for each test in milliseconds.
      },
      {
        files: ["tests/functional/**/*.spec(.ts|.js)"], // Glob pattern to find functional tests.
        name: "functional", // Name of the test suite.
        timeout: 30000, // Timeout for each test in milliseconds (higher for functional tests).
      },
    ],
    forceExit: false, // Do not force exit the process after tests complete (useful for debugging).
  },
});
