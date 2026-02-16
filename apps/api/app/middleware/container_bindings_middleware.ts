import { Logger } from "@adonisjs/core/logger";
import { HttpContext } from "@adonisjs/core/http";
import type { NextFn } from "@adonisjs/core/types/http";

/**
 * The container bindings middleware binds classes to their request
 * specific value using the container resolver.
 *
 * - We bind "HttpContext" class to the "ctx" object
 * - And bind "Logger" class to the "ctx.logger" object
 */
// Middleware to bind request-specific objects to the IoC container.
export default class ContainerBindingsMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    // Bind the current HttpContext instance to the container.
    ctx.containerResolver.bindValue(HttpContext, ctx);
    // Bind the specific logger instance for this request to the container.
    ctx.containerResolver.bindValue(Logger, ctx.logger);

    return next();
  }
}
