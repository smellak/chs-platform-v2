import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { RolesClient } from "./roles-client";

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const roles = await db.select().from(schema.roles).orderBy(schema.roles.name);

  const userCounts = await db
    .select({
      roleId: schema.userDepartmentRoles.roleId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.userDepartmentRoles)
    .innerJoin(schema.users, eq(schema.userDepartmentRoles.userId, schema.users.id))
    .where(eq(schema.users.isActive, true))
    .groupBy(schema.userDepartmentRoles.roleId);

  const rolesData = roles.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    usersCount: userCounts.find((uc) => uc.roleId === r.id)?.count ?? 0,
  }));

  return <RolesClient roles={rolesData} />;
}
