import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import env from "#start/env";

// Database connection string from environment.
const connectionString = env.get("DATABASE_URL");

// Initialize PostgreSQL connection pool.
const pool = new Pool({ connectionString });
// Initialize Prisma adapter for PostgreSQL.
const adapter = new PrismaPg(pool);

// Initialize Prisma Client with the custom adapter.
const prisma = new PrismaClient({ adapter });

export default prisma;
