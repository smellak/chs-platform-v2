import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  Server,
  CheckCircle2,
  XCircle,
  Wrench,
  Activity,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { formatRelativeTime } from "@/lib/utils";
import { MonitorChart } from "./monitor-chart";

function getStatusInfo(status: string, isMaintenance: boolean) {
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

export default async function MonitorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();

  const apps = await db.select().from(schema.apps);
  const instances = await db.select().from(schema.appInstances);

  const appsWithStatus = apps.map((app) => {
    const instance = instances.find((i) => i.appId === app.id);
    return {
      id: app.id,
      name: app.name,
      slug: app.slug,
      icon: app.icon,
      color: app.color,
      isMaintenance: app.isMaintenance,
      status: instance?.status ?? "unknown",
      lastHealthCheck: instance?.lastHealthCheck,
    };
  });

  const onlineCount = appsWithStatus.filter((a) => a.status === "online").length;
  const offlineCount = appsWithStatus.filter((a) => a.status === "offline").length;
  const maintenanceCount = appsWithStatus.filter((a) => a.isMaintenance).length;

  // Recent activity
  const recentLogs = await db
    .select({
      id: schema.activityLogs.id,
      action: schema.activityLogs.action,
      entityType: schema.activityLogs.entityType,
      createdAt: schema.activityLogs.createdAt,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
    })
    .from(schema.activityLogs)
    .leftJoin(schema.users, eq(schema.activityLogs.userId, schema.users.id))
    .orderBy(desc(schema.activityLogs.createdAt))
    .limit(10);

  // Demo chart data for API costs
  const chartData = [
    { day: "Lun", cost: 2.4 },
    { day: "Mar", cost: 3.1 },
    { day: "Mié", cost: 1.8 },
    { day: "Jue", cost: 4.2 },
    { day: "Vie", cost: 3.7 },
    { day: "Sáb", cost: 1.2 },
    { day: "Dom", cost: 0.8 },
  ];

  return (
    <div>
      {/* Hero */}
      <div className="hero-gradient text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold">Monitor de Servicios</h1>
          <p className="text-blue-200/70 mt-1">
            Estado en tiempo real de las aplicaciones
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-blue-200" />
                <div>
                  <p className="text-2xl font-bold">{apps.length}</p>
                  <p className="text-xs text-blue-200/70">Total Apps</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <div>
                  <p className="text-2xl font-bold">{onlineCount}</p>
                  <p className="text-xs text-blue-200/70">En línea</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-300" />
                <div>
                  <p className="text-2xl font-bold">{offlineCount}</p>
                  <p className="text-xs text-blue-200/70">Fuera de línea</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Wrench className="h-5 w-5 text-amber-300" />
                <div>
                  <p className="text-2xl font-bold">{maintenanceCount}</p>
                  <p className="text-xs text-blue-200/70">Mantenimiento</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 -mt-4 space-y-6">
        {/* Services table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Estado de Servicios</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">
                    Aplicación
                  </th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">
                    Último check
                  </th>
                </tr>
              </thead>
              <tbody>
                {appsWithStatus.map((app) => {
                  const info = getStatusInfo(app.status, app.isMaintenance);
                  return (
                    <tr key={app.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <span className="font-medium text-sm">{app.name}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${info.classes}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full status-dot-pulse"
                            style={{ backgroundColor: info.dotColor }}
                          />
                          {info.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell text-sm text-muted-foreground">
                        {app.lastHealthCheck
                          ? formatRelativeTime(app.lastHealthCheck)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* API costs chart */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Costes API</h2>
              <span className="text-xs text-muted-foreground">Últimos 7 días</span>
            </div>
            <MonitorChart data={chartData} />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Datos de demostración
            </p>
          </div>

          {/* Recent activity */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Actividad reciente</h2>
            </div>
            <div className="space-y-3">
              {recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin actividad reciente
                </p>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground">
                        <span className="font-medium">
                          {log.firstName} {log.lastName}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {log.action}
                        </span>
                        {log.entityType && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({log.entityType})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
