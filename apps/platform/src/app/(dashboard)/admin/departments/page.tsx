import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { DepartmentsClient } from "./departments-client";

export default async function DepartmentsPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const departments = await db.select().from(schema.departments).orderBy(schema.departments.name);

  const userCounts = await db
    .select({
      departmentId: schema.userDepartmentRoles.departmentId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.userDepartmentRoles)
    .groupBy(schema.userDepartmentRoles.departmentId);

  const appCounts = await db
    .select({
      departmentId: schema.appAccessPolicies.departmentId,
      count: sql<number>`count(distinct ${schema.appAccessPolicies.appId})::int`,
    })
    .from(schema.appAccessPolicies)
    .groupBy(schema.appAccessPolicies.departmentId);

  const departmentsWithCounts = departments.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    usersCount: userCounts.find((uc) => uc.departmentId === d.id)?.count ?? 0,
    appsCount: appCounts.find((ac) => ac.departmentId === d.id)?.count ?? 0,
  }));

  return <DepartmentsClient departments={departmentsWithCounts} />;
}
