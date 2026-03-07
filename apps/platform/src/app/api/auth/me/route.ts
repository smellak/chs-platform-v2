import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get("x-aleph-user-id");

    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const db = getDb();

    const usersFound = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const user = usersFound[0];
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

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

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      lastLogin: user.lastLogin,
      departments: deptRoles,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
