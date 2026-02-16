import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "users";

  // Migration to create the 'users' table.
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id").notNullable(); // Primary key.
      table.string("full_name").nullable(); // User's full name.
      table.string("email", 254).notNullable().unique(); // User's email (unique).
      table.string("password").notNullable(); // User's hashed password.

      table.timestamp("created_at").notNullable(); // Creation timestamp.
      table.timestamp("updated_at").nullable(); // Update timestamp.
    });
  }

  // Rollback migration to drop the 'users' table.
  async down() {
    this.schema.dropTable(this.tableName);
  }
}
