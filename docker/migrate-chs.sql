-- ============================================================================
-- CHS Platform → Aleph Platform Data Migration
-- Run against the Aleph DB (aleph-db container)
-- ============================================================================
BEGIN;

-- Get the org ID (created by seed)
DO $$
DECLARE
  v_org_id uuid;
  -- Department IDs
  v_dept_compras uuid;
  v_dept_contenido uuid;
  v_dept_direccion uuid;
  v_dept_ecommerce uuid;
  v_dept_it uuid;
  v_dept_ia uuid;
  v_dept_logistica uuid;
  v_dept_marketing uuid;
  v_dept_marketplace uuid;
  v_dept_ventas uuid;
  -- Role IDs
  v_role_super_admin uuid;
  v_role_dept_admin uuid;
  v_role_user uuid;
  v_role_viewer uuid;
  -- User IDs
  v_user_admin uuid;
  v_user_carlos uuid;
  v_user_ana uuid;
  v_user_pedro uuid;
  v_user_maria uuid;
  v_user_juan uuid;
  v_user_laura uuid;
  v_user_roberto uuid;
  v_user_sara uuid;
  -- App IDs
  v_app_citas uuid;
  v_app_route uuid;
  v_app_amazon uuid;
  v_app_medidas uuid;
  v_app_aon uuid;
  -- Password hash (all CHS users have the same bcrypt hash for admin123)
  v_password_hash text := '$2b$10$VINYZ1Wn7pu3PfCV047Xj.vsJNGzdpvyxRvjZNnpevow9Whh4Fa82';
BEGIN
  -- Get org
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'chs';
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization chs not found - run seed first';
  END IF;

  -- ─── Clear seed data (cascade handles FKs) ─────────────────────────
  DELETE FROM app_access_policies WHERE app_id IN (SELECT id FROM apps WHERE org_id = v_org_id);
  DELETE FROM app_agents WHERE app_id IN (SELECT id FROM apps WHERE org_id = v_org_id);
  DELETE FROM app_instances WHERE app_id IN (SELECT id FROM apps WHERE org_id = v_org_id);
  DELETE FROM apps WHERE org_id = v_org_id;
  DELETE FROM user_department_roles WHERE user_id IN (SELECT id FROM users WHERE org_id = v_org_id);
  DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE org_id = v_org_id);
  DELETE FROM activity_logs WHERE org_id = v_org_id;
  DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE org_id = v_org_id);
  DELETE FROM agent_conversations WHERE user_id IN (SELECT id FROM users WHERE org_id = v_org_id);
  DELETE FROM api_cost_logs WHERE user_id IN (SELECT id FROM users WHERE org_id = v_org_id);
  DELETE FROM users WHERE org_id = v_org_id;
  DELETE FROM departments WHERE org_id = v_org_id;
  DELETE FROM roles WHERE org_id = v_org_id;
  DELETE FROM api_providers WHERE org_id = v_org_id;

  -- ─── Departments (10, matching CHS) ────────────────────────────────
  INSERT INTO departments (id, org_id, name, slug, icon, color) VALUES
    (gen_random_uuid(), v_org_id, 'Compras', 'compras', 'ShoppingCart', '#0891B2')
    RETURNING id INTO v_dept_compras;
  INSERT INTO departments (id, org_id, name, slug, icon, color) VALUES
    (gen_random_uuid(), v_org_id, 'Contenido', 'contenido', 'PenTool', '#9333EA')
    RETURNING id INTO v_dept_contenido;
  INSERT INTO departments (id, org_id, name, slug, icon, color) VALUES
    (gen_random_uuid(), v_org_id, 'Dirección', 'direccion', 'Landmark', '#0F172A')
    RETURNING id INTO v_dept_direccion;
  INSERT INTO departments (id, org_id, name, slug, icon, color) VALUES
    (gen_random_uuid(), v_org_id, 'E-commerce', 'ecommerce', 'Globe', '#2563EB')
    RETURNING id INTO v_dept_ecommerce;
  INSERT INTO departments (id, org_id, name, slug, icon, color) VALUES
    (gen_random_uuid(), v_org_id, 'IT', 'it', 'Monitor', '#4F46E5')
    RETURNING id INTO v_dept_it;
  INSERT INTO departments (id, org_id, name, slug, icon, color) VALUES
    (gen_random_uuid(), v_org_id, 'Inteligencia Artificial', 'ia', 'Brain', '#F59E0B')
    RETURNING id INTO v_dept_ia;
  INSERT INTO departments (id, org_id, name, slug, icon, color) VALUES
    (gen_random_uuid(), v_org_id, 'Logística y Almacén', 'logistica-almacen', 'Truck', '#DC2626')
    RETURNING id INTO v_dept_logistica;
  INSERT INTO departments (id, org_id, name, slug, icon, color) VALUES
    (gen_random_uuid(), v_org_id, 'Marketing', 'marketing', 'Megaphone', '#DB2777')
    RETURNING id INTO v_dept_marketing;
  INSERT INTO departments (id, org_id, name, slug, icon, color) VALUES
    (gen_random_uuid(), v_org_id, 'Marketplace', 'marketplace', 'Store', '#7C3AED')
    RETURNING id INTO v_dept_marketplace;
  INSERT INTO departments (id, org_id, name, slug, icon, color) VALUES
    (gen_random_uuid(), v_org_id, 'Ventas', 'ventas', 'TrendingUp', '#16A34A')
    RETURNING id INTO v_dept_ventas;

  -- ─── Roles (4, matching CHS) ──────────────────────────────────────
  INSERT INTO roles (id, org_id, name, slug, description, permissions, is_system) VALUES
    (gen_random_uuid(), v_org_id, 'Super Admin', 'super-admin', 'Acceso total al sistema',
     '{"apps.read":true,"apps.manage":true,"users.read":true,"users.manage":true,"departments.manage":true,"roles.manage":true,"audit.read":true,"settings.manage":true}',
     true)
    RETURNING id INTO v_role_super_admin;
  INSERT INTO roles (id, org_id, name, slug, description, permissions, is_system) VALUES
    (gen_random_uuid(), v_org_id, 'Admin Departamento', 'dept-admin', 'Administrador de departamento',
     '{"apps.read":true,"apps.manage":true,"users.read":true,"users.manage":true}',
     true)
    RETURNING id INTO v_role_dept_admin;
  INSERT INTO roles (id, org_id, name, slug, description, permissions, is_system) VALUES
    (gen_random_uuid(), v_org_id, 'Usuario', 'user', 'Usuario estándar',
     '{"apps.read":true,"apps.use":true}',
     true)
    RETURNING id INTO v_role_user;
  INSERT INTO roles (id, org_id, name, slug, description, permissions, is_system) VALUES
    (gen_random_uuid(), v_org_id, 'Visor', 'viewer', 'Solo lectura',
     '{"apps.read":true}',
     true)
    RETURNING id INTO v_role_viewer;

  -- ─── Users (9, matching CHS) ──────────────────────────────────────
  INSERT INTO users (id, org_id, username, email, password_hash, first_name, last_name, is_active, is_super_admin) VALUES
    (gen_random_uuid(), v_org_id, 'admin', 'admin@centrohogar.es', v_password_hash, 'Admin', 'Sistema', true, true)
    RETURNING id INTO v_user_admin;
  INSERT INTO users (id, org_id, username, email, password_hash, first_name, last_name, is_active, is_super_admin) VALUES
    (gen_random_uuid(), v_org_id, 'carlos.martinez', 'carlos@centrohogar.es', v_password_hash, 'Carlos', 'Martínez', true, false)
    RETURNING id INTO v_user_carlos;
  INSERT INTO users (id, org_id, username, email, password_hash, first_name, last_name, is_active, is_super_admin) VALUES
    (gen_random_uuid(), v_org_id, 'ana.rodriguez', 'ana@centrohogar.es', v_password_hash, 'Ana', 'Rodríguez', true, false)
    RETURNING id INTO v_user_ana;
  INSERT INTO users (id, org_id, username, email, password_hash, first_name, last_name, is_active, is_super_admin) VALUES
    (gen_random_uuid(), v_org_id, 'pedro.sanchez', 'pedro@centrohogar.es', v_password_hash, 'Pedro', 'Sánchez', true, false)
    RETURNING id INTO v_user_pedro;
  INSERT INTO users (id, org_id, username, email, password_hash, first_name, last_name, is_active, is_super_admin) VALUES
    (gen_random_uuid(), v_org_id, 'maria.lopez', 'maria@centrohogar.es', v_password_hash, 'María', 'López', true, false)
    RETURNING id INTO v_user_maria;
  INSERT INTO users (id, org_id, username, email, password_hash, first_name, last_name, is_active, is_super_admin) VALUES
    (gen_random_uuid(), v_org_id, 'juan.garcia', 'juan@centrohogar.es', v_password_hash, 'Juan', 'García', true, false)
    RETURNING id INTO v_user_juan;
  INSERT INTO users (id, org_id, username, email, password_hash, first_name, last_name, is_active, is_super_admin) VALUES
    (gen_random_uuid(), v_org_id, 'laura.fernandez', 'laura@centrohogar.es', v_password_hash, 'Laura', 'Fernández', false, false)
    RETURNING id INTO v_user_laura;
  INSERT INTO users (id, org_id, username, email, password_hash, first_name, last_name, is_active, is_super_admin) VALUES
    (gen_random_uuid(), v_org_id, 'roberto.diaz', 'roberto@centrohogar.es', v_password_hash, 'Roberto', 'Díaz', true, false)
    RETURNING id INTO v_user_roberto;
  INSERT INTO users (id, org_id, username, email, password_hash, first_name, last_name, is_active, is_super_admin) VALUES
    (gen_random_uuid(), v_org_id, 'sara.moreno', 'sara@centrohogar.es', v_password_hash, 'Sara', 'Moreno', true, false)
    RETURNING id INTO v_user_sara;

  -- ─── User Department Roles (matching CHS) ─────────────────────────
  INSERT INTO user_department_roles (user_id, department_id, role_id) VALUES
    (v_user_admin, v_dept_it, v_role_super_admin),
    (v_user_carlos, v_dept_logistica, v_role_user),
    (v_user_ana, v_dept_marketing, v_role_user),
    (v_user_pedro, v_dept_it, v_role_dept_admin),
    (v_user_maria, v_dept_compras, v_role_user),
    (v_user_juan, v_dept_ventas, v_role_user),
    (v_user_laura, v_dept_ecommerce, v_role_user),
    (v_user_roberto, v_dept_logistica, v_role_user),
    (v_user_sara, v_dept_ia, v_role_viewer);

  -- ─── Apps (5, matching CHS) ───────────────────────────────────────
  INSERT INTO apps (id, org_id, name, slug, description, icon, color, category, version) VALUES
    (gen_random_uuid(), v_org_id, 'Citas Almacén', 'citas-almacen', 'Sistema de gestión de citas para el almacén', 'CalendarDays', '#EA580C', 'Logística', '1.0')
    RETURNING id INTO v_app_citas;
  INSERT INTO apps (id, org_id, name, slug, description, icon, color, category, version) VALUES
    (gen_random_uuid(), v_org_id, 'Route Optimizer', 'route-optimizer', 'Optimización de rutas de reparto', 'Map', '#DC2626', 'Logística', '1.0')
    RETURNING id INTO v_app_route;
  INSERT INTO apps (id, org_id, name, slug, description, icon, color, category, version) VALUES
    (gen_random_uuid(), v_org_id, 'Amazon A+ Generator', 'amazon-aplus', 'Generador de contenido A+ para Amazon', 'Palette', '#7C3AED', 'IA / Marketing', '1.0')
    RETURNING id INTO v_app_amazon;
  INSERT INTO apps (id, org_id, name, slug, description, icon, color, category, version) VALUES
    (gen_random_uuid(), v_org_id, 'Procesador de Medidas', 'medidas-excel', 'Procesador de archivos de medidas', 'Ruler', '#0891B2', 'Catálogo', '1.0')
    RETURNING id INTO v_app_medidas;
  INSERT INTO apps (id, org_id, name, slug, description, icon, color, category, version) VALUES
    (gen_random_uuid(), v_org_id, 'Sistema AON v2.0', 'aon-polizas', 'Sistema de gestión de pólizas AON', 'FileText', '#2563EB', 'Seguros', '1.0')
    RETURNING id INTO v_app_aon;

  -- ─── App Instances ────────────────────────────────────────────────
  -- Citas Almacén → Elias container (the only one that's actually running)
  INSERT INTO app_instances (app_id, internal_url, external_domain, health_endpoint, public_paths, status) VALUES
    (v_app_citas, 'http://elias:5000', 'citas.centrohogarsanchez.es', '/api/health',
     '["\/api\/health","\/chat","\/api\/chat","\/api\/appointments\/confirm","\/docs","\/assets"]',
     'healthy');

  -- Route Optimizer (placeholder, not yet deployed)
  INSERT INTO app_instances (app_id, internal_url, external_domain, health_endpoint, status) VALUES
    (v_app_route, 'http://route-optimizer:3000', NULL, '/api/health', 'unknown');

  -- Amazon A+ Generator (placeholder)
  INSERT INTO app_instances (app_id, internal_url, external_domain, health_endpoint, status) VALUES
    (v_app_amazon, 'http://amazon-aplus:3000', NULL, '/api/health', 'unknown');

  -- Procesador de Medidas (placeholder)
  INSERT INTO app_instances (app_id, internal_url, external_domain, health_endpoint, status) VALUES
    (v_app_medidas, 'http://medidas:3000', NULL, '/api/health', 'unknown');

  -- Sistema AON (placeholder)
  INSERT INTO app_instances (app_id, internal_url, external_domain, health_endpoint, status) VALUES
    (v_app_aon, 'http://aon:3000', NULL, '/api/health', 'unknown');

  -- ─── App Access Policies (21, matching CHS) ──────────────────────
  -- Citas Almacén
  INSERT INTO app_access_policies (app_id, department_id, access_level) VALUES
    (v_app_citas, v_dept_logistica, 'full'),
    (v_app_citas, v_dept_it, 'full'),
    (v_app_citas, v_dept_compras, 'readonly'),
    (v_app_citas, v_dept_ia, 'readonly');

  -- Route Optimizer
  INSERT INTO app_access_policies (app_id, department_id, access_level) VALUES
    (v_app_route, v_dept_logistica, 'full'),
    (v_app_route, v_dept_it, 'full'),
    (v_app_route, v_dept_ia, 'readonly');

  -- Amazon A+ Generator
  INSERT INTO app_access_policies (app_id, department_id, access_level) VALUES
    (v_app_amazon, v_dept_marketing, 'full'),
    (v_app_amazon, v_dept_marketplace, 'full'),
    (v_app_amazon, v_dept_contenido, 'full'),
    (v_app_amazon, v_dept_ecommerce, 'full'),
    (v_app_amazon, v_dept_it, 'full'),
    (v_app_amazon, v_dept_ia, 'full');

  -- Procesador de Medidas
  INSERT INTO app_access_policies (app_id, department_id, access_level) VALUES
    (v_app_medidas, v_dept_compras, 'full'),
    (v_app_medidas, v_dept_it, 'full'),
    (v_app_medidas, v_dept_ia, 'full'),
    (v_app_medidas, v_dept_ecommerce, 'readonly'),
    (v_app_medidas, v_dept_marketplace, 'readonly');

  -- Sistema AON v2.0
  INSERT INTO app_access_policies (app_id, department_id, access_level) VALUES
    (v_app_aon, v_dept_ventas, 'full'),
    (v_app_aon, v_dept_it, 'full'),
    (v_app_aon, v_dept_ia, 'readonly');

  -- ─── App Agent for Elias (Citas) ──────────────────────────────────
  INSERT INTO app_agents (app_id, name, description, endpoint, capabilities, is_active) VALUES
    (v_app_citas, 'Elias', 'Agente de gestión de citas del almacén', '/api/agent',
     '[{"name":"consultar_citas","description":"Consultar citas existentes","requiredPermission":"read","parameters":{}},{"name":"crear_cita","description":"Crear una nueva cita","requiredPermission":"write","parameters":{}},{"name":"ver_calendario","description":"Ver el calendario de citas","requiredPermission":"read","parameters":{}}]',
     true);

  -- ─── API Providers ────────────────────────────────────────────────
  INSERT INTO api_providers (org_id, name, slug, model, is_active) VALUES
    (v_org_id, 'Anthropic', 'anthropic', 'claude-sonnet-4-20250514', true),
    (v_org_id, 'OpenAI', 'openai', 'gpt-4o', true),
    (v_org_id, 'Google AI', 'google-ai', 'gemini-2.0-flash', true);

  RAISE NOTICE 'Migration completed: 10 departments, 4 roles, 9 users, 5 apps, 21 access policies';
END $$;

COMMIT;
