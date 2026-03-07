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
    ...p,
    createdAt: p.createdAt.toISOString(),
  }));

  return <ApiProvidersClient providers={providersData} />;
}
