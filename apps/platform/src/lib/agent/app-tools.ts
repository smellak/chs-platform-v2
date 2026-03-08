import type { AgentContext, PlatformTool } from "./types";

export function getAppTools(ctx: AgentContext): PlatformTool[] {
  const { user, availableApps } = ctx;
  const tools: PlatformTool[] = [];

  const isAdmin = user.isSuperAdmin || user.departments.some(
    (d) => d.role === "super-admin" || d.role === "dept-admin",
  );

  for (const app of availableApps) {
    if (!app.agent) continue;

    for (const capability of app.agent.capabilities) {
      // Filter by permission
      if (!user.isSuperAdmin) {
        if (capability.requiredPermission === "write" && app.userAccessLevel !== "full") continue;
        if (capability.requiredPermission === "admin" && !isAdmin) continue;
      }

      const toolParams: PlatformTool["parameters"] = {};
      if (capability.parameters) {
        for (const [paramName, param] of Object.entries(capability.parameters)) {
          toolParams[paramName] = {
            type: (param.type as "string" | "number" | "boolean") ?? "string",
            description: (param.description as string) ?? paramName,
            required: (param.required as boolean) ?? false,
          };
        }
      }

      tools.push({
        name: `${app.slug}__${capability.name}`,
        description: `[${app.agent.name}] ${capability.description}`,
        parameters: toolParams,
        requiresConfirmation: capability.requiredPermission === "write" || capability.requiredPermission === "admin",
        execute: async (params) => {
          const instanceUrl = app.internalUrl ?? "";
          if (!instanceUrl) {
            return { error: `No se pudo conectar con ${app.name}: URL no configurada` };
          }

          const url = `${instanceUrl}${app.agent!.endpoint}`;

          const bestDept = user.departments[0];
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CHS-User-Id": user.id,
              "X-CHS-User-Name": user.name,
              "X-CHS-User-Email": user.email,
              "X-CHS-Org-Id": user.orgId,
              "X-CHS-Role": bestDept?.role ?? "user",
              "X-CHS-Dept": bestDept?.name ?? "",
              "X-CHS-Access-Level": app.userAccessLevel,
            },
            body: JSON.stringify({
              capability: capability.name,
              parameters: params,
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => "");
            return { error: `${app.agent!.name} respondió con error ${response.status}: ${errText}` };
          }

          return await response.json();
        },
      });
    }
  }

  return tools;
}
