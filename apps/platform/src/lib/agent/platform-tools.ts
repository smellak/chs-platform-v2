import { eq, and, like, desc, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { AgentContext, PlatformTool } from "./types";

export function getPlatformTools(ctx: AgentContext): PlatformTool[] {
  const { user } = ctx;
  const tools: PlatformTool[] = [];

  tools.push({
    name: "buscar_usuarios",
    description: "Buscar usuarios en la organización por nombre, email o departamento",
    parameters: {
      query: { type: "string", description: "Término de búsqueda", required: true },
      department: { type: "string", description: "Filtrar por departamento" },
    },
    execute: async (params) => {
      const db = getDb();
      const q = String(params["query"] ?? "");
      const searchPattern = `%${q}%`;
      const users = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          email: schema.users.email,
          isActive: schema.users.isActive,
        })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.orgId, user.orgId),
            sql`(${schema.users.firstName} ILIKE ${searchPattern} OR ${schema.users.lastName} ILIKE ${searchPattern} OR ${schema.users.email} ILIKE ${searchPattern} OR ${schema.users.username} ILIKE ${searchPattern})`,
          ),
        )
        .limit(20);

      return { users, total: users.length };
    },
  });

  tools.push({
    name: "ver_servicios",
    description: "Ver el estado actual de todos los servicios/aplicaciones",
    parameters: {},
    execute: async () => {
      const db = getDb();
      const apps = await db
        .select({
          name: schema.apps.name,
          slug: schema.apps.slug,
          isActive: schema.apps.isActive,
          isMaintenance: schema.apps.isMaintenance,
        })
        .from(schema.apps)
        .where(eq(schema.apps.orgId, user.orgId));

      const instances = await db
        .select({
          appId: schema.appInstances.appId,
          status: schema.appInstances.status,
          lastHealthCheck: schema.appInstances.lastHealthCheck,
        })
        .from(schema.appInstances);

      const statusMap = new Map(instances.map((i) => [i.appId, i]));

      const services = apps.map((app) => {
        const instance = statusMap.get(
          // find the matching app id
          apps.find((a) => a.slug === app.slug)
            ? instances.find((i) => i.appId)?.appId ?? ""
            : "",
        );
        return {
          name: app.name,
          slug: app.slug,
          isActive: app.isActive,
          isMaintenance: app.isMaintenance,
          status: instance?.status ?? "unknown",
          lastCheck: instance?.lastHealthCheck?.toISOString() ?? null,
        };
      });

      // Simplified: get all instances for this org's apps
      const allApps = await db
        .select({
          id: schema.apps.id,
          name: schema.apps.name,
          isActive: schema.apps.isActive,
          isMaintenance: schema.apps.isMaintenance,
        })
        .from(schema.apps)
        .where(eq(schema.apps.orgId, user.orgId));

      const appInstances = await db.select().from(schema.appInstances);
      const instMap = new Map(appInstances.map((i) => [i.appId, i]));

      return {
        services: allApps.map((a) => ({
          name: a.name,
          active: a.isActive,
          maintenance: a.isMaintenance,
          status: instMap.get(a.id)?.status ?? "unknown",
        })),
        total: allApps.length,
        online: allApps.filter((a) => instMap.get(a.id)?.status === "online").length,
        offline: allApps.filter((a) => instMap.get(a.id)?.status !== "online" && a.isActive).length,
      };
    },
  });

  tools.push({
    name: "ver_actividad_reciente",
    description: "Ver las últimas acciones realizadas en la plataforma",
    parameters: {
      limit: { type: "number", description: "Número de acciones a mostrar (máx 50)" },
      action: { type: "string", description: "Filtrar por tipo de acción (ej: auth.login, agent.chat)" },
    },
    execute: async (params) => {
      const db = getDb();
      const limit = Math.min(Number(params["limit"] ?? 20), 50);
      const actionFilter = params["action"] ? String(params["action"]) : undefined;

      const conditions = [eq(schema.activityLogs.orgId, user.orgId)];
      if (actionFilter) {
        conditions.push(eq(schema.activityLogs.action, actionFilter));
      }

      const logs = await db
        .select({
          action: schema.activityLogs.action,
          details: schema.activityLogs.details,
          createdAt: schema.activityLogs.createdAt,
          userName: schema.users.firstName,
          userLastName: schema.users.lastName,
        })
        .from(schema.activityLogs)
        .leftJoin(schema.users, eq(schema.activityLogs.userId, schema.users.id))
        .where(and(...conditions))
        .orderBy(desc(schema.activityLogs.createdAt))
        .limit(limit);

      return {
        activities: logs.map((l) => ({
          action: l.action,
          user: l.userName ? `${l.userName} ${l.userLastName ?? ""}`.trim() : "Sistema",
          details: l.details,
          date: l.createdAt.toISOString(),
        })),
      };
    },
  });

  tools.push({
    name: "ver_accesos_app",
    description: "Ver qué departamentos y roles tienen acceso a una aplicación",
    parameters: {
      appName: { type: "string", description: "Nombre de la aplicación", required: true },
    },
    execute: async (params) => {
      const db = getDb();
      const appName = String(params["appName"] ?? "");

      const appsFound = await db
        .select()
        .from(schema.apps)
        .where(
          and(
            eq(schema.apps.orgId, user.orgId),
            sql`${schema.apps.name} ILIKE ${`%${appName}%`}`,
          ),
        )
        .limit(1);

      const app = appsFound[0];
      if (!app) return { error: `No se encontró la aplicación "${appName}"` };

      const policies = await db
        .select({
          departmentName: schema.departments.name,
          roleName: schema.roles.name,
          accessLevel: schema.appAccessPolicies.accessLevel,
        })
        .from(schema.appAccessPolicies)
        .innerJoin(schema.departments, eq(schema.appAccessPolicies.departmentId, schema.departments.id))
        .leftJoin(schema.roles, eq(schema.appAccessPolicies.roleId, schema.roles.id))
        .where(eq(schema.appAccessPolicies.appId, app.id));

      return {
        app: app.name,
        policies: policies.map((p) => ({
          department: p.departmentName,
          role: p.roleName ?? "Todos los roles",
          accessLevel: p.accessLevel,
        })),
      };
    },
  });

  tools.push({
    name: "ver_costes_api",
    description: "Ver costes de API por proveedor en un período",
    parameters: {
      period: { type: "string", description: "Período: today, week, month (por defecto: week)", enum: ["today", "week", "month"] },
    },
    execute: async (params) => {
      const db = getDb();
      const period = String(params["period"] ?? "week");

      const now = new Date();
      let since: Date;
      if (period === "today") {
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === "month") {
        since = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const costs = await db
        .select({
          providerName: schema.apiProviders.name,
          totalTokens: sql<number>`COALESCE(SUM(${schema.apiCostLogs.tokens}), 0)`,
          totalCost: sql<number>`COALESCE(SUM(${schema.apiCostLogs.cost}), 0)`,
          count: sql<number>`COUNT(${schema.apiCostLogs.id})`,
        })
        .from(schema.apiCostLogs)
        .innerJoin(schema.apiProviders, eq(schema.apiCostLogs.providerId, schema.apiProviders.id))
        .where(
          and(
            eq(schema.apiCostLogs.orgId, user.orgId),
            gte(schema.apiCostLogs.createdAt, since),
          ),
        )
        .groupBy(schema.apiProviders.name);

      return {
        period,
        since: since.toISOString(),
        costs: costs.map((c) => ({
          provider: c.providerName,
          tokens: Number(c.totalTokens),
          cost: Number(c.totalCost),
          requests: Number(c.count),
        })),
      };
    },
  });

  tools.push({
    name: "ver_notificaciones",
    description: "Ver notificaciones del usuario actual",
    parameters: {
      unreadOnly: { type: "boolean", description: "Solo mostrar no leídas" },
    },
    execute: async (params) => {
      const db = getDb();
      const unreadOnly = params["unreadOnly"] === true || params["unreadOnly"] === "true";

      const conditions = [
        eq(schema.notifications.orgId, user.orgId),
        eq(schema.notifications.userId, user.id),
      ];
      if (unreadOnly) {
        conditions.push(eq(schema.notifications.isRead, false));
      }

      const notifs = await db
        .select()
        .from(schema.notifications)
        .where(and(...conditions))
        .orderBy(desc(schema.notifications.createdAt))
        .limit(20);

      return {
        notifications: notifs.map((n) => ({
          title: n.title,
          message: n.message,
          type: n.type,
          read: n.isRead,
          date: n.createdAt.toISOString(),
        })),
        unreadCount: notifs.filter((n) => !n.isRead).length,
      };
    },
  });

  // Admin-only tools
  const isAdmin = user.isSuperAdmin || user.departments.some(
    (d) => d.role === "super-admin" || d.role === "dept-admin",
  );

  if (isAdmin) {
    tools.push({
      name: "gestionar_acceso_app",
      description: "Conceder o revocar acceso de un departamento a una aplicación",
      parameters: {
        appName: { type: "string", description: "Nombre de la aplicación", required: true },
        departmentName: { type: "string", description: "Nombre del departamento", required: true },
        action: { type: "string", description: "'grant' o 'revoke'", required: true, enum: ["grant", "revoke"] },
        accessLevel: { type: "string", description: "'full' o 'readonly' (solo para grant)", enum: ["full", "readonly"] },
      },
      requiresConfirmation: true,
      execute: async (params) => {
        const db = getDb();
        const appName = String(params["appName"]);
        const deptName = String(params["departmentName"]);
        const action = String(params["action"]);

        const appsFound = await db.select().from(schema.apps)
          .where(and(eq(schema.apps.orgId, user.orgId), sql`${schema.apps.name} ILIKE ${`%${appName}%`}`))
          .limit(1);
        const app = appsFound[0];
        if (!app) return { error: `App "${appName}" no encontrada` };

        const depts = await db.select().from(schema.departments)
          .where(and(eq(schema.departments.orgId, user.orgId), sql`${schema.departments.name} ILIKE ${`%${deptName}%`}`))
          .limit(1);
        const dept = depts[0];
        if (!dept) return { error: `Departamento "${deptName}" no encontrado` };

        if (action === "revoke") {
          await db.delete(schema.appAccessPolicies)
            .where(and(eq(schema.appAccessPolicies.appId, app.id), eq(schema.appAccessPolicies.departmentId, dept.id)));
          return { success: true, message: `Acceso revocado: ${dept.name} ya no tiene acceso a ${app.name}` };
        }

        const level = String(params["accessLevel"] ?? "readonly");
        await db.insert(schema.appAccessPolicies).values({
          appId: app.id,
          departmentId: dept.id,
          accessLevel: level,
        }).onConflictDoUpdate({
          target: [schema.appAccessPolicies.appId, schema.appAccessPolicies.departmentId],
          set: { accessLevel: level },
        });

        return { success: true, message: `Acceso concedido: ${dept.name} tiene acceso ${level} a ${app.name}` };
      },
    });

    tools.push({
      name: "toggle_mantenimiento_app",
      description: "Poner o quitar una aplicación en modo mantenimiento",
      parameters: {
        appName: { type: "string", description: "Nombre de la aplicación", required: true },
        maintenance: { type: "boolean", description: "true para activar, false para desactivar", required: true },
      },
      requiresConfirmation: true,
      execute: async (params) => {
        const db = getDb();
        const appName = String(params["appName"]);
        const maintenance = params["maintenance"] === true || params["maintenance"] === "true";

        const appsFound = await db.select().from(schema.apps)
          .where(and(eq(schema.apps.orgId, user.orgId), sql`${schema.apps.name} ILIKE ${`%${appName}%`}`))
          .limit(1);
        const app = appsFound[0];
        if (!app) return { error: `App "${appName}" no encontrada` };

        await db.update(schema.apps)
          .set({ isMaintenance: maintenance })
          .where(eq(schema.apps.id, app.id));

        return {
          success: true,
          message: maintenance
            ? `${app.name} puesta en modo mantenimiento`
            : `${app.name} sacada del modo mantenimiento`,
        };
      },
    });
  }

  return tools;
}
