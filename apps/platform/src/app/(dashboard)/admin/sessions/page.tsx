import { and, eq, gt, desc, sql, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { SessionsClient } from "./sessions-client";

const PAGE_SIZE = 20;

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const db = getDb();

  const activeFilter = and(
    gt(schema.refreshTokens.expiresAt, new Date()),
    eq(schema.users.isActive, true),
  );

  // Get total count
  const countResult = await db
    .select({ total: count() })
    .from(schema.refreshTokens)
    .innerJoin(schema.users, eq(schema.refreshTokens.userId, schema.users.id))
    .where(activeFilter);
  const total = countResult[0]?.total ?? 0;

  // Get paginated sessions
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
    .where(activeFilter)
    .orderBy(desc(schema.refreshTokens.lastAccessedAt))
    .limit(PAGE_SIZE)
    .offset(offset);

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <SessionsClient
      sessions={sessionsData}
      currentUserId={user.id}
      currentPage={currentPage}
      totalPages={totalPages}
      totalSessions={total}
    />
  );
}
