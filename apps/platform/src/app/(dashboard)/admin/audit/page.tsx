import { eq, desc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { AuditClient } from "./audit-client";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const logs = await db
    .select({
      id: schema.activityLogs.id,
      action: schema.activityLogs.action,
      entityType: schema.activityLogs.entityType,
      entityId: schema.activityLogs.entityId,
      details: schema.activityLogs.details,
      ipAddress: schema.activityLogs.ipAddress,
      createdAt: schema.activityLogs.createdAt,
      userId: schema.activityLogs.userId,
      userName: sql<string>`concat(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
      userUsername: schema.users.username,
    })
    .from(schema.activityLogs)
    .leftJoin(schema.users, eq(schema.activityLogs.userId, schema.users.id))
    .orderBy(desc(schema.activityLogs.createdAt))
    .limit(200);

  const uniqueActions = [...new Set(logs.map((l) => l.action))];
  const uniqueUsers = [
    ...new Map(
      logs
        .filter((l) => l.userId)
        .map((l) => [l.userId, { id: l.userId!, name: l.userName }]),
    ).values(),
  ];

  const logsData = logs.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    details: l.details as Record<string, unknown> | null,
  }));

  return (
    <AuditClient
      logs={logsData}
      actions={uniqueActions}
      users={uniqueUsers}
    />
  );
}
