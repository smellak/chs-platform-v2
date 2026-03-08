import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { AiModelsClient } from "./ai-models-client";

export default async function AiModelsPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const models = await db
    .select({
      id: schema.aiModels.id,
      providerId: schema.aiModels.providerId,
      modelId: schema.aiModels.modelId,
      displayName: schema.aiModels.displayName,
      costPer1kInput: schema.aiModels.costPer1kInput,
      costPer1kOutput: schema.aiModels.costPer1kOutput,
      maxTokens: schema.aiModels.maxTokens,
      isActive: schema.aiModels.isActive,
      isDefault: schema.aiModels.isDefault,
      providerName: schema.apiProviders.name,
      providerType: schema.apiProviders.providerType,
    })
    .from(schema.aiModels)
    .innerJoin(schema.apiProviders, eq(schema.aiModels.providerId, schema.apiProviders.id))
    .orderBy(schema.aiModels.displayName);

  const providers = await db
    .select({
      id: schema.apiProviders.id,
      name: schema.apiProviders.name,
      providerType: schema.apiProviders.providerType,
    })
    .from(schema.apiProviders)
    .where(eq(schema.apiProviders.isActive, true))
    .orderBy(schema.apiProviders.name);

  const apps = await db
    .select({
      id: schema.apps.id,
      name: schema.apps.name,
      slug: schema.apps.slug,
    })
    .from(schema.apps)
    .where(eq(schema.apps.isActive, true))
    .orderBy(schema.apps.name);

  const assignments = await db
    .select({
      id: schema.appModelAssignments.id,
      appId: schema.appModelAssignments.appId,
      modelId: schema.appModelAssignments.modelId,
      priority: schema.appModelAssignments.priority,
      isActive: schema.appModelAssignments.isActive,
      modelDisplayName: schema.aiModels.displayName,
      appName: schema.apps.name,
    })
    .from(schema.appModelAssignments)
    .innerJoin(schema.aiModels, eq(schema.appModelAssignments.modelId, schema.aiModels.id))
    .leftJoin(schema.apps, eq(schema.appModelAssignments.appId, schema.apps.id))
    .orderBy(schema.appModelAssignments.priority);

  return (
    <AiModelsClient
      models={models}
      providers={providers}
      apps={apps}
      assignments={assignments.map((a) => ({
        ...a,
        appName: a.appName ?? "Agente plataforma",
      }))}
    />
  );
}
