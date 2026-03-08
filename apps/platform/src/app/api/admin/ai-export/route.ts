import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, gte, desc, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { extractTokenFromHeaders, verifyAccessToken } from "@chs-platform/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ai-export");

async function requireSuperAdmin(request: NextRequest): Promise<string | null> {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const db = getDb();
  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, payload.userId))
    .limit(1);
  const user = users[0];
  if (!user?.isSuperAdmin) return null;
  return user.id;
}

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string): string => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return lines.join("\n");
}

export async function GET(request: NextRequest): Promise<Response> {
  const userId = await requireSuperAdmin(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") ?? "costs";
  const dateFrom = request.nextUrl.searchParams.get("dateFrom");
  const db = getDb();

  const fromDate = dateFrom ? new Date(dateFrom) : undefined;

  try {
    if (type === "costs") {
      const conditions = [];
      if (fromDate) {
        conditions.push(gte(schema.apiCostLogs.createdAt, fromDate));
      }

      const logs = await db
        .select({
          date: schema.apiCostLogs.createdAt,
          provider: schema.apiProviders.name,
          tokens: schema.apiCostLogs.tokens,
          cost: schema.apiCostLogs.cost,
          endpoint: schema.apiCostLogs.endpoint,
          userName: schema.users.firstName,
          userLastName: schema.users.lastName,
        })
        .from(schema.apiCostLogs)
        .leftJoin(schema.apiProviders, eq(schema.apiCostLogs.providerId, schema.apiProviders.id))
        .leftJoin(schema.users, eq(schema.apiCostLogs.userId, schema.users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.apiCostLogs.createdAt))
        .limit(10000);

      const csv = toCsv(
        ["Fecha", "Proveedor", "Tokens", "Coste", "Endpoint", "Usuario"],
        logs.map((l) => [
          l.date.toISOString(),
          l.provider ?? "",
          String(l.tokens),
          l.cost.toFixed(6),
          l.endpoint ?? "",
          `${l.userName ?? ""} ${l.userLastName ?? ""}`.trim(),
        ]),
      );

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="costs-export.csv"`,
        },
      });
    }

    if (type === "conversations") {
      const conversations = await db
        .select({
          id: schema.agentConversations.id,
          title: schema.agentConversations.title,
          userName: schema.users.firstName,
          userLastName: schema.users.lastName,
          createdAt: schema.agentConversations.createdAt,
        })
        .from(schema.agentConversations)
        .leftJoin(schema.users, eq(schema.agentConversations.userId, schema.users.id))
        .orderBy(desc(schema.agentConversations.createdAt))
        .limit(10000);

      const csv = toCsv(
        ["ID", "Título", "Usuario", "Fecha"],
        conversations.map((c) => [
          c.id,
          c.title ?? "",
          `${c.userName ?? ""} ${c.userLastName ?? ""}`.trim(),
          c.createdAt.toISOString(),
        ]),
      );

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="conversations-export.csv"`,
        },
      });
    }

    if (type === "alerts") {
      const alerts = await db
        .select()
        .from(schema.aiAlerts)
        .orderBy(desc(schema.aiAlerts.createdAt))
        .limit(10000);

      const csv = toCsv(
        ["ID", "Severidad", "Título", "Mensaje", "Resuelta", "Fecha"],
        alerts.map((a) => [
          a.id,
          a.severity,
          a.title,
          a.message,
          a.isResolved ? "Sí" : "No",
          a.createdAt.toISOString(),
        ]),
      );

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="alerts-export.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Tipo no válido" }, { status: 400 });
  } catch (err) {
    logger.error("Export failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = await requireSuperAdmin(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get("action");

  if (action === "resolve-alert") {
    const alertId = request.nextUrl.searchParams.get("alertId");
    if (!alertId) {
      return NextResponse.json({ error: "alertId requerido" }, { status: 400 });
    }

    const db = getDb();
    await db
      .update(schema.aiAlerts)
      .set({
        isResolved: true,
        resolvedBy: userId,
        resolvedAt: new Date(),
      })
      .where(eq(schema.aiAlerts.id, alertId));

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
