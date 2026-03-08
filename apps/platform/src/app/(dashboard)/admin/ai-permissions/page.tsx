import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { AiPermissionsClient } from "./ai-permissions-client";

export default async function AiPermissionsPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const permissions = await db
    .select()
    .from(schema.agentPermissions)
    .orderBy(schema.agentPermissions.createdAt);

  const departments = await db
    .select({ id: schema.departments.id, name: schema.departments.name })
    .from(schema.departments)
    .orderBy(schema.departments.name);

  const roles = await db
    .select({ id: schema.roles.id, name: schema.roles.name })
    .from(schema.roles)
    .orderBy(schema.roles.name);

  const users = await db
    .select({
      id: schema.users.id,
      name: schema.users.firstName,
      lastName: schema.users.lastName,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(eq(schema.users.isActive, true))
    .orderBy(schema.users.firstName);

  const apps = await db
    .select({ id: schema.apps.id, name: schema.apps.name })
    .from(schema.apps)
    .where(eq(schema.apps.isActive, true))
    .orderBy(schema.apps.name);

  const models = await db
    .select({ id: schema.aiModels.id, displayName: schema.aiModels.displayName })
    .from(schema.aiModels)
    .where(eq(schema.aiModels.isActive, true))
    .orderBy(schema.aiModels.displayName);

  // Resolve target names
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));
  const roleMap = new Map(roles.map((r) => [r.id, r.name]));
  const userMap = new Map(users.map((u) => [u.id, `${u.name} ${u.lastName}`]));
  const appMap = new Map(apps.map((a) => [a.id, a.name]));

  return (
    <AiPermissionsClient
      permissions={permissions.map((p) => ({
        id: p.id,
        targetType: p.targetType,
        targetId: p.targetId,
        targetName:
          p.targetType === "department"
            ? deptMap.get(p.targetId) ?? p.targetId
            : p.targetType === "role"
              ? roleMap.get(p.targetId) ?? p.targetId
              : userMap.get(p.targetId) ?? p.targetId,
        appId: p.appId,
        appName: p.appId ? appMap.get(p.appId) ?? "—" : "Todas",
        canAccess: p.canAccess,
        blockedTools: (p.blockedTools ?? []) as string[],
        allowedModels: (p.allowedModels ?? []) as string[],
        maxTokensPerDay: p.maxTokensPerDay,
        maxMessagesPerHour: p.maxMessagesPerHour,
      }))}
      departments={departments}
      roles={roles}
      users={users.map((u) => ({ id: u.id, name: `${u.name} ${u.lastName}`, email: u.email }))}
      apps={apps}
      models={models}
    />
  );
}
