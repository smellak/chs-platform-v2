import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { extractTokenFromHeaders, verifyAccessToken } from "@aleph/auth";
import { getDb, schema } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractTokenFromHeaders(request.headers);

    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const forwardedHost = request.headers.get("x-forwarded-host");
    if (!forwardedHost) {
      return NextResponse.json({ error: "X-Forwarded-Host requerido" }, { status: 400 });
    }

    const db = getDb();

    // Find user
    const usersFound = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, payload.userId))
      .limit(1);

    const user = usersFound[0];
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Usuario no encontrado o inactivo" }, { status: 401 });
    }

    // Find app instance by external domain
    const instances = await db
      .select({
        instanceId: schema.appInstances.id,
        appId: schema.appInstances.appId,
        appName: schema.apps.name,
        appSlug: schema.apps.slug,
      })
      .from(schema.appInstances)
      .innerJoin(schema.apps, eq(schema.appInstances.appId, schema.apps.id))
      .where(eq(schema.appInstances.externalDomain, forwardedHost))
      .limit(1);

    const instance = instances[0];
    if (!instance) {
      return NextResponse.json(
        { error: "Aplicación no registrada para este dominio" },
        { status: 403 },
      );
    }

    // Super admin has access to everything
    if (user.isSuperAdmin) {
      return buildAccessResponse(user, instance, "full");
    }

    // Check user's department roles against app access policies
    const userDeptRoles = await db
      .select({
        departmentId: schema.userDepartmentRoles.departmentId,
        roleId: schema.userDepartmentRoles.roleId,
      })
      .from(schema.userDepartmentRoles)
      .where(eq(schema.userDepartmentRoles.userId, user.id));

    // Find matching access policies
    for (const udr of userDeptRoles) {
      const policies = await db
        .select()
        .from(schema.appAccessPolicies)
        .where(
          and(
            eq(schema.appAccessPolicies.appId, instance.appId),
            eq(schema.appAccessPolicies.departmentId, udr.departmentId),
          ),
        );

      for (const policy of policies) {
        // Policy with no roleId means it applies to all roles in the department
        if (!policy.roleId || policy.roleId === udr.roleId) {
          // Get department info for headers
          const depts = await db
            .select()
            .from(schema.departments)
            .where(eq(schema.departments.id, udr.departmentId))
            .limit(1);

          const dept = depts[0];
          const roles = await db
            .select()
            .from(schema.roles)
            .where(eq(schema.roles.id, udr.roleId))
            .limit(1);

          const role = roles[0];

          return buildAccessResponse(
            user,
            instance,
            policy.accessLevel,
            dept?.name,
            role?.name,
          );
        }
      }
    }

    return NextResponse.json({ error: "Sin acceso a esta aplicación" }, { status: 403 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface AppInfo {
  appId: string;
  appName: string;
  appSlug: string;
}

interface UserInfo {
  id: string;
  username: string;
  orgId: string;
}

function buildAccessResponse(
  user: UserInfo,
  app: AppInfo,
  accessLevel: string,
  departmentName?: string,
  roleName?: string,
): NextResponse {
  const response = NextResponse.json({ ok: true });

  response.headers.set("X-Aleph-User-Id", user.id);
  response.headers.set("X-Aleph-User-Name", user.username);
  response.headers.set("X-Aleph-Org", user.orgId);
  response.headers.set("X-Aleph-Access-Level", accessLevel);

  if (departmentName) {
    response.headers.set("X-Aleph-Dept", departmentName);
  }
  if (roleName) {
    response.headers.set("X-Aleph-Role", roleName);
  }

  return response;
}
