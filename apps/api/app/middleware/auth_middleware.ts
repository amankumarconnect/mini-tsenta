import type { HttpContext } from "@adonisjs/core/http";
import type { NextFn } from "@adonisjs/core/types/http";
import type { Authenticators } from "@adonisjs/auth/types";

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
// Middleware to ensure the user is authenticated.
export default class AuthMiddleware {
  /**
   * The URL to redirect to, when authentication fails
   */
  redirectTo = "/login"; // Redirect unauthenticated users to login page.

  // Handle the request to check authentication.
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]; // Optional specific guards to check.
    } = {},
  ) {
    // Authenticate using the configured or default guards.
    await ctx.auth.authenticateUsing(options.guards, {
      loginRoute: this.redirectTo,
    });
    return next(); // Proceed if authenticated.
  }
}
