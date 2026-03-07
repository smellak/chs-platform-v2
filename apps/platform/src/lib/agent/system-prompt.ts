import type { AgentContext } from "./types";

function filterCapabilities(
  capabilities: AgentContext["availableApps"][0]["agent"] extends infer A
    ? A extends { capabilities: infer C } ? C : never
    : never,
  accessLevel: "full" | "readonly",
  isSuperAdmin: boolean,
  isAdmin: boolean,
): AgentContext["availableApps"][0]["agent"] extends infer A
  ? A extends { capabilities: infer C } ? C : never
  : never {
  type Cap = NonNullable<AgentContext["availableApps"][0]["agent"]>["capabilities"][0];
  return (capabilities as Cap[]).filter((cap) => {
    if (isSuperAdmin) return true;
    if (cap.requiredPermission === "read") return true;
    if (cap.requiredPermission === "write" && accessLevel === "full") return true;
    if (cap.requiredPermission === "admin" && isAdmin) return true;
    return false;
  }) as typeof capabilities;
}

export function buildSystemPrompt(ctx: AgentContext): string {
  const { user, organization, availableApps } = ctx;

  const isAdmin = user.isSuperAdmin || user.departments.some(
    (d) => d.role === "super-admin" || d.role === "dept-admin",
  );

  const deptList = user.departments
    .map((d) => `  - ${d.name} (rol: ${d.role})`)
    .join("\n");

  const appsWithAgent: string[] = [];
  const appsWithoutAgent: string[] = [];

  for (const app of availableApps) {
    if (app.agent) {
      const filteredCaps = filterCapabilities(
        app.agent.capabilities,
        app.userAccessLevel,
        user.isSuperAdmin,
        isAdmin,
      );

      if (filteredCaps.length > 0) {
        const capList = filteredCaps
          .map((c) => `    - ${c.name}: ${c.description}`)
          .join("\n");
        appsWithAgent.push(
          `- ${app.name} (agente: ${app.agent.name}): ${app.agent.description}\n  Puedes hacer:\n${capList}`,
        );
      }
    } else {
      appsWithoutAgent.push(`- ${app.name}: Aplicación disponible (sin agente IA configurado)`);
    }
  }

  const appsSections: string[] = [];
  if (appsWithAgent.length > 0) {
    appsSections.push(appsWithAgent.join("\n"));
  }
  if (appsWithoutAgent.length > 0) {
    appsSections.push(appsWithoutAgent.join("\n"));
  }

  const platformToolsSection = isAdmin
    ? `
HERRAMIENTAS DE ADMINISTRACIÓN DISPONIBLES:
- gestionar_acceso_app: Conceder o revocar acceso de departamentos a apps
- gestionar_usuario: Crear, editar o desactivar usuarios
- toggle_mantenimiento_app: Poner o quitar apps en modo mantenimiento`
    : "";

  return `Eres el Agente CHS, el asistente inteligente de ${organization.name}.
Respondes siempre en español. Eres conciso, profesional, y útil.

USUARIO ACTUAL:
- Nombre: ${user.name}
- Email: ${user.email}
- Departamentos:
${deptList || "  (sin departamento asignado)"}
- Es administrador: ${user.isSuperAdmin ? "Sí (super-admin)" : isAdmin ? "Sí (admin de departamento)" : "No"}

HERRAMIENTAS DE CONSULTA DISPONIBLES:
- buscar_usuarios: Buscar usuarios por nombre, email o departamento
- ver_servicios: Ver estado de todos los servicios/aplicaciones
- ver_actividad_reciente: Ver últimas acciones en la plataforma
- ver_accesos_app: Ver qué departamentos tienen acceso a una app
- ver_costes_api: Ver costes de API por período
- ver_notificaciones: Ver notificaciones del usuario
${platformToolsSection}

APPS DISPONIBLES PARA ESTE USUARIO:
${appsSections.join("\n") || "No hay aplicaciones disponibles."}

REGLAS ESTRICTAS:
1. NUNCA ejecutes una acción que el usuario no tenga permiso de hacer.
2. Si el usuario pide algo de una app a la que no tiene acceso, responde: "No tienes acceso a esa aplicación."
3. Para acciones que modifican datos (crear, editar, eliminar), SIEMPRE pide confirmación antes de ejecutar.
4. Si no estás seguro de qué herramienta usar, pregunta al usuario para clarificar.
5. Cuando muestres datos (listas, tablas), formatea con markdown.
6. Adapta tu tono: formal para informes, casual para consultas rápidas.
7. Si una herramienta falla, informa al usuario del error de forma clara sin mostrar detalles técnicos.
8. SIEMPRE usa las herramientas disponibles para obtener información actualizada. No inventes datos.`;
}
