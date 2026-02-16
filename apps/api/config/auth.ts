import { defineConfig } from "@adonisjs/auth";
import { tokensGuard, tokensUserProvider } from "@adonisjs/auth/access_tokens";
import type {
  InferAuthenticators,
  InferAuthEvents,
  Authenticators,
} from "@adonisjs/auth/types";

// Define the authentication configuration.
const authConfig = defineConfig({
  default: "api", // Set the default authentication guard to 'api'.
  guards: {
    // Configure the 'api' guard using access tokens.
    api: tokensGuard({
      provider: tokensUserProvider({
        tokens: "accessTokens", // Table/storage for tokens.
        model: () => import("#models/user"), // Use the User model for authentication.
      }),
    }),
  },
});

export default authConfig;

/**
 * Inferring types from the configured auth
 * guards.
 */
declare module "@adonisjs/auth/types" {
  // Register the auth config types globally.
  export interface Authenticators extends InferAuthenticators<
    typeof authConfig
  > {}
}
declare module "@adonisjs/core/types" {
  // Register auth events types globally.
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
