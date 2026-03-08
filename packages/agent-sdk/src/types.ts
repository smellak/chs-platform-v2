export interface AgentCapability {
  name: string;
  description: string;
  requiredPermission: "read" | "write" | "admin";
  parameters?: Record<string, {
    type: "string" | "number" | "boolean";
    description: string;
    required?: boolean;
    enum?: string[];
  }>;
}

export interface CHSUser {
  id: string;
  name: string;
  email: string;
  role: string;
  accessLevel: string;
  orgId?: string;
  department?: string;
}

export interface AgentRequest {
  capability: string;
  parameters: Record<string, unknown>;
  user: CHSUser;
  conversationContext?: Array<{ role: string; content: string }>;
}

export interface AgentResponse {
  text: string;
  data?: unknown;
  error?: string;
}

export interface AgentConfig {
  name: string;
  description: string;
  capabilities: AgentCapability[];
  handler: (request: AgentRequest) => Promise<AgentResponse>;
}
