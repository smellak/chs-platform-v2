import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@chs-platform/db/schema";

function createPool(): Pool {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return new Pool({ connectionString });
}

let poolInstance: Pool | undefined;

function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = createPool();
  }
  return poolInstance;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export { schema };
