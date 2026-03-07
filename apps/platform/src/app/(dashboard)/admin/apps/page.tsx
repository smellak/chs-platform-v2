import { eq } from "drizzle-orm";
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

  const appsData = apps.map((app) => ({
    ...app,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    instance: instances.find((i) => i.appId === app.id)
      ? {
          ...instances.find((i) => i.appId === app.id)!,
          createdAt: instances.find((i) => i.appId === app.id)!.createdAt.toISOString(),
          lastHealthCheck: instances.find((i) => i.appId === app.id)!.lastHealthCheck?.toISOString() ?? null,
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
  }));

  return (
    <AppsClient
      apps={appsData}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
    />
  );
}
