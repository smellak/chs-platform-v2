import { eq, gt, desc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { SessionsClient } from "./sessions-client";

export default async function SessionsPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const sessions = await db
    .select({
      id: schema.refreshTokens.id,
      userId: schema.refreshTokens.userId,
      expiresAt: schema.refreshTokens.expiresAt,
      createdAt: schema.refreshTokens.createdAt,
      lastAccessedAt: schema.refreshTokens.lastAccessedAt,
      userAgent: schema.refreshTokens.userAgent,
      ipAddress: schema.refreshTokens.ipAddress,
      userName: sql<string>`concat(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
      userEmail: schema.users.email,
      userUsername: schema.users.username,
    })
    .from(schema.refreshTokens)
    .innerJoin(schema.users, eq(schema.refreshTokens.userId, schema.users.id))
    .where(gt(schema.refreshTokens.expiresAt, new Date()))
    .orderBy(desc(schema.refreshTokens.lastAccessedAt));

  const sessionsData = sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    userName: s.userName,
    userEmail: s.userEmail,
    userUsername: s.userUsername,
    expiresAt: s.expiresAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    lastAccessedAt: s.lastAccessedAt?.toISOString() ?? null,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
  }));

  return <SessionsClient sessions={sessionsData} currentUserId={user.id} />;
}
