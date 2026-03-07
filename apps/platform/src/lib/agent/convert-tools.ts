import { tool } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";
import type { PlatformTool, AgentCapabilityParam } from "./types";

function paramToZod(param: AgentCapabilityParam): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  if (param.type === "number") {
    schema = z.number().describe(param.description);
  } else if (param.type === "boolean") {
    schema = z.boolean().describe(param.description);
  } else {
    if (param.enum) {
      schema = z.enum(param.enum as [string, ...string[]]).describe(param.description);
    } else {
      schema = z.string().describe(param.description);
    }
  }
  if (!param.required) {
    schema = schema.optional();
  }
  return schema;
}

export function convertToAISDKTools(platformTools: PlatformTool[]): ToolSet {
  const tools: ToolSet = {};

  for (const pt of platformTools) {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [name, param] of Object.entries(pt.parameters)) {
      shape[name] = paramToZod(param);
    }

    tools[pt.name] = tool({
      description: pt.description,
      inputSchema: z.object(shape),
      execute: async (params: Record<string, unknown>) => {
        const result = await pt.execute(params);
        return result;
      },
    });
  }

  return tools;
}
