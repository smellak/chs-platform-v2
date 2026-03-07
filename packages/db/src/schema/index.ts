import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// ─── Organizations ───────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  domain: varchar("domain", { length: 200 }),
  logo: text("logo"),
  settings: jsonb("settings").default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  departments: many(departments),
  roles: many(roles),
  users: many(users),
  apps: many(apps),
  notifications: many(notifications),
  activityLogs: many(activityLogs),
  apiProviders: many(apiProviders),
  apiCostLogs: many(apiCostLogs),
  agentConversations: many(agentConversations),
}));

// ─── Departments ─────────────────────────────────────────────────────────────

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    icon: varchar("icon", { length: 50 }),
    color: varchar("color", { length: 7 }),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("departments_org_slug_idx").on(table.orgId, table.slug),
  ],
);

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [departments.orgId],
    references: [organizations.id],
  }),
  userDepartmentRoles: many(userDepartmentRoles),
  appAccessPolicies: many(appAccessPolicies),
}));

// ─── Roles ───────────────────────────────────────────────────────────────────

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull(),
    description: text("description"),
    permissions: jsonb("permissions").default({}).$type<Record<string, boolean>>(),
    isSystem: boolean("is_system").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("roles_org_slug_idx").on(table.orgId, table.slug),
  ],
);

export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roles.orgId],
    references: [organizations.id],
  }),
  userDepartmentRoles: many(userDepartmentRoles),
  appAccessPolicies: many(appAccessPolicies),
}));

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    email: varchar("email", { length: 255 }).notNull(),
    username: varchar("username", { length: 100 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    avatar: text("avatar"),
    isActive: boolean("is_active").default(true).notNull(),
    isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_org_email_idx").on(table.orgId, table.email),
    uniqueIndex("users_org_username_idx").on(table.orgId, table.username),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  userDepartmentRoles: many(userDepartmentRoles),
  refreshTokens: many(refreshTokens),
  agentConversations: many(agentConversations),
}));

// ─── User Department Roles ───────────────────────────────────────────────────

export const userDepartmentRoles = pgTable(
  "user_department_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("udr_user_dept_idx").on(table.userId, table.departmentId),
  ],
);

export const userDepartmentRolesRelations = relations(userDepartmentRoles, ({ one }) => ({
  user: one(users, {
    fields: [userDepartmentRoles.userId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [userDepartmentRoles.departmentId],
    references: [departments.id],
  }),
  role: one(roles, {
    fields: [userDepartmentRoles.roleId],
    references: [roles.id],
  }),
}));

// ─── Apps ────────────────────────────────────────────────────────────────────

export const apps = pgTable(
  "apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 50 }),
    color: varchar("color", { length: 7 }),
    category: varchar("category", { length: 100 }),
    version: varchar("version", { length: 20 }).default("1.0"),
    isActive: boolean("is_active").default(true).notNull(),
    isMaintenance: boolean("is_maintenance").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("apps_org_slug_idx").on(table.orgId, table.slug),
  ],
);

export const appsRelations = relations(apps, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [apps.orgId],
    references: [organizations.id],
  }),
  instances: many(appInstances),
  accessPolicies: many(appAccessPolicies),
  agent: many(appAgents),
}));

// ─── App Instances ───────────────────────────────────────────────────────────

export const appInstances = pgTable("app_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: uuid("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  internalUrl: text("internal_url").notNull(),
  externalDomain: varchar("external_domain", { length: 255 }),
  healthEndpoint: varchar("health_endpoint", { length: 255 }).default("/api/health"),
  publicPaths: jsonb("public_paths").default([]).$type<string[]>(),
  traefikConfigPath: text("traefik_config_path"),
  status: varchar("status", { length: 20 }).default("unknown"),
  lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appInstancesRelations = relations(appInstances, ({ one, many }) => ({
  app: one(apps, {
    fields: [appInstances.appId],
    references: [apps.id],
  }),
  serviceStatuses: many(serviceStatus),
}));

// ─── App Access Policies ─────────────────────────────────────────────────────

export const appAccessPolicies = pgTable(
  "app_access_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").references(() => roles.id),
    accessLevel: varchar("access_level", { length: 20 }).notNull().default("readonly"),
    grantedBy: uuid("granted_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("aap_app_dept_role_idx").on(table.appId, table.departmentId, table.roleId),
  ],
);

export const appAccessPoliciesRelations = relations(appAccessPolicies, ({ one }) => ({
  app: one(apps, {
    fields: [appAccessPolicies.appId],
    references: [apps.id],
  }),
  department: one(departments, {
    fields: [appAccessPolicies.departmentId],
    references: [departments.id],
  }),
  role: one(roles, {
    fields: [appAccessPolicies.roleId],
    references: [roles.id],
  }),
  grantedByUser: one(users, {
    fields: [appAccessPolicies.grantedBy],
    references: [users.id],
  }),
}));

// ─── App Agents ──────────────────────────────────────────────────────────────

interface AgentCapability {
  name: string;
  description: string;
  requiredPermission: string;
  parameters: Record<string, unknown>;
}

export const appAgents = pgTable("app_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: uuid("app_id")
    .notNull()
    .unique()
    .references(() => apps.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  capabilities: jsonb("capabilities").notNull().default([]).$type<AgentCapability[]>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appAgentsRelations = relations(appAgents, ({ one }) => ({
  app: one(apps, {
    fields: [appAgents.appId],
    references: [apps.id],
  }),
}));

// ─── Agent Conversations ─────────────────────────────────────────────────────

export const agentConversations = pgTable("agent_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  title: varchar("title", { length: 200 }).default("Nueva conversación"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentConversationsRelations = relations(agentConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [agentConversations.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [agentConversations.orgId],
    references: [organizations.id],
  }),
  messages: many(agentMessages),
}));

// ─── Agent Messages ──────────────────────────────────────────────────────────

export const agentMessages = pgTable("agent_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => agentConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  routedToAppId: uuid("routed_to_app_id").references(() => apps.id),
  toolCalls: jsonb("tool_calls").$type<Record<string, unknown>[]>(),
  tokensUsed: integer("tokens_used"),
  model: varchar("model", { length: 50 }),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentMessagesRelations = relations(agentMessages, ({ one, many }) => ({
  conversation: one(agentConversations, {
    fields: [agentMessages.conversationId],
    references: [agentConversations.id],
  }),
  routedToApp: one(apps, {
    fields: [agentMessages.routedToAppId],
    references: [apps.id],
  }),
  toolCallRecords: many(agentToolCalls),
}));

// ─── Agent Tool Calls ────────────────────────────────────────────────────────

export const agentToolCalls = pgTable("agent_tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => agentMessages.id, { onDelete: "cascade" }),
  appId: uuid("app_id").references(() => apps.id),
  capability: varchar("capability", { length: 100 }).notNull(),
  parameters: jsonb("parameters").default({}).$type<Record<string, unknown>>(),
  response: jsonb("response").$type<Record<string, unknown>>(),
  status: varchar("status", { length: 20 }).default("pending"),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
});

export const agentToolCallsRelations = relations(agentToolCalls, ({ one }) => ({
  message: one(agentMessages, {
    fields: [agentToolCalls.messageId],
    references: [agentMessages.id],
  }),
  app: one(apps, {
    fields: [agentToolCalls.appId],
    references: [apps.id],
  }),
}));

// ─── Service Status ──────────────────────────────────────────────────────────

export const serviceStatus = pgTable("service_status", {
  id: uuid("id").primaryKey().defaultRandom(),
  appInstanceId: uuid("app_instance_id")
    .notNull()
    .references(() => appInstances.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull(),
  responseMs: integer("response_ms"),
  httpCode: integer("http_code"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
  details: jsonb("details").$type<Record<string, unknown>>(),
});

export const serviceStatusRelations = relations(serviceStatus, ({ one }) => ({
  appInstance: one(appInstances, {
    fields: [serviceStatus.appInstanceId],
    references: [appInstances.id],
  }),
}));

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  userId: uuid("user_id").references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: uuid("entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// ─── Activity Logs ───────────────────────────────────────────────────────────

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id").references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activity_logs_org_created_idx").on(table.orgId, table.createdAt),
    index("activity_logs_org_action_idx").on(table.orgId, table.action),
  ],
);

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [activityLogs.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

// ─── API Providers ───────────────────────────────────────────────────────────

export const apiProviders = pgTable("api_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }),
  costPer1kInput: real("cost_per_1k_input").default(0),
  costPer1kOutput: real("cost_per_1k_output").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const apiProvidersRelations = relations(apiProviders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [apiProviders.orgId],
    references: [organizations.id],
  }),
  costLogs: many(apiCostLogs),
}));

// ─── API Cost Logs ───────────────────────────────────────────────────────────

export const apiCostLogs = pgTable(
  "api_cost_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => apiProviders.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    tokens: integer("tokens").notNull(),
    cost: real("cost").notNull(),
    endpoint: varchar("endpoint", { length: 200 }),
    userId: uuid("user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("api_cost_logs_org_created_idx").on(table.orgId, table.createdAt),
  ],
);

export const apiCostLogsRelations = relations(apiCostLogs, ({ one }) => ({
  provider: one(apiProviders, {
    fields: [apiCostLogs.providerId],
    references: [apiProviders.id],
  }),
  organization: one(organizations, {
    fields: [apiCostLogs.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [apiCostLogs.userId],
    references: [users.id],
  }),
}));

// ─── Refresh Tokens ──────────────────────────────────────────────────────────

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));
