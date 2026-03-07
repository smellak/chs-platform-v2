import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { AppsClient } from "./apps-client";

export default async function AppsPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const apps = await db.select().from(schema.apps).orderBy(schema.apps.name);
  const departments = await db.select().from(schema.departments);

  const instances = await db.select().from(schema.appInstances);
  const accessPolicies = await db.select().from(schema.appAccessPolicies);
  const appAgents = await db.select().from(schema.appAgents);

  const appsData = apps.map((app) => {
    const instance = instances.find((i) => i.appId === app.id);
    const agent = appAgents.find((a) => a.appId === app.id);

    return {
      ...app,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
      instance: instance
        ? {
            ...instance,
            createdAt: instance.createdAt.toISOString(),
            lastHealthCheck: instance.lastHealthCheck?.toISOString() ?? null,
          }
        : null,
      access: accessPolicies
        .filter((p) => p.appId === app.id)
        .map((p) => ({
          departmentId: p.departmentId,
          accessLevel: p.accessLevel,
          departmentName:
            departments.find((d) => d.id === p.departmentId)?.name ?? "",
        })),
      agent: agent
        ? {
            name: agent.name,
            description: agent.description ?? "",
            endpoint: agent.endpoint,
            capabilities: (agent.capabilities ?? []).map((cap) => ({
              name: cap.name,
              description: cap.description,
              parameters: Object.entries(cap.parameters).map(([paramName, paramVal]) => {
                const param = paramVal as { type?: string; required?: boolean; description?: string; enumValues?: string[] };
                return {
                  name: paramName,
                  type: param.type ?? "string",
                  required: param.required ?? false,
                  description: param.description ?? "",
                  enumValues: param.enumValues,
                };
              }),
            })),
          }
        : null,
    };
  });

  return (
    <AppsClient
      apps={appsData}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
    />
  );
}
