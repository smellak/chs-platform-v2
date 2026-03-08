import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { AgentContext, AgentCapabilityDef } from "./types";
import { resolveAgentPermissions } from "./permission-resolver";

export async function buildAgentContext(userId: string): Promise<AgentContext | null> {
  const db = getDb();

  // 1. Get user
  const usersFound = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const user = usersFound[0];
  if (!user || !user.isActive) return null;

  // 2. Get organization
  const orgs = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, user.orgId))
    .limit(1);
  const org = orgs[0];
  if (!org) return null;

  // 3. Get user's department roles
  const deptRoles = await db
    .select({
      departmentId: schema.userDepartmentRoles.departmentId,
      departmentName: schema.departments.name,
      departmentSlug: schema.departments.slug,
      roleSlug: schema.roles.slug,
      permissions: schema.roles.permissions,
    })
    .from(schema.userDepartmentRoles)
    .innerJoin(schema.departments, eq(schema.userDepartmentRoles.departmentId, schema.departments.id))
    .innerJoin(schema.roles, eq(schema.userDepartmentRoles.roleId, schema.roles.id))
    .where(eq(schema.userDepartmentRoles.userId, userId));

  // 4. Get all apps in org
  const allApps = await db
    .select()
    .from(schema.apps)
    .where(and(eq(schema.apps.orgId, user.orgId), eq(schema.apps.isActive, true)));

  // 5. Get app instances for internal URLs
  const instances = await db.select().from(schema.appInstances);
  const instanceMap = new Map(instances.map((i) => [i.appId, i]));

  // 6. Get app agents
  const agents = await db.select().from(schema.appAgents).where(eq(schema.appAgents.isActive, true));
  const agentMap = new Map(agents.map((a) => [a.appId, a]));

  // 7. Get access policies
  const policies = await db.select().from(schema.appAccessPolicies);

  // 8. Build available apps with access levels
  const availableApps: AgentContext["availableApps"] = [];

  for (const app of allApps) {
    let bestAccessLevel: "full" | "readonly" | null = null;

    if (user.isSuperAdmin) {
      bestAccessLevel = "full";
    } else {
      for (const dr of deptRoles) {
        const matching = policies.filter(
          (p) => p.appId === app.id && p.departmentId === dr.departmentId,
        );
        for (const policy of matching) {
          if (!policy.roleId || policy.roleId === dr.departmentId) {
            if (policy.accessLevel === "full") {
              bestAccessLevel = "full";
            } else if (!bestAccessLevel) {
              bestAccessLevel = "readonly";
            }
          }
        }
      }
    }

    if (!bestAccessLevel) continue;

    const agent = agentMap.get(app.id);
    const instance = instanceMap.get(app.id);

    availableApps.push({
      id: app.id,
      name: app.name,
      slug: app.slug,
      internalUrl: instance?.internalUrl ?? undefined,
      agent: agent
        ? {
            name: agent.name,
            description: agent.description ?? "",
            endpoint: agent.endpoint,
            capabilities: (agent.capabilities ?? []) as AgentCapabilityDef[],
          }
        : undefined,
      userAccessLevel: bestAccessLevel,
    });
  }

  // Apply agent permission rules (filter blocked apps/tools)
  const agentPerms = await resolveAgentPermissions(userId, user.orgId);
  const filteredApps = availableApps.filter((app) => !agentPerms.blockedApps.has(app.id));

  // Filter blocked tools from app capabilities
  for (const app of filteredApps) {
    if (app.agent && agentPerms.blockedTools.size > 0) {
      app.agent.capabilities = app.agent.capabilities.filter(
        (cap) => !agentPerms.blockedTools.has(cap.name) &&
                 !agentPerms.blockedTools.has(`${app.slug}__${cap.name}`),
      );
    }
  }

  return {
    user: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      orgId: user.orgId,
      departments: deptRoles.map((dr) => ({
        name: dr.departmentName,
        slug: dr.departmentSlug,
        role: dr.roleSlug,
        permissions: (dr.permissions ?? {}) as Record<string, boolean>,
      })),
    },
    organization: {
      id: org.id,
      name: org.name,
    },
    availableApps: filteredApps,
    agentPermissions: {
      maxTokensPerDay: agentPerms.maxTokensPerDay,
      maxMessagesPerHour: agentPerms.maxMessagesPerHour,
      allowedModels: agentPerms.allowedModels.size > 0 ? [...agentPerms.allowedModels] : null,
    },
  };
}
