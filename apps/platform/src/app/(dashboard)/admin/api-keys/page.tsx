import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { ApiKeysClient } from "./api-keys-client";

export default async function ApiKeysPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();
  const keys = await db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      keyPrefix: schema.apiKeys.keyPrefix,
      lastUsed: schema.apiKeys.lastUsed,
      expiresAt: schema.apiKeys.expiresAt,
      isActive: schema.apiKeys.isActive,
      createdAt: schema.apiKeys.createdAt,
    })
    .from(schema.apiKeys)
    .orderBy(desc(schema.apiKeys.createdAt));

  return <ApiKeysClient keys={keys} />;
}
