import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "auth_access_tokens";

  // Migration to create the 'auth_access_tokens' table for auth tokens.
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id"); // Primary key.
      table
        .integer("tokenable_id") // ID of the user (or entity) the token belongs to.
        .notNullable()
        .unsigned()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE"); // Delete tokens if user is deleted.

      table.string("type").notNullable(); // Type of token (e.g., 'api').
      table.string("name").nullable(); // Name of the token (e.g., 'My Token').
      table.string("hash").notNullable(); // Hashed token value.
      table.text("abilities").notNullable(); // Capabilities/permissions of the token.
      table.timestamp("created_at");
      table.timestamp("updated_at");
      table.timestamp("last_used_at").nullable(); // Last time the token was used.
      table.timestamp("expires_at").nullable(); // Expiration time.
    });
  }

  // Rollback migration to drop the 'auth_access_tokens' table.
  async down() {
    this.schema.dropTable(this.tableName);
  }
}
