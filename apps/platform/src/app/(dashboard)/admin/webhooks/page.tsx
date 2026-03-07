import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { WebhooksClient } from "./webhooks-client";

export default async function WebhooksPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();
  const hooks = await db
    .select({
      id: schema.webhooks.id,
      name: schema.webhooks.name,
      url: schema.webhooks.url,
      events: schema.webhooks.events,
      isActive: schema.webhooks.isActive,
      lastTriggered: schema.webhooks.lastTriggered,
      lastStatus: schema.webhooks.lastStatus,
      failCount: schema.webhooks.failCount,
      createdAt: schema.webhooks.createdAt,
    })
    .from(schema.webhooks)
    .orderBy(desc(schema.webhooks.createdAt));

  return <WebhooksClient webhooks={hooks} />;
}
