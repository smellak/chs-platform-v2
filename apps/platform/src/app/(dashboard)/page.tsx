import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  Server,
  Building2,
  AppWindow,
  Search,
  ExternalLink,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { DynamicIcon } from "@/components/dynamic-icon";
import type { DepartmentWithApps, AppCard } from "@/lib/types";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function getStatusBadge(status: string, isMaintenance: boolean) {
  if (isMaintenance) {
    return {
      label: "Mantenimiento",
      dotColor: "#3b82f6",
      classes: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
  }

  switch (status) {
    case "online":
      return {
        label: "Operativo",
        dotColor: "#10b981",
        classes: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      };
    case "offline":
      return {
        label: "Fuera de línea",
        dotColor: "#ef4444",
        classes: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      };
    case "degraded":
      return {
        label: "Degradado",
        dotColor: "#f59e0b",
        classes: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      };
    default:
      return {
        label: "Sin datos",
        dotColor: "#9E9E9E",
        classes: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
      };
  }
}

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
    // Get apps accessible to this department
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

      // Get instance info
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

  // Stats
  const totalApps = departmentsWithApps.reduce(
    (acc, d) => acc + d.apps.length,
    0,
  );
  const uniqueAppIds = new Set(
    departmentsWithApps.flatMap((d) => d.apps.map((a) => a.id)),
  );
  const onlineApps = departmentsWithApps
    .flatMap((d) => d.apps)
    .filter((a) => a.status === "online").length;

  return (
    <div>
      {/* Hero header */}
      <div className="hero-gradient text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">
                {getGreeting()}, {user.firstName}
              </h1>
              <p className="text-blue-200/70 mt-1">
                Panel de control de aplicaciones
              </p>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-blue-200" />
                <div>
                  <p className="text-2xl font-bold">{onlineApps}</p>
                  <p className="text-xs text-blue-200/70">Servicios activos</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-blue-200" />
                <div>
                  <p className="text-2xl font-bold">
                    {departmentsWithApps.length}
                  </p>
                  <p className="text-xs text-blue-200/70">Departamentos</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AppWindow className="h-5 w-5 text-blue-200" />
                <div>
                  <p className="text-2xl font-bold">{uniqueAppIds.size}</p>
                  <p className="text-xs text-blue-200/70">Aplicaciones</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-blue-200" />
                <div>
                  <p className="text-2xl font-bold">{totalApps}</p>
                  <p className="text-xs text-blue-200/70">Accesos totales</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="max-w-7xl mx-auto px-4 py-8 -mt-4">
        {departmentsWithApps.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <AppWindow className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">
              No tienes aplicaciones asignadas
            </p>
            <p className="text-sm mt-1">
              Contacta al administrador para obtener acceso
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {departmentsWithApps.map((dept) => (
              <section key={dept.id}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: dept.color
                        ? `linear-gradient(135deg, ${dept.color}40, ${dept.color}20)`
                        : undefined,
                    }}
                  >
                    {dept.icon && (
                      <DynamicIcon
                        name={dept.icon}
                        className="h-4 w-4"
                        style={{ color: dept.color ?? undefined }}
                      />
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {dept.name}
                  </h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {dept.apps.length} app{dept.apps.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dept.apps.map((app) => {
                    const badge = getStatusBadge(app.status, app.isMaintenance);

                    return (
                      <div
                        key={`${dept.id}-${app.id}`}
                        className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{
                                background: app.color
                                  ? `linear-gradient(135deg, ${app.color}, ${app.color}CC)`
                                  : "linear-gradient(135deg, #6B7280, #6B7280CC)",
                              }}
                            >
                              {app.icon && (
                                <DynamicIcon
                                  name={app.icon}
                                  className="h-5 w-5 text-white"
                                />
                              )}
                            </div>
                            <div>
                              <h3 className="font-medium text-card-foreground">
                                {app.name}
                              </h3>
                              {app.category && (
                                <p className="text-xs text-muted-foreground">
                                  {app.category}
                                </p>
                              )}
                            </div>
                          </div>

                          {app.externalDomain && (
                            <a
                              href={`https://${app.externalDomain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-accent opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </a>
                          )}
                        </div>

                        {app.description && (
                          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                            {app.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.classes}`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full status-dot-pulse"
                              style={{ backgroundColor: badge.dotColor }}
                            />
                            {badge.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            v{app.version}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
