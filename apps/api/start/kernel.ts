/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| The HTTP kernel file is used to register the middleware with the server
| or the router.
|
*/

import router from "@adonisjs/core/services/router";
import server from "@adonisjs/core/services/server";

/**
 * The error handler is used to convert an exception
 * to an HTTP response.
 */
// Register global error handler.
server.errorHandler(() => import("#exceptions/handler"));

/**
 * The server middleware stack runs middleware on all the HTTP
 * requests, even if there is no route registered for
 * the request URL.
 */
// Global middleware that runs for every request.
server.use([
  () => import("#middleware/container_bindings_middleware"), // Bind IoC container.
  () => import("#middleware/force_json_response_middleware"), // Force JSON responses (useful for API).
  () => import("@adonisjs/cors/cors_middleware"), // Handle CORS.
]);

/**
 * The router middleware stack runs middleware on all the HTTP
 * requests with a registered route.
 */
// Middleware that runs only when a route satisfies the request.
router.use([
  () => import("@adonisjs/core/bodyparser_middleware"), // Parse request body.
  () => import("@adonisjs/auth/initialize_auth_middleware"), // Initialize auth context.
]);

/**
 * Named middleware collection must be explicitly assigned to
 * the routes or the routes group.
 */
// Define named middleware for specific routes (e.g., 'auth').
export const middleware = router.named({
  auth: () => import("#middleware/auth_middleware"),
});
