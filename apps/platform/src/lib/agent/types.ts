export interface AgentCapabilityParam {
  type: "string" | "number" | "boolean";
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface AgentCapabilityDef {
  name: string;
  description: string;
  requiredPermission: "read" | "write" | "admin";
  parameters?: Record<string, AgentCapabilityParam>;
}

export interface AgentContext {
  user: {
    id: string;
    name: string;
    email: string;
    isSuperAdmin: boolean;
    orgId: string;
    departments: Array<{
      name: string;
      slug: string;
      role: string;
      permissions: Record<string, boolean>;
    }>;
  };
  organization: {
    id: string;
    name: string;
  };
  availableApps: Array<{
    id: string;
    name: string;
    slug: string;
    internalUrl?: string;
    agent?: {
      name: string;
      description: string;
      endpoint: string;
      capabilities: AgentCapabilityDef[];
    };
    userAccessLevel: "full" | "readonly";
  }>;
}

export interface PlatformTool {
  name: string;
  description: string;
  parameters: Record<string, AgentCapabilityParam>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
  requiresConfirmation?: boolean;
}
