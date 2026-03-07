import type { AgentCapability } from "./types";

export function validateCapabilities(capabilities: AgentCapability[]): string | null {
  if (!capabilities.length) return "At least one capability is required";

  const names = new Set<string>();
  for (const cap of capabilities) {
    if (!cap.name || typeof cap.name !== "string") return `Capability name is required`;
    if (names.has(cap.name)) return `Duplicate capability name: ${cap.name}`;
    names.add(cap.name);
    if (!cap.description) return `Description required for capability: ${cap.name}`;
    if (!["read", "write", "admin"].includes(cap.requiredPermission)) {
      return `Invalid permission for capability ${cap.name}: ${cap.requiredPermission}`;
    }
    if (cap.parameters) {
      for (const [paramName, param] of Object.entries(cap.parameters)) {
        if (!["string", "number", "boolean"].includes(param.type)) {
          return `Invalid parameter type for ${cap.name}.${paramName}: ${param.type}`;
        }
      }
    }
  }
  return null;
}

export function validateParameters(
  capability: AgentCapability,
  params: Record<string, unknown>,
): string | null {
  if (!capability.parameters) return null;

  for (const [name, schema] of Object.entries(capability.parameters)) {
    const value = params[name];
    if (schema.required && (value === undefined || value === null)) {
      return `Parameter '${name}' is required for '${capability.name}'`;
    }
    if (value !== undefined && value !== null) {
      const expectedType = schema.type === "number" ? "number" : schema.type === "boolean" ? "boolean" : "string";
      if (typeof value !== expectedType) {
        return `Parameter '${name}' must be type '${schema.type}'`;
      }
      if (schema.enum && typeof value === "string" && !schema.enum.includes(value)) {
        return `Parameter '${name}' must be one of: ${schema.enum.join(", ")}`;
      }
    }
  }
  return null;
}
