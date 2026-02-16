import env from "#start/env";
import { defineConfig } from "@adonisjs/lucid";

// Define the database configuration using Lucid ORM.
const dbConfig = defineConfig({
  connection: "postgres", // Default database connection.
  connections: {
    postgres: {
      client: "pg", // Use the PostgreSQL client.
      connection: {
        host: env.get("DB_HOST"), // DB host from environment variables.
        port: env.get("DB_PORT"), // DB port.
        user: env.get("DB_USER"), // DB username.
        password: env.get("DB_PASSWORD"), // DB password.
        database: env.get("DB_DATABASE"), // DB name.
      },
      migrations: {
        naturalSort: true, // Sort migrations naturally.
        paths: ["database/migrations"], // Path to migration files.
      },
    },
  },
});

export default dbConfig;
