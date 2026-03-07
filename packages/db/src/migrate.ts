import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function runMigrations(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  const migrationsFolder = new URL("../drizzle", import.meta.url).pathname;

  await migrate(db, { migrationsFolder });
  await pool.end();
}

runMigrations().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Migration failed: ${message}\n`);
  process.exit(1);
});
