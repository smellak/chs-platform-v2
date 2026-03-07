import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET(): Promise<NextResponse> {
  let dbStatus = "disconnected";

  try {
    const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
    const result = await pool.query("SELECT 1");
    if (result.rowCount === 1) {
      dbStatus = "connected";
    }
    await pool.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    dbStatus = `disconnected: ${message}`;
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus.startsWith("connected") ? "connected" : "disconnected",
  });
}
