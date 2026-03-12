# CLAUDE.md — CHS Platform v2

Reference document for AI agents and developers working on this codebase.

---

## Project Overview

**CHS Platform v2** is the internal management platform for **Centro Hogar Sanchez**, a Spanish home goods company. It serves as a centralized authentication gateway, app launcher, AI agent orchestrator, and monitoring dashboard for all internal tools.

- **Repo:** `smellak/chs-platform-v2` (private)
- **Production URL:** `https://platform.centrohogarsanchez.es`
- **Server:** Hetzner VPS at `94.130.248.102` (Ubuntu, Docker)
- **Managed by:** Coolify (self-hosted PaaS) at `coolify.centrohogarsanchez.es`

---

## Architecture

```
Monorepo (npm workspaces + Turborepo)
├── apps/
│   ├── platform/     # Main Next.js 16 app (App Router)
│   ├── cli/          # create-chs CLI installer
│   └── docs/         # Documentation site (Next.js + MDX)
└── packages/
    ├── auth/         # JWT + bcryptjs auth utilities
    ├── db/           # Drizzle ORM schema + migrations (PostgreSQL 16)
    ├── sdk/          # Client SDK for app integration (@chs-platform/sdk)
    ├── agent-sdk/    # SDK for creating AI agents (@chs-platform/agent-sdk)
    ├── config/       # Shared TypeScript configs
    └── ui/           # Shared UI components (placeholder)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, `"use client"` / RSC) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 16 + Drizzle ORM |
| UI | Tailwind CSS 4 + Radix UI + shadcn/ui + Lucide icons |
| AI | Google Gemini 3 Flash via `@ai-sdk/google` + Vercel AI SDK v6 (Anthropic as fallback) |
| Auth | JWT (HS256, 15min access + 7d refresh) + bcryptjs |
| Build | Turborepo monorepo orchestration |
| Testing | Playwright (193 E2E tests across 10 spec files) |
| Deployment | Docker multi-stage build, non-root user |
| Reverse Proxy | Traefik v2 (via Coolify) |
| CI/CD | Manual Docker builds on server |

---

## Database Schema

**Location:** `packages/db/src/schema/index.ts` (804 lines, 40+ tables)

### Core Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Single-tenant org (Centro Hogar Sanchez) |
| `users` | User accounts with hashed passwords |
| `departments` | Company departments (Almacen, Ventas, Gerencia, etc.) |
| `roles` | Role definitions (admin, manager, employee, viewer) |
| `user_department_roles` | Many-to-many user ↔ department ↔ role |

### App Management

| Table | Purpose |
|-------|---------|
| `apps` | Registered application definitions |
| `app_instances` | Deployed instances with `internal_url`, `external_domain`, `health_endpoint` |
| `app_access_policies` | Granular access: department + role → app + access level |
| `service_status` | Health check results (updated every 60s) |

### AI System

| Table | Purpose |
|-------|---------|
| `app_agents` | AI agent definitions per app |
| `agent_conversations` | Chat sessions |
| `agent_messages` | Message history |
| `agent_tool_calls` | Tool usage audit log |
| `agent_permissions` | What tools each agent can use |
| `api_providers` | External API configurations (Google AI active, Anthropic inactive as fallback) |
| `ai_models` | Model configurations |
| `app_model_assignments` | Which model each app uses |
| `api_cost_logs` | Token usage and cost tracking |
| `ai_alert_rules` + `ai_alerts` | Monitoring rules and alert instances |

### Auth & Audit

| Table | Purpose |
|-------|---------|
| `refresh_tokens` | Session refresh tokens (7-day expiry) |
| `api_keys` | API credentials for external apps |
| `activity_logs` | Full audit trail of user actions |
| `notifications` | User notification system |
| `webhooks` | Event subscription system |

### Running Migrations

```bash
npm run db:generate    # Generate migration from schema changes
npm run db:migrate     # Apply pending migrations
npm run db:seed        # Seed initial data
```

---

## API Routes

All routes under `apps/platform/src/app/api/`:

```
/api/
├── auth/
│   ├── login/          POST - Username/password → JWT + refresh token
│   ├── logout/         POST - Clear tokens
│   ├── me/             GET  - Current user info
│   ├── refresh/        POST - Refresh access token
│   ├── sso-info/       GET  - SSO debug information
│   └── verify-access/  GET  - ForwardAuth endpoint (Traefik calls this)
├── apps/
│   └── [id]/
│       └── traefik-preview/  GET - Preview Traefik config for an app
├── agent/
│   ├── chat/           POST - AI agent chat endpoint (streaming)
│   └── conversations/
│       └── [id]/       GET/DELETE - Conversation management
├── admin/
│   └── ai-export/      GET - Export AI data
├── monitor/
│   ├── overview/       GET - System overview metrics
│   ├── services/       GET - Service health status
│   └── activity/       GET - Recent activity
├── health/             GET - Platform health check
├── activity-logs/      GET - Activity log retrieval
├── api-keys/           GET/POST - API key management
└── search/             GET - Global search
```

### Key Endpoint: `/api/auth/verify-access`

This is the **ForwardAuth endpoint** that Traefik calls for every request to protected subdomains. It:

1. Reads the `chs_access_token` cookie from the request
2. Verifies the JWT
3. Looks up the user, their roles, and the target app
4. Resolves the app by `?app=<slug>` parameter or `X-Forwarded-Host` header matching `app_instances.external_domain`
5. Super admins get full access to all apps
6. Regular users are checked against `app_access_policies` (department + role match)
7. On success: returns 200 with `X-CHS-*` response headers
8. On failure: returns 401/403

**Response Headers Injected by ForwardAuth:**
```
X-CHS-User-Id, X-CHS-User-Name, X-CHS-User-Email,
X-CHS-Role, X-CHS-Dept, X-CHS-Dept-Id, X-CHS-Org-Id, X-CHS-Org-Name,
X-CHS-Access-Level, X-CHS-Permissions, X-CHS-Authenticated,
X-CHS-User-Dept, X-CHS-User-Role
```

---

## Authentication Flow

### Login
1. User submits credentials to `POST /api/auth/login`
2. Server verifies bcrypt hash, generates JWT (15min) + refresh token (7d)
3. Sets `chs_access_token` cookie (httpOnly, secure, sameSite=lax, domain=`.centrohogarsanchez.es`)
4. Sets `chs_refresh_token` cookie (httpOnly, strict, sameSite, path=/api/auth)

### Cookie Domain
The cookie is set on `.centrohogarsanchez.es` — this enables cross-subdomain SSO for all apps.

### Token Refresh
Access tokens expire every 15 minutes. The client calls `POST /api/auth/refresh` with the refresh token cookie to get a new access token.

---

## SSO / ForwardAuth System

### How It Works

```
User → rutas.centrohogarsanchez.es
  → Traefik receives request
  → Traefik calls /api/auth/verify-access on chs-platform:3000
  → If valid: injects X-CHS-* headers, forwards to app container
  → If invalid: returns 401 (user redirected to platform login)
```

### Traefik Configuration

ForwardAuth middleware is defined once in `/data/coolify/proxy/dynamic/chs-v2-citas-auth.yaml` and reused by all domain configs:

```yaml
http:
  middlewares:
    chs-v2-forward-auth:
      forwardAuth:
        address: "http://chs-platform:3000/api/auth/verify-access"
        authResponseHeaders:
          - X-CHS-User-Id
          - X-CHS-User-Name
          # ... (12 headers total)
```

### Protected Domains

| Domain | App | Config File |
|--------|-----|-------------|
| `citas.centrohogarsanchez.es` | Citas Almacen (Elias) | `chs-v2-citas-auth.yaml` |
| `rutas.centrohogarsanchez.es` | Route Optimizer | `chs-v2-rutas-auth.yaml` |
| `aon.centrohogarsanchez.es` | Sistema AON | `chs-v2-aon-auth.yaml` |
| `arana.centrohogarsanchez.es` | Arana de Precios | `chs-v2-arana-auth.yaml` |
| `proveedores.centrohogarsanchez.es` | Portal Proveedores | `proveedores-chs-auth.yaml` |

All Traefik file configs are at `/data/coolify/proxy/dynamic/` on the production server.

### SSO Behavior Per App

| App | Has Own Auth? | SSO Auto-Login? | Status |
|-----|--------------|----------------|--------|
| Citas Almacen | Yes (JWT) | Yes — calls `/api/auth/sso` | Working |
| Route Optimizer | Yes (JWT, 24h) | Yes — calls `/api/auth/sso`, stores token in localStorage | Working |
| Sistema AON | Yes (iron-session, 7d) | Yes — calls `/api/auth/sso`, creates session cookie | Working |
| Arana de Precios | No | N/A — protected by ForwardAuth only | Working |
| Portal Proveedores | Yes (JWT) | Yes — calls `/api/proveedores/auth/sso` | Working |

**SSO Flow for Route Optimizer & AON:**
1. User accesses app subdomain (e.g., `rutas.centrohogarsanchez.es`)
2. Traefik ForwardAuth validates `chs_access_token` cookie, injects `X-CHS-*` headers
3. App login page calls `GET /api/auth/sso` on page load
4. SSO endpoint reads `X-CHS-User-Id` and `X-CHS-User-Name` headers
5. Creates/syncs local user, issues app-specific token (JWT or session)
6. Frontend stores token and redirects to dashboard — no login form shown

**SSO User Sync:**
- Username derived from `X-CHS-User-Name` header (lowercased, spaces → dots)
- Role mapped: `super-admin`, `dept-admin` → app admin; others → operator/viewer
- Users created on first SSO login with random password (never used)

---

## Docker & Deployment

### Production Build

```bash
cd /home/chs-dev/chs-platform-v2
sudo docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d --build platform
```

### Container URL Update After Coolify Redeploys

When Coolify redeploys a container, the container name suffix changes, breaking Traefik ForwardAuth configs and DB `internal_url` references. Run:

```bash
sudo ./scripts/update-container-urls.sh
```

This updates both the Traefik YAML configs and the `app_instances.internal_url` in the DB.

### Docker Compose Services

- **platform** — Next.js app on port 3000, connected to `coolify` + `chs-internal` networks
- **chs-db** — PostgreSQL 16-alpine with health checks, data persisted in `chs_postgres_data` volume

### Dockerfile

Multi-stage build:
1. **deps** — Install npm dependencies
2. **builder** — `npx next build` (standalone output)
3. **runner** — Node 20-alpine, non-root user `chs:1001`, copies standalone output + packages for runtime

### Container Networking

```
┌─────────────────────────────────────────────────────────┐
│  coolify network (external)                              │
│                                                          │
│  Traefik ←→ chs-platform ←→ chs-db                     │
│     │                                                    │
│     ├→ route-optimizer-phase6:8000                       │
│     ├→ [Coolify containers for AON, Arana, Citas]       │
│     └→ proveedores-api:3010                              │
└─────────────────────────────────────────────────────────┘
```

**Important:** Coolify containers have dynamic name suffixes that change on redeploy. The prefix (Coolify service ID) is stable. Use `docker ps` to find current names. After a Coolify redeploy, run `sudo ./scripts/update-container-urls.sh` to update Traefik configs and DB URLs.

**Current Coolify Service ID Prefixes (March 2026):**

| App | Prefix | Stable Name? | Port |
|-----|--------|-------------|------|
| CHS Platform | `chs-platform` | Yes (docker-compose) | 3000 |
| CHS DB | `chs-db` | Yes (docker-compose) | 5432 |
| Route Optimizer | `route-optimizer-phase6` | Yes (manual) | 8000 |
| Proveedores API | `proveedores-api` | Yes (DNS alias) | 3010 |
| Araña de Precios | `a00g4os8ogg8skgk0oowk8c8` | No (Coolify) | 3000 |
| Sistema AON | `ms84cwosc0occ488ggccg8g8` | No (Coolify) | 3000 |
| Citas Almacén | `cogk4c4s8kgsk4k4s00wskss` | No (Coolify) | 5000 |

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (min 64 chars) |

### Optional (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | — | Cookie domain (e.g., `.centrohogarsanchez.es`) |
| `ORG_NAME` | — | Organization display name |
| `ORG_SLUG` | — | URL-safe org identifier |
| `ORG_DOMAIN` | — | Primary org domain |
| `NODE_ENV` | `development` | Environment |
| `GOOGLE_GENERATIVE_AI_API_KEY` | — | Google AI API key (primary) |
| `ANTHROPIC_API_KEY` | — | Anthropic API key (fallback) |
| `AI_MODEL` | `gemini-3-flash-preview` | Default AI model |
| `AI_MAX_TOKENS` | `4096` | Max tokens per response |
| `AI_RATE_LIMIT_MESSAGES_PER_HOUR` | `50` | Rate limit |
| `AI_RATE_LIMIT_TOKENS_PER_DAY` | `100000` | Daily token limit |
| `ENCRYPTION_KEY` | — | For encrypting sensitive data |
| `PORT` | `3000` | Server port |

---

## Testing

### Setup

```bash
npx playwright install --with-deps chromium
```

### Run Tests

```bash
npx playwright test                           # All tests
npx playwright test tests/fase1.spec.ts       # Specific file
npx playwright test --headed                  # With browser visible
```

### Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `fase0.spec.ts` | Foundation | Login, navigation, basic UI |
| `fase1.spec.ts` | Phase 1 | Dashboard, apps, departments, roles |
| `fase2.spec.ts` | Phase 2 | App instances, access policies |
| `fase3.spec.ts` | Phase 3 | API providers, AI models |
| `fase4.spec.ts` | Phase 4 | Agent config, conversations |
| `ai-governance.spec.ts` | AI | Governance features, alerts, costs |
| `app-integration.spec.ts` | Integration | App health, Traefik preview |
| `intro-video.spec.ts` | Video | Login intro video, skip button, cookie |
| `agent-system.spec.ts` | Agent | Provider config, live browser chat, tool use, cost logging |
| `data-integrity.spec.ts` | Data | Department/role counters, sessions, providers, app health |

**Total: 193 test cases across 10 files.**

### Playwright Config

- Base URL: `https://platform.centrohogarsanchez.es`
- Browser: Chromium only
- Auth state stored in `tests/.auth/user.json`
- Global setup performs login and saves auth state

---

## Frontend Features

### Login Page
- Intro video on first visit (cookie `chs_intro_seen` prevents replay for 24h)
- Particle animation background
- Username/password form with validation
- Spanish language UI

### Dashboard
- App launcher with access-controlled cards
- System overview with real-time metrics
- Health status indicators per app
- Recent activity feed

### Admin Panel
- User management (CRUD)
- Department and role management
- App registration and instance configuration
- Access policy editor (department + role → app + level)
- AI provider and model configuration
- Agent configuration with permissions
- Monitoring: API costs, alerts, activity logs
- Traefik config preview per app

### AI Agent Chat
- Streaming responses via Vercel AI SDK v6 (`DefaultChatTransport` with `parts` array)
- Google Gemini 3 Flash as primary model (Anthropic Claude as fallback)
- 3-tier model resolution: app-specific assignment → org default → env var fallback
- Conversation history with persistence in `agent_messages` table
- Tool call auditing in `agent_tool_calls` table
- Per-agent permission model (blocked apps/tools per user)
- Rate limiting (messages/hour + tokens/day) and cost tracking
- 5 active agents across all apps (see AI Agents section below)

### AI Agents

| Agent | App | Tools | Endpoint | Protocol |
|-------|-----|-------|----------|----------|
| **Elias** | Citas Almacen | consultar_citas, ver_calendario, ver_disponibilidad | `/api/agent` | CHS capability protocol |
| **OptiRoute** | Route Optimizer | consultar_pedidos, consultar_vehiculos, consultar_rutas, ver_historial | `/api/agent` | CHS capability protocol |
| **AON** | Sistema AON | consultar_polizas, ver_trabajos, ver_estadisticas | `/api/agent` | CHS capability protocol |
| **Arana** | Arana de Precios | consultar_precios, ver_alertas, ver_competidores | `/api/agent` | CHS capability protocol |
| **Proveedores** | Portal Proveedores | consultar_proveedores, ver_facturas, ver_ordenes_compra | `/api/agent` | CHS capability protocol |

**CHS Agent Protocol:** Platform sends `POST {internal_url}/api/agent` with `{"capability": "name", "parameters": {...}}`, expects `{"text": "...", "data": {...}}` response.

**Platform-level tools** (available to all agents regardless of app): `buscar_usuarios`, `ver_servicios`, `ver_actividad_reciente`, `ver_accesos_app`, `ver_costes_api`, `ver_notificaciones`, `gestionar_acceso_app` (admin), `toggle_mantenimiento_app` (admin).

---

## Packages

### @chs-platform/auth (`packages/auth`)
Core auth utilities:
- `hashPassword()` / `verifyPassword()` — bcryptjs
- `generateAccessToken()` / `verifyAccessToken()` — JWT HS256
- `generateRefreshToken()` — Crypto random hex
- Cookie config helpers for access + refresh tokens

### @chs-platform/db (`packages/db`)
- Full Drizzle ORM schema (40+ tables with relations)
- Migration system (`drizzle-kit`)
- Seed scripts
- PostgreSQL 16 connection pool

### @chs-platform/sdk (`packages/sdk`)
Client SDK for apps to integrate with CHS Platform:
- Express middleware for reading X-CHS-* headers
- Next.js helpers
- TypeScript types for all CHS header fields

### @chs-platform/agent-sdk (`packages/agent-sdk`)
SDK for creating AI agents:
- Agent definition helpers
- Tool registration
- Message formatting
- Built with tsup

---

## Project History

This platform was migrated from **CHS Platform v1** (`smellak/chsplatform`), a monolithic Express + React (Vite) app. The v2 rewrite moved to:

- Next.js App Router (from Express + Vite)
- Drizzle ORM (from raw SQL)
- Monorepo with shared packages (from monolith)
- Turborepo build system
- Full rebrand from internal codename "Aleph" to "CHS"

### Key Milestones (chronological)

1. **Initial build** — Next.js 16 monorepo with auth, dashboard, admin panel
2. **AI governance** — Agent system, permissions, cost tracking, alerts
3. **v1→v2 migration** — Data migration, schema alignment, feature parity
4. **Full rebrand** — Cookies (`chs_*`), headers (`X-CHS-*`), packages (`@chs-platform/*`), Docker services
5. **Intro video** — Login page video adapted from v1
6. **SSO ForwardAuth** — 5 domains protected via Traefik ForwardAuth
7. **Double login audit** — Identified Route Optimizer and AON as needing SSO fix
8. **AI agent audit** — Cleaned fake data, fixed tool-call logging, verified Elias endpoint
9. **Gemini migration** — Migrated from Anthropic Claude to Google Gemini 3 Flash (Anthropic kept as fallback)
10. **Chat bug fixes** — Fixed 3 critical bugs: content parsing (AI SDK v6 `parts` vs `content`), leaked API key, React tool rendering crash
11. **Security fix** — Fixed Arana ForwardAuth vulnerability (stale container ID after Coolify redeploy)
12. **SSO integration** — Eliminated double login for Route Optimizer and AON with `/api/auth/sso` endpoints
13. **AI agents for all apps** — Created agents for Route Optimizer, AON, Arana, Proveedores (5 total)

---

## Known Issues

1. **Coolify container name instability** — Container suffixes change on every Coolify redeploy. After redeploy, run `sudo ./scripts/update-container-urls.sh` to update Traefik configs and DB `internal_url` references. Affects: Arana, AON, Citas (Coolify-managed). Does NOT affect: Route Optimizer, Proveedores, CHS Platform (stable names).

2. **Hairpin NAT** — Some domains (`arana`, `proveedores`) resolve to the public IP `94.130.248.102`, which causes connection failures when testing from the server itself. Use `curl --resolve "domain:443:127.0.0.1"` for local testing. External users are unaffected.

3. **Non-admin test users** — 4 Playwright tests fail (fase0 T12, fase1 T25, fase2 T04/T05) because non-admin test users have expired tokens or missing access policies. These are test-data issues, not code bugs.

4. **docker/.env.prod not in git** — The production `.env.prod` file is in `.gitignore` to prevent leaking API keys. It must be managed directly on the server at `/home/chs-dev/chs-platform-v2/docker/.env.prod`.

---

## Useful Commands

```bash
# Development
npm run dev                    # Start all workspaces in dev mode
npm run build                  # Build all packages
npm run lint                   # Lint all packages
npm run type-check             # TypeScript checking

# Database
npm run db:generate            # Generate migration from schema changes
npm run db:migrate             # Apply migrations
npm run db:seed                # Seed data

# Testing
npx playwright test            # Run all E2E tests
npx playwright test --ui       # Interactive test runner

# Production build & deploy
sudo docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d --build platform
sudo docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod logs -f platform

# After Coolify redeploy (update stale container IDs)
sudo ./scripts/update-container-urls.sh

# Traefik configs (on server)
ls /data/coolify/proxy/dynamic/chs-v2-*.yaml
ls /data/coolify/proxy/dynamic/proveedores-chs-auth.yaml

# Container inspection
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "chs|route|aon|arana|proveedores|elias"

# Database access (user=chs, db=chs)
sudo docker exec -it chs-db psql -U chs -d chs

# Verify ForwardAuth (from server, use --resolve for hairpin NAT)
curl -sk -o /dev/null -w "HTTP %{http_code}" https://arana.centrohogarsanchez.es/ --resolve "arana.centrohogarsanchez.es:443:127.0.0.1"

# Rebuild Route Optimizer (source at /home/optirouter/proyecto/)
sudo bash -c 'cd /home/optirouter/proyecto && docker build -t route-optimizer:sso -f Dockerfile .'
sudo docker stop route-optimizer-phase6 && sudo docker rm route-optimizer-phase6
# Then docker run with all env vars (see deployment docs)

# Rebuild AON (source at /home/aon/aon-api-v2/)
sudo bash -c 'cd /home/aon/aon-api-v2 && docker build -t aon-api-v2:sso -f Dockerfile .'
# Then stop/rm/run with all env vars and labels (see deployment docs)
```

---

## Documentation

| Document | Description |
|----------|-------------|
| `docs/chs-v2-migration.md` | Full v1→v2 migration report |
| `docs/DATA-AUDIT.md` | Data integrity audit (real vs simulated data) |
| `docs/DESIGN-AUDIT.md` | UI/UX design audit with recommendations |
| `docs/SSO-FORWARDAUTH-REPORT.md` | ForwardAuth setup for 5 domains |
| `docs/SSO-DOUBLE-LOGIN-AUDIT.md` | Which apps show double login |
| `CHANGELOG.md` | Version history |
| `CONTRIBUTING.md` | Contribution guidelines |
| `README.md` | Project overview and setup |

---

## File Structure Quick Reference

```
chs-platform-v2/
├── apps/platform/
│   ├── public/video/chs-intro.mp4     # Login intro video
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/page.tsx   # Login page
│       │   ├── (dashboard)/            # Main dashboard
│       │   ├── admin/                  # Admin panel pages
│       │   └── api/                    # API routes (see above)
│       ├── components/
│       │   ├── intro-video.tsx         # Login video component
│       │   └── ui/                     # shadcn/ui components
│       └── lib/                        # Utilities
├── packages/
│   ├── auth/src/index.ts              # Auth utilities
│   ├── db/src/schema/index.ts         # Full DB schema
│   ├── sdk/src/                       # Platform SDK
│   └── agent-sdk/src/                 # Agent SDK
├── tests/                             # Playwright E2E tests
├── docker/
│   ├── docker-compose.prod.yml        # Production compose
│   ├── Dockerfile                     # Multi-stage build
│   └── entrypoint.sh                  # Container entrypoint
├── docs/                              # Project documentation
├── turbo.json                         # Turborepo config
├── playwright.config.ts               # Test config
└── package.json                       # Root monorepo config
```
