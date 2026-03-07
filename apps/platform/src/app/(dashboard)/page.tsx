import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { DashboardView } from "@/components/dashboard-view";
import type { DepartmentWithApps, AppCard } from "@/lib/types";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();

  // Get all departments for the org
  const allDepartments = await db
    .select()
    .from(schema.departments)
    .where(eq(schema.departments.isActive, true));

  // Get user's department IDs (if not super admin)
  const userDeptIds = user.departments.map((d) => d.departmentId);

  // Filter departments based on user role
  const visibleDepartments = user.isSuperAdmin
    ? allDepartments
    : allDepartments.filter((d) => userDeptIds.includes(d.id));

  // Get all apps with their instances and access
  const departmentsWithApps: DepartmentWithApps[] = [];

  for (const dept of visibleDepartments) {
    const accessPolicies = await db
      .select({
        appId: schema.appAccessPolicies.appId,
        accessLevel: schema.appAccessPolicies.accessLevel,
      })
      .from(schema.appAccessPolicies)
      .where(eq(schema.appAccessPolicies.departmentId, dept.id));

    if (accessPolicies.length === 0) continue;

    const appCards: AppCard[] = [];

    for (const policy of accessPolicies) {
      const appsFound = await db
        .select()
        .from(schema.apps)
        .where(
          and(
            eq(schema.apps.id, policy.appId),
            eq(schema.apps.isActive, true),
          ),
        )
        .limit(1);

      const app = appsFound[0];
      if (!app) continue;

      const instances = await db
        .select()
        .from(schema.appInstances)
        .where(eq(schema.appInstances.appId, app.id))
        .limit(1);

      const instance = instances[0];

      appCards.push({
        id: app.id,
        name: app.name,
        slug: app.slug,
        description: app.description,
        icon: app.icon,
        color: app.color,
        category: app.category,
        version: app.version,
        isActive: app.isActive,
        isMaintenance: app.isMaintenance,
        status: instance?.status ?? "unknown",
        externalDomain: instance?.externalDomain ?? null,
        accessLevel: policy.accessLevel,
      });
    }

    if (appCards.length > 0) {
      departmentsWithApps.push({
        id: dept.id,
        name: dept.name,
        slug: dept.slug,
        icon: dept.icon,
        color: dept.color,
        description: dept.description,
        apps: appCards,
      });
    }
  }

  // Stats — count unique apps
  const uniqueAppIds = new Set(
    departmentsWithApps.flatMap((d) => d.apps.map((a) => a.id)),
  );
  const onlineApps = [...uniqueAppIds].filter((id) => {
    const app = departmentsWithApps
      .flatMap((d) => d.apps)
      .find((a) => a.id === id);
    return app?.status === "online";
  }).length;

  const primaryDept = user.departments[0];

  return (
    <DashboardView
      departmentsWithApps={departmentsWithApps}
      userName={user.firstName}
      userDepartment={primaryDept?.departmentName ?? "Sin departamento"}
      userRole={primaryDept?.roleName ?? ""}
      onlineCount={onlineApps}
      totalUniqueApps={uniqueAppIds.size}
    />
  );
}
