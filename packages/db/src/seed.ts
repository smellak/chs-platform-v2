import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import bcryptjs from "bcryptjs";
import * as schema from "./schema/index.js";

async function seed(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  // Organization from environment or defaults
  const orgName = process.env["ORG_NAME"] ?? "Centro Hogar Sánchez";
  const orgSlug = process.env["ORG_SLUG"] ?? "chs";
  const orgDomain = process.env["ORG_DOMAIN"] ?? ".centrohogarsanchez.es";

  // Check if org already exists (idempotent)
  const existingOrgs = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, orgSlug));

  if (existingOrgs.length > 0) {
    process.stdout.write("Seed data already exists, skipping.\n");
    await pool.end();
    return;
  }

  process.stdout.write("Seeding database...\n");

  // ─── Organization ───────────────────────────────────────────────────────────
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: orgName,
      slug: orgSlug,
      domain: orgDomain,
      settings: {},
    })
    .returning();

  if (!org) throw new Error("Failed to create organization");
  const orgId = org.id;

  // ─── Departments ────────────────────────────────────────────────────────────
  const departmentData = [
    { name: "Compras", slug: "compras", icon: "ShoppingCart", color: "#0891B2" },
    { name: "Ventas", slug: "ventas", icon: "TrendingUp", color: "#16A34A" },
    { name: "Logística y Almacén", slug: "logistica-almacen", icon: "Truck", color: "#DC2626" },
    { name: "Marketplace", slug: "marketplace", icon: "Store", color: "#7C3AED" },
    { name: "Marketing", slug: "marketing", icon: "Megaphone", color: "#DB2777" },
    { name: "Contenido", slug: "contenido", icon: "PenTool", color: "#9333EA" },
    { name: "E-commerce", slug: "ecommerce", icon: "Globe", color: "#2563EB" },
    { name: "IT", slug: "it", icon: "Monitor", color: "#4F46E5" },
  ] as const;

  const departments = await db
    .insert(schema.departments)
    .values(departmentData.map((d) => ({ ...d, orgId })))
    .returning();

  const deptMap = new Map(departments.map((d) => [d.slug, d]));

  // ─── Roles ──────────────────────────────────────────────────────────────────
  const roleData = [
    {
      name: "Super Admin",
      slug: "super-admin",
      description: "Full platform access with all permissions",
      permissions: {
        "apps.read": true,
        "apps.manage": true,
        "users.read": true,
        "users.manage": true,
        "departments.manage": true,
        "roles.manage": true,
        "audit.read": true,
        "settings.manage": true,
      },
      isSystem: true,
    },
    {
      name: "Dept Admin",
      slug: "dept-admin",
      description: "Department administration with user and app management",
      permissions: {
        "apps.read": true,
        "apps.manage": true,
        "users.read": true,
        "users.manage": true,
      },
      isSystem: true,
    },
    {
      name: "User",
      slug: "user",
      description: "Standard user with app access",
      permissions: {
        "apps.read": true,
        "apps.use": true,
      },
      isSystem: true,
    },
    {
      name: "Viewer",
      slug: "viewer",
      description: "Read-only access to apps",
      permissions: {
        "apps.read": true,
      },
      isSystem: true,
    },
  ] as const;

  const rolesResult = await db
    .insert(schema.roles)
    .values(roleData.map((r) => ({ ...r, orgId })))
    .returning();

  const roleMap = new Map(rolesResult.map((r) => [r.slug, r]));

  // ─── Users ──────────────────────────────────────────────────────────────────
  const passwordHash = bcryptjs.hashSync("admin123", 10);

  const usersData = [
    {
      username: "admin",
      email: "admin@centrohogar.es",
      firstName: "Admin",
      lastName: "Principal",
      isSuperAdmin: true,
    },
    {
      username: "carlos.martinez",
      email: "carlos@centrohogar.es",
      firstName: "Carlos",
      lastName: "Martínez",
      isSuperAdmin: false,
    },
    {
      username: "ana.rodriguez",
      email: "ana@centrohogar.es",
      firstName: "Ana",
      lastName: "Rodríguez",
      isSuperAdmin: false,
    },
  ] as const;

  const usersResult = await db
    .insert(schema.users)
    .values(
      usersData.map((u) => ({
        ...u,
        orgId,
        passwordHash,
        isActive: true,
      })),
    )
    .returning();

  const userMap = new Map(usersResult.map((u) => [u.username, u]));

  // ─── User Department Roles ──────────────────────────────────────────────────
  const adminUser = userMap.get("admin");
  const carlosUser = userMap.get("carlos.martinez");
  const anaUser = userMap.get("ana.rodriguez");
  const itDept = deptMap.get("it");
  const logisticaDept = deptMap.get("logistica-almacen");
  const comprasDept = deptMap.get("compras");
  const superAdminRole = roleMap.get("super-admin");
  const userRole = roleMap.get("user");
  const viewerRole = roleMap.get("viewer");

  if (!adminUser || !carlosUser || !anaUser) throw new Error("Failed to create users");
  if (!itDept || !logisticaDept || !comprasDept) throw new Error("Failed to create departments");
  if (!superAdminRole || !userRole || !viewerRole) throw new Error("Failed to create roles");

  await db.insert(schema.userDepartmentRoles).values([
    { userId: adminUser.id, departmentId: itDept.id, roleId: superAdminRole.id },
    { userId: carlosUser.id, departmentId: logisticaDept.id, roleId: userRole.id },
    { userId: anaUser.id, departmentId: comprasDept.id, roleId: viewerRole.id },
  ]);

  // ─── Apps ───────────────────────────────────────────────────────────────────
  const [citasApp] = await db
    .insert(schema.apps)
    .values([
      {
        orgId,
        name: "Citas Almacén",
        slug: "citas-almacen",
        description: "Sistema de gestión de citas para el almacén",
        icon: "CalendarDays",
        color: "#EA580C",
        category: "Logística",
        version: "1.0",
      },
      {
        orgId,
        name: "Route Optimizer",
        slug: "route-optimizer",
        description: "Optimización de rutas de reparto",
        icon: "MapPin",
        color: "#059669",
        category: "Logística",
        version: "1.0",
      },
    ])
    .returning();

  if (!citasApp) throw new Error("Failed to create apps");

  // Get route-optimizer app
  const allApps = await db
    .select()
    .from(schema.apps)
    .where(eq(schema.apps.orgId, orgId));
  const routeApp = allApps.find((a) => a.slug === "route-optimizer");
  if (!routeApp) throw new Error("Failed to find route-optimizer app");

  // ─── App Instances ──────────────────────────────────────────────────────────
  await db.insert(schema.appInstances).values({
    appId: citasApp.id,
    internalUrl: "http://elias:5000",
    externalDomain: "citas.centrohogarsanchez.es",
    healthEndpoint: "/api/health",
    publicPaths: ["/api/health", "/chat", "/api/chat", "/api/appointments/confirm", "/docs"],
    status: "unknown",
  });

  // ─── App Access Policies ────────────────────────────────────────────────────
  await db.insert(schema.appAccessPolicies).values([
    { appId: citasApp.id, departmentId: logisticaDept.id, accessLevel: "full" },
    { appId: citasApp.id, departmentId: itDept.id, accessLevel: "full" },
    { appId: citasApp.id, departmentId: comprasDept.id, accessLevel: "readonly" },
    { appId: routeApp.id, departmentId: logisticaDept.id, accessLevel: "full" },
    { appId: routeApp.id, departmentId: itDept.id, accessLevel: "full" },
  ]);

  // ─── App Agent ──────────────────────────────────────────────────────────────
  await db.insert(schema.appAgents).values({
    appId: citasApp.id,
    name: "Elias",
    description: "Agente de gestión de citas del almacén",
    endpoint: "/api/agent",
    capabilities: [
      {
        name: "consultar_citas",
        description: "Consultar citas existentes",
        requiredPermission: "read",
        parameters: {},
      },
      {
        name: "crear_cita",
        description: "Crear una nueva cita",
        requiredPermission: "write",
        parameters: {},
      },
      {
        name: "ver_calendario",
        description: "Ver el calendario de citas",
        requiredPermission: "read",
        parameters: {},
      },
    ],
    isActive: true,
  });

  // ─── API Providers ──────────────────────────────────────────────────────────
  const providersInserted = await db.insert(schema.apiProviders).values([
    {
      orgId,
      name: "Anthropic",
      slug: "anthropic",
      providerType: "anthropic",
      model: "claude-sonnet-4-20250514",
      isActive: true,
    },
    {
      orgId,
      name: "OpenAI",
      slug: "openai",
      providerType: "openai",
      model: "gpt-4o",
      isActive: true,
    },
    {
      orgId,
      name: "Google AI",
      slug: "google-ai",
      providerType: "google",
      model: "gemini-2.0-flash",
      isActive: true,
    },
  ]).returning();

  const providerMap = new Map(providersInserted.map((p) => [p.slug, p]));
  const anthropicProvider = providerMap.get("anthropic");
  const openaiProvider = providerMap.get("openai");
  const googleProvider = providerMap.get("google-ai");

  // ─── AI Models ────────────────────────────────────────────────────────────
  if (anthropicProvider && openaiProvider && googleProvider) {
    await db.insert(schema.aiModels).values([
      {
        providerId: anthropicProvider.id,
        orgId,
        modelId: "claude-sonnet-4-20250514",
        displayName: "Claude Sonnet 4",
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
        maxTokens: 8192,
        isActive: true,
        isDefault: true,
      },
      {
        providerId: anthropicProvider.id,
        orgId,
        modelId: "claude-haiku-3-5-20241022",
        displayName: "Claude Haiku 3.5",
        costPer1kInput: 0.0008,
        costPer1kOutput: 0.004,
        maxTokens: 8192,
        isActive: true,
        isDefault: false,
      },
      {
        providerId: openaiProvider.id,
        orgId,
        modelId: "gpt-4o",
        displayName: "GPT-4o",
        costPer1kInput: 0.0025,
        costPer1kOutput: 0.01,
        maxTokens: 4096,
        isActive: true,
        isDefault: false,
      },
      {
        providerId: googleProvider.id,
        orgId,
        modelId: "gemini-2.0-flash",
        displayName: "Gemini 2.0 Flash",
        costPer1kInput: 0.0001,
        costPer1kOutput: 0.0004,
        maxTokens: 8192,
        isActive: true,
        isDefault: false,
      },
    ]);
  }

  process.stdout.write("Seed completed successfully.\n");
  await pool.end();
}

seed().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Seed failed: ${message}\n`);
  process.exit(1);
});
