import { eq, and, or, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("permission-resolver");

export interface AgentPermissionSet {
  /** Map of appId → blocked status (true = blocked) */
  blockedApps: Set<string>;
  /** Set of blocked tool names */
  blockedTools: Set<string>;
  /** Set of allowed model IDs (empty = all allowed) */
  allowedModels: Set<string>;
  /** Max tokens per day (null = use default) */
  maxTokensPerDay: number | null;
  /** Max messages per hour (null = use default) */
  maxMessagesPerHour: number | null;
}

interface PermissionRule {
  targetType: string;
  appId: string | null;
  canAccess: boolean;
  blockedTools: string[];
  allowedModels: string[];
  maxTokensPerDay: number | null;
  maxMessagesPerHour: number | null;
}

/**
 * Resolves the effective agent permissions for a user.
 * Merge order (most specific wins):
 * 1. Department-level rules
 * 2. Role-level rules
 * 3. User-level rules (highest priority)
 */
export async function resolveAgentPermissions(
  userId: string,
  orgId: string,
): Promise<AgentPermissionSet> {
  const db = getDb();

  // Get user's department and role IDs
  const userDeptRoles = await db
    .select({
      departmentId: schema.userDepartmentRoles.departmentId,
      roleId: schema.userDepartmentRoles.roleId,
    })
    .from(schema.userDepartmentRoles)
    .where(eq(schema.userDepartmentRoles.userId, userId));

  const departmentIds = userDeptRoles.map((udr) => udr.departmentId);
  const roleIds = userDeptRoles.map((udr) => udr.roleId);

  // Fetch all relevant permission rules
  const allTargetIds = [...departmentIds, ...roleIds, userId];
  if (allTargetIds.length === 0) {
    return {
      blockedApps: new Set(),
      blockedTools: new Set(),
      allowedModels: new Set(),
      maxTokensPerDay: null,
      maxMessagesPerHour: null,
    };
  }

  const rules = await db
    .select({
      targetType: schema.agentPermissions.targetType,
      targetId: schema.agentPermissions.targetId,
      appId: schema.agentPermissions.appId,
      canAccess: schema.agentPermissions.canAccess,
      blockedTools: schema.agentPermissions.blockedTools,
      allowedModels: schema.agentPermissions.allowedModels,
      maxTokensPerDay: schema.agentPermissions.maxTokensPerDay,
      maxMessagesPerHour: schema.agentPermissions.maxMessagesPerHour,
    })
    .from(schema.agentPermissions)
    .where(
      and(
        eq(schema.agentPermissions.orgId, orgId),
        or(
          // Department rules
          ...departmentIds.map((dId) =>
            and(
              eq(schema.agentPermissions.targetType, "department"),
              eq(schema.agentPermissions.targetId, dId),
            ),
          ),
          // Role rules
          ...roleIds.map((rId) =>
            and(
              eq(schema.agentPermissions.targetType, "role"),
              eq(schema.agentPermissions.targetId, rId),
            ),
          ),
          // User rules
          and(
            eq(schema.agentPermissions.targetType, "user"),
            eq(schema.agentPermissions.targetId, userId),
          ),
        ),
      ),
    );

  // Merge rules by priority: department (1) < role (2) < user (3)
  const priorityMap: Record<string, number> = {
    department: 1,
    role: 2,
    user: 3,
  };

  const sortedRules = [...rules].sort(
    (a, b) => (priorityMap[a.targetType] ?? 0) - (priorityMap[b.targetType] ?? 0),
  );

  const result: AgentPermissionSet = {
    blockedApps: new Set(),
    blockedTools: new Set(),
    allowedModels: new Set(),
    maxTokensPerDay: null,
    maxMessagesPerHour: null,
  };

  for (const rule of sortedRules) {
    // Handle app access
    if (!rule.canAccess && rule.appId) {
      result.blockedApps.add(rule.appId);
    }

    // Global access block (appId = null means all apps)
    if (!rule.canAccess && !rule.appId) {
      // Block all - but higher priority rules can unblock
      // We'll handle this by checking if canAccess was later set to true
    }

    // Merge blocked tools (additive)
    const blockedTools = rule.blockedTools as string[] | null;
    if (blockedTools && Array.isArray(blockedTools)) {
      for (const tool of blockedTools) {
        result.blockedTools.add(tool);
      }
    }

    // Allowed models (most specific wins - override, not additive)
    const allowedModels = rule.allowedModels as string[] | null;
    if (allowedModels && Array.isArray(allowedModels) && allowedModels.length > 0) {
      // Higher priority clears and replaces
      result.allowedModels.clear();
      for (const model of allowedModels) {
        result.allowedModels.add(model);
      }
    }

    // Rate limits (most specific wins)
    if (rule.maxTokensPerDay !== null) {
      result.maxTokensPerDay = rule.maxTokensPerDay;
    }
    if (rule.maxMessagesPerHour !== null) {
      result.maxMessagesPerHour = rule.maxMessagesPerHour;
    }
  }

  logger.debug("Resolved permissions", {
    userId,
    blockedApps: result.blockedApps.size,
    blockedTools: result.blockedTools.size,
    allowedModels: result.allowedModels.size,
    maxTokensPerDay: result.maxTokensPerDay,
    maxMessagesPerHour: result.maxMessagesPerHour,
  });

  return result;
}
