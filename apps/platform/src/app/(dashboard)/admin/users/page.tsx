import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const users = await db.select().from(schema.users).orderBy(schema.users.createdAt);

  const departments = await db.select().from(schema.departments);
  const roles = await db.select().from(schema.roles);

  const deptRoles = await db
    .select({
      userId: schema.userDepartmentRoles.userId,
      departmentId: schema.userDepartmentRoles.departmentId,
      departmentName: schema.departments.name,
      roleId: schema.userDepartmentRoles.roleId,
      roleName: schema.roles.name,
    })
    .from(schema.userDepartmentRoles)
    .innerJoin(schema.departments, eq(schema.userDepartmentRoles.departmentId, schema.departments.id))
    .innerJoin(schema.roles, eq(schema.userDepartmentRoles.roleId, schema.roles.id));

  const usersWithDepts = users.map((u) => ({
    ...u,
    lastLogin: u.lastLogin?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    departmentRole: deptRoles.find((dr) => dr.userId === u.id) ?? null,
  }));

  return (
    <UsersClient
      users={usersWithDepts}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      roles={roles.map((r) => ({ id: r.id, name: r.name }))}
    />
  );
}
