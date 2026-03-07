import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { extractTokenFromHeaders, verifyAccessToken } from "@aleph/auth";
import { getDb, schema } from "@/lib/db";

function errorResponse(status: number, error: string, errorCode: string): NextResponse {
  const res = NextResponse.json({ error }, { status });
  res.headers.set("X-Aleph-Error", errorCode);
  return res;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Extract token
    const token = extractTokenFromHeaders(request.headers);
    if (!token) {
      return errorResponse(401, "No autenticado", "no-token");
    }

    // 2. Verify JWT
    const payload = verifyAccessToken(token);
    if (!payload) {
      return errorResponse(401, "Token inválido o expirado", "invalid-token");
    }

    const db = getDb();

    // 3. Find user with department roles
    const usersFound = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, payload.userId))
      .limit(1);

    const user = usersFound[0];
    if (!user) {
      return errorResponse(401, "Usuario no encontrado", "user-inactive");
    }
    if (!user.isActive) {
      return errorResponse(401, "Usuario desactivado", "user-inactive");
    }

    // 4. Identify the app
    const forwardedHost = request.headers.get("x-forwarded-host");
    const queryApp = request.nextUrl.searchParams.get("app");
    const targetHost = forwardedHost || undefined;
    const targetSlug = queryApp || undefined;

    if (!targetHost && !targetSlug) {
      return errorResponse(400, "X-Forwarded-Host o ?app= requerido", "app-not-found");
    }

    // Find app instance by external domain or by slug
    let appData: {
      instanceId: string;
      appId: string;
      appName: string;
      appSlug: string;
      isActive: boolean;
      isMaintenance: boolean;
    } | undefined;

    if (targetHost) {
      const instances = await db
        .select({
          instanceId: schema.appInstances.id,
          appId: schema.appInstances.appId,
          appName: schema.apps.name,
          appSlug: schema.apps.slug,
          isActive: schema.apps.isActive,
          isMaintenance: schema.apps.isMaintenance,
        })
        .from(schema.appInstances)
        .innerJoin(schema.apps, eq(schema.appInstances.appId, schema.apps.id))
        .where(eq(schema.appInstances.externalDomain, targetHost))
        .limit(1);
      appData = instances[0];
    } else if (targetSlug) {
      const appsFound = await db
        .select({
          instanceId: schema.appInstances.id,
          appId: schema.appInstances.appId,
          appName: schema.apps.name,
          appSlug: schema.apps.slug,
          isActive: schema.apps.isActive,
          isMaintenance: schema.apps.isMaintenance,
        })
        .from(schema.apps)
        .innerJoin(schema.appInstances, eq(schema.appInstances.appId, schema.apps.id))
        .where(eq(schema.apps.slug, targetSlug))
        .limit(1);
      appData = appsFound[0];
    }

    if (!appData) {
      return errorResponse(403, "Aplicación no reconocida", "app-not-found");
    }

    // Check app state
    if (!appData.isActive) {
      return errorResponse(503, "Aplicación no disponible", "app-maintenance");
    }
    if (appData.isMaintenance) {
      return errorResponse(503, "Aplicación en mantenimiento", "app-maintenance");
    }

    // 5. Get organization info
    const orgs = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, user.orgId))
      .limit(1);
    const org = orgs[0];

    // 6. Super admin has access to everything
    if (user.isSuperAdmin) {
      // Get first department for super admin
      const adminDeptRoles = await db
        .select({
          deptId: schema.departments.id,
          deptName: schema.departments.name,
        })
        .from(schema.userDepartmentRoles)
        .innerJoin(schema.departments, eq(schema.userDepartmentRoles.departmentId, schema.departments.id))
        .where(eq(schema.userDepartmentRoles.userId, user.id))
        .limit(1);

      const adminDept = adminDeptRoles[0];

      // Log activity
      await db.insert(schema.activityLogs).values({
        orgId: user.orgId,
        userId: user.id,
        action: "auth.verify-access",
        entityType: "app",
        entityId: appData.appId,
        details: {
          app: appData.appSlug,
          host: targetHost ?? targetSlug,
          result: "granted",
          role: "super-admin",
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
      });

      return buildAccessResponse({
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        orgId: user.orgId,
        orgName: org?.name ?? "",
        deptName: adminDept?.deptName ?? "IT",
        deptId: adminDept?.deptId ?? "",
        role: "super-admin",
        accessLevel: "full",
        permissions: {
          "apps.read": true,
          "apps.manage": true,
          "users.read": true,
          "users.manage": true,
          "departments.manage": true,
          "roles.manage": true,
          "audit.read": true,
          "settings.manage": true,
        },
      });
    }

    // 7. Check access via department roles
    const userDeptRoles = await db
      .select({
        departmentId: schema.userDepartmentRoles.departmentId,
        roleId: schema.userDepartmentRoles.roleId,
        deptName: schema.departments.name,
        deptId: schema.departments.id,
        roleSlug: schema.roles.slug,
        permissions: schema.roles.permissions,
      })
      .from(schema.userDepartmentRoles)
      .innerJoin(schema.departments, eq(schema.userDepartmentRoles.departmentId, schema.departments.id))
      .innerJoin(schema.roles, eq(schema.userDepartmentRoles.roleId, schema.roles.id))
      .where(eq(schema.userDepartmentRoles.userId, user.id));

    // Find the best access level across all departments
    let bestAccess: {
      deptName: string;
      deptId: string;
      roleSlug: string;
      accessLevel: string;
      permissions: Record<string, boolean>;
    } | null = null;

    for (const udr of userDeptRoles) {
      const policies = await db
        .select()
        .from(schema.appAccessPolicies)
        .where(
          and(
            eq(schema.appAccessPolicies.appId, appData.appId),
            eq(schema.appAccessPolicies.departmentId, udr.departmentId),
          ),
        );

      for (const policy of policies) {
        if (!policy.roleId || policy.roleId === udr.roleId) {
          // Found a matching policy — check if it's better than what we have
          if (!bestAccess || policy.accessLevel === "full") {
            bestAccess = {
              deptName: udr.deptName,
              deptId: udr.deptId,
              roleSlug: udr.roleSlug,
              accessLevel: policy.accessLevel,
              permissions: (udr.permissions ?? {}) as Record<string, boolean>,
            };
            // If we already have full access, no need to check more
            if (policy.accessLevel === "full") break;
          }
        }
      }
      if (bestAccess?.accessLevel === "full") break;
    }

    if (!bestAccess) {
      // Log denied access
      await db.insert(schema.activityLogs).values({
        orgId: user.orgId,
        userId: user.id,
        action: "auth.verify-access",
        entityType: "app",
        entityId: appData.appId,
        details: {
          app: appData.appSlug,
          host: targetHost ?? targetSlug,
          result: "denied",
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
      });
      return errorResponse(403, "Sin acceso a esta aplicación", "no-access");
    }

    // Resolve role
    const resolvedRole = bestAccess.roleSlug === "dept-admin" ? "dept-admin" : bestAccess.roleSlug;

    // Log successful access
    await db.insert(schema.activityLogs).values({
      orgId: user.orgId,
      userId: user.id,
      action: "auth.verify-access",
      entityType: "app",
      entityId: appData.appId,
      details: {
        app: appData.appSlug,
        host: targetHost ?? targetSlug,
        result: "granted",
        role: resolvedRole,
        accessLevel: bestAccess.accessLevel,
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
    });

    return buildAccessResponse({
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      orgId: user.orgId,
      orgName: org?.name ?? "",
      deptName: bestAccess.deptName,
      deptId: bestAccess.deptId,
      role: resolvedRole,
      accessLevel: bestAccess.accessLevel,
      permissions: bestAccess.permissions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface AccessResponseData {
  userId: string;
  userName: string;
  userEmail: string;
  orgId: string;
  orgName: string;
  deptName: string;
  deptId: string;
  role: string;
  accessLevel: string;
  permissions: Record<string, boolean>;
}

function buildAccessResponse(data: AccessResponseData): NextResponse {
  const response = NextResponse.json({ ok: true });

  // Aleph headers (canonical)
  response.headers.set("X-Aleph-User-Id", data.userId);
  response.headers.set("X-Aleph-User-Name", data.userName);
  response.headers.set("X-Aleph-User-Email", data.userEmail);
  response.headers.set("X-Aleph-Org-Id", data.orgId);
  response.headers.set("X-Aleph-Org-Name", data.orgName);
  response.headers.set("X-Aleph-Dept", data.deptName);
  response.headers.set("X-Aleph-Dept-Id", data.deptId);
  response.headers.set("X-Aleph-Role", data.role);
  response.headers.set("X-Aleph-Access-Level", data.accessLevel);
  response.headers.set("X-Aleph-Permissions", JSON.stringify(data.permissions));

  // CHS-compatible headers (backward compat for Elias SSO)
  response.headers.set("X-CHS-User-Id", data.userId);
  response.headers.set("X-CHS-User-Name", data.userName);
  response.headers.set("X-CHS-User-Dept", data.deptName);
  response.headers.set("X-CHS-User-Role", data.role);
  response.headers.set("X-CHS-Access-Level", data.accessLevel);

  return response;
}
