import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { ApiProvidersClient } from "./api-providers-client";

export default async function ApiProvidersPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const providers = await db
    .select()
    .from(schema.apiProviders)
    .orderBy(schema.apiProviders.name);

  const providersData = providers.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    providerType: p.providerType,
    model: p.model,
    baseUrl: p.baseUrl,
    hasApiKey: Boolean(p.apiKeyEncrypted),
    costPer1kInput: p.costPer1kInput,
    costPer1kOutput: p.costPer1kOutput,
    isActive: p.isActive,
  }));

  return <ApiProvidersClient providers={providersData} />;
}
