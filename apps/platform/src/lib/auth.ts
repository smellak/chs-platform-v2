import { cookies } from "next/headers";
import { verifyAccessToken } from "@chs-platform/auth";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { AuthUser } from "@/lib/types";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("chs_access_token")?.value;

  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const db = getDb();

  const usersFound = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, payload.userId))
    .limit(1);

  const user = usersFound[0];
  if (!user) return null;

  const deptRoles = await db
    .select({
      departmentId: schema.userDepartmentRoles.departmentId,
      departmentName: schema.departments.name,
      departmentSlug: schema.departments.slug,
      departmentIcon: schema.departments.icon,
      departmentColor: schema.departments.color,
      roleId: schema.userDepartmentRoles.roleId,
      roleName: schema.roles.name,
      roleSlug: schema.roles.slug,
      permissions: schema.roles.permissions,
    })
    .from(schema.userDepartmentRoles)
    .innerJoin(
      schema.departments,
      eq(schema.userDepartmentRoles.departmentId, schema.departments.id),
    )
    .innerJoin(
      schema.roles,
      eq(schema.userDepartmentRoles.roleId, schema.roles.id),
    )
    .where(eq(schema.userDepartmentRoles.userId, user.id));

  return {
    id: user.id,
    orgId: user.orgId,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    lastLogin: user.lastLogin?.toISOString() ?? null,
    departments: deptRoles,
  };
}
