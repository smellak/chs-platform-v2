import type { AgentConfig, AgentCapability, AgentRequest, AgentResponse, CHSUser } from "./types";
import { parseCHSHeaders } from "./parse-headers";
import { validateCapabilities, validateParameters } from "./validation";

export class CHSAgent {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    const error = validateCapabilities(config.capabilities);
    if (error) throw new Error(`Invalid agent config: ${error}`);
  }

  get name(): string {
    return this.config.name;
  }

  get description(): string {
    return this.config.description;
  }

  get capabilities(): AgentCapability[] {
    return this.config.capabilities;
  }

  private hasPermission(user: CHSUser, capability: AgentCapability): boolean {
    if (user.role === "super-admin") return true;
    if (capability.requiredPermission === "read") return true;
    if (capability.requiredPermission === "write" && user.accessLevel === "full") return true;
    if (capability.requiredPermission === "admin" && (user.role === "super-admin" || user.role === "dept-admin")) return true;
    return false;
  }

  middleware(): (req: { headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> }, res: { status: (code: number) => { json: (data: unknown) => void } }) => Promise<void> {
    return async (req, res) => {
      const user = parseCHSHeaders(req.headers);
      if (!user) {
        res.status(401).json({ error: "Aleph headers missing" });
        return;
      }

      const body = req.body as { capability?: string; parameters?: Record<string, unknown>; conversationContext?: Array<{ role: string; content: string }> };
      const { capability, parameters } = body;

      if (!capability || typeof capability !== "string") {
        res.status(400).json({ error: "Missing 'capability' in request body" });
        return;
      }

      const cap = this.config.capabilities.find(c => c.name === capability);
      if (!cap) {
        res.status(400).json({ error: `Capability '${capability}' not found` });
        return;
      }

      if (!this.hasPermission(user, cap)) {
        res.status(403).json({ error: `Permission '${cap.requiredPermission}' required` });
        return;
      }

      const validationError = validateParameters(cap, parameters ?? {});
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      try {
        const result = await this.config.handler({
          capability,
          parameters: parameters ?? {},
          user,
          conversationContext: body.conversationContext,
        });
        res.status(200).json(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Agent error";
        res.status(500).json({ error: message });
      }
    };
  }

  async routeHandler(request: Request): Promise<Response> {
    const headerObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerObj[key] = value;
    });

    const user = parseCHSHeaders(headerObj);
    if (!user) {
      return Response.json({ error: "Aleph headers missing" }, { status: 401 });
    }

    const body = (await request.json()) as {
      capability?: string;
      parameters?: Record<string, unknown>;
      conversationContext?: Array<{ role: string; content: string }>;
    };

    if (!body.capability || typeof body.capability !== "string") {
      return Response.json({ error: "Missing 'capability' in request body" }, { status: 400 });
    }

    const cap = this.config.capabilities.find(c => c.name === body.capability);
    if (!cap) {
      return Response.json({ error: `Capability '${body.capability}' not found` }, { status: 400 });
    }

    if (!this.hasPermission(user, cap)) {
      return Response.json({ error: `Permission '${cap.requiredPermission}' required` }, { status: 403 });
    }

    const validationError = validateParameters(cap, body.parameters ?? {});
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    try {
      const result = await this.config.handler({
        capability: body.capability,
        parameters: body.parameters ?? {},
        user,
        conversationContext: body.conversationContext,
      });
      return Response.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Agent error";
      return Response.json({ error: message }, { status: 500 });
    }
  }
}
