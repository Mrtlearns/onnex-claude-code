import { Pool } from "pg"

// Shared pg Pool singleton — used for direct imports (migrations in index.ts)
// Route handlers use (fastify as any).pool (the fastify-decorated pool)
export const pool = new Pool({ connectionString: process.env.DATABASE_URL })
