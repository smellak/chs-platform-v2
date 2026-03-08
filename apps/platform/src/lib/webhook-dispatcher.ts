import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const MAX_FAIL_COUNT = 5;
const WEBHOOK_TIMEOUT_MS = 10_000;

export async function dispatchWebhookEvent(
  orgId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  const db = getDb();

  const hooks = await db
    .select()
    .from(schema.webhooks)
    .where(eq(schema.webhooks.orgId, orgId));

  const matchingHooks = hooks.filter(
    (h) => h.isActive && (h.events as string[]).includes(event),
  );

  for (const hook of matchingHooks) {
    const payload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    const signature = createHmac("sha256", hook.secret)
      .update(payload)
      .digest("hex");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CHS-Signature": signature,
          "X-CHS-Event": event,
        },
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        await db
          .update(schema.webhooks)
          .set({
            lastTriggered: new Date(),
            lastStatus: res.status,
            failCount: 0,
          })
          .where(eq(schema.webhooks.id, hook.id));
      } else {
        const newFailCount = (hook.failCount ?? 0) + 1;
        await db
          .update(schema.webhooks)
          .set({
            lastTriggered: new Date(),
            lastStatus: res.status,
            failCount: newFailCount,
            isActive: newFailCount < MAX_FAIL_COUNT,
          })
          .where(eq(schema.webhooks.id, hook.id));
      }
    } catch {
      const newFailCount = (hook.failCount ?? 0) + 1;
      await db
        .update(schema.webhooks)
        .set({
          lastTriggered: new Date(),
          lastStatus: 0,
          failCount: newFailCount,
          isActive: newFailCount < MAX_FAIL_COUNT,
        })
        .where(eq(schema.webhooks.id, hook.id));
    }
  }
}
