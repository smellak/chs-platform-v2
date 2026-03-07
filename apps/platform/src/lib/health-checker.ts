import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const CHECK_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 5_000;

interface HealthCheckResult {
  status: "online" | "offline" | "degraded";
  responseMs: number;
  httpCode: number | null;
  details: string | null;
}

async function checkInstance(internalUrl: string, healthEndpoint: string): Promise<HealthCheckResult> {
  const url = `${internalUrl.replace(/\/$/, "")}${healthEndpoint}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Aleph-HealthChecker/0.1" },
    });

    clearTimeout(timeout);
    const responseMs = Date.now() - start;
    const body = await res.text().catch(() => "");
    const details = body.slice(0, 500);

    if (res.ok) {
      return { status: "online", responseMs, httpCode: res.status, details };
    }
    if (res.status >= 500) {
      return { status: "degraded", responseMs, httpCode: res.status, details };
    }
    return { status: "offline", responseMs, httpCode: res.status, details };
  } catch {
    const responseMs = Date.now() - start;
    return { status: "offline", responseMs, httpCode: null, details: "Connection failed or timeout" };
  }
}

async function runHealthChecks(): Promise<void> {
  try {
    const db = getDb();

    const instances = await db
      .select({
        instanceId: schema.appInstances.id,
        appId: schema.appInstances.appId,
        internalUrl: schema.appInstances.internalUrl,
        healthEndpoint: schema.appInstances.healthEndpoint,
        currentStatus: schema.appInstances.status,
        appName: schema.apps.name,
        appIsActive: schema.apps.isActive,
        orgId: schema.apps.orgId,
      })
      .from(schema.appInstances)
      .innerJoin(schema.apps, eq(schema.appInstances.appId, schema.apps.id));

    for (const instance of instances) {
      if (!instance.appIsActive) continue;

      const endpoint = instance.healthEndpoint ?? "/api/health";
      const result = await checkInstance(instance.internalUrl, endpoint);

      // Record service status
      await db.insert(schema.serviceStatus).values({
        appInstanceId: instance.instanceId,
        status: result.status,
        responseMs: result.responseMs,
        httpCode: result.httpCode,
        details: result.details ? { message: result.details } : undefined,
      });

      // Update instance status and last check time
      await db
        .update(schema.appInstances)
        .set({
          status: result.status,
          lastHealthCheck: new Date(),
        })
        .where(eq(schema.appInstances.id, instance.instanceId));

      const previousStatus = instance.currentStatus;

      // Detect status transitions
      if (previousStatus === "online" && result.status === "offline") {
        // Service went down
        await db.insert(schema.notifications).values({
          orgId: instance.orgId,
          title: "Servicio caído",
          message: `${instance.appName} no está respondiendo`,
          type: "error",
          entityType: "app",
          entityId: instance.appId,
        });

        await db.insert(schema.activityLogs).values({
          orgId: instance.orgId,
          action: "service.down",
          entityType: "app",
          entityId: instance.appId,
          details: {
            appName: instance.appName,
            httpCode: result.httpCode,
            responseMs: result.responseMs,
          },
        });
      } else if (
        (previousStatus === "offline" || previousStatus === "degraded") &&
        result.status === "online"
      ) {
        // Service restored
        await db.insert(schema.notifications).values({
          orgId: instance.orgId,
          title: "Servicio restaurado",
          message: `${instance.appName} vuelve a estar en línea`,
          type: "success",
          entityType: "app",
          entityId: instance.appId,
        });

        await db.insert(schema.activityLogs).values({
          orgId: instance.orgId,
          action: "service.up",
          entityType: "app",
          entityId: instance.appId,
          details: {
            appName: instance.appName,
            responseMs: result.responseMs,
          },
        });
      }
    }
  } catch {
    // Silently handle errors — health checker should not crash the app
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startHealthChecker(): void {
  if (intervalId) return;

  // Run first check after a short delay
  setTimeout(() => {
    void runHealthChecks();
  }, 5_000);

  intervalId = setInterval(() => {
    void runHealthChecks();
  }, CHECK_INTERVAL_MS);
}

export function stopHealthChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export { runHealthChecks };
