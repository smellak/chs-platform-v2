import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  Zap,
  LayoutGrid,
  Box,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { DashboardView } from "@/components/dashboard-view";
import type { DepartmentWithApps, AppCard } from "@/lib/types";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
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
  const uniqueAppIds = new Set(
    departmentsWithApps.flatMap((d) => d.apps.map((a) => a.id)),
  );
  const onlineApps = departmentsWithApps
    .flatMap((d) => d.apps)
    .filter((a) => a.status === "online").length;
  const totalApps = departmentsWithApps.reduce(
    (acc, d) => acc + d.apps.length,
    0,
  );

  const primaryDept = user.departments[0];

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* Hero header — CHS style with dot pattern */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #0D47A1 0%, #1565C0 40%, #1976D2 70%, #1A237E 100%)",
        }}
      >
        <div className="absolute inset-0 dot-pattern" />

        {/* Decorative radial overlays */}
        <div
          className="absolute top-[-50%] right-[-20%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-30%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, rgba(100,181,246,0.3) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-10 pb-16">
          <div className="flex flex-wrap items-center justify-between gap-6">
            {/* Greeting */}
            <div className="animate-fade-in-up">
              <div className="flex items-center gap-3 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/chs-logo.png"
                  alt="CHS"
                  className="h-8 w-auto"
                  style={{
                    filter: "brightness(0) invert(1)",
                    opacity: 0.7,
                  }}
                />
                <div className="w-px h-6 bg-white/20" />
                <span className="text-white/50 text-sm font-medium tracking-wider uppercase">
                  Portal Corporativo
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-1">
                {getGreeting()}, {user.firstName}
              </h1>
              <p className="text-white/60 text-sm">
                {primaryDept?.departmentName ?? "Sin departamento"} &middot;{" "}
                {primaryDept?.roleName ?? ""}
              </p>
            </div>

            {/* Stats — glass cards */}
            <div className="flex items-center gap-3 animate-fade-in-up stagger-2">
              <div className="glass-card rounded-md px-4 py-3 flex items-center gap-3">
                <Zap className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="text-white/50 text-[10px] uppercase tracking-wider">
                    Servicios
                  </p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {onlineApps}/{uniqueAppIds.size}
                  </p>
                </div>
              </div>
              <div className="glass-card rounded-md px-4 py-3 flex items-center gap-3">
                <LayoutGrid className="h-4 w-4 text-blue-300" />
                <div>
                  <p className="text-white/50 text-[10px] uppercase tracking-wider">
                    Departamentos
                  </p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {departmentsWithApps.length}
                  </p>
                </div>
              </div>
              <div className="glass-card rounded-md px-4 py-3 flex items-center gap-3">
                <Box className="h-4 w-4 text-blue-300" />
                <div>
                  <p className="text-white/50 text-[10px] uppercase tracking-wider">
                    Apps
                  </p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {totalApps}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard content — client component for interactivity */}
      <DashboardView departmentsWithApps={departmentsWithApps} />
    </div>
  );
}
