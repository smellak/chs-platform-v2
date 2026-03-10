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
| AI | Anthropic Claude via `@ai-sdk/anthropic` + Vercel AI SDK v6 |
| Auth | JWT (HS256, 15min access + 7d refresh) + bcryptjs |
| Build | Turborepo monorepo orchestration |
| Testing | Playwright (146 E2E tests across 8 spec files) |
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
| `api_providers` | External API configurations (Anthropic, Google, OpenAI) |
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
X-CHS-Role, X-CHS-Dept, X-CHS-Org-Id, X-CHS-Org-Name,
X-CHS-Org-Slug, X-CHS-Access-Level, X-CHS-Authenticated,
X-CHS-Token-Issued, X-CHS-Token-Expires
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
| Route Optimizer | Yes (JWT) | **No** — shows own login form | **Needs SSO integration** |
| Sistema AON | No | N/A — no auth needed | Working |
| Arana de Precios | No | N/A — no auth needed | Working |
| Portal Proveedores | Yes (JWT) | Yes — calls `/api/proveedores/auth/sso` | Working |

See `docs/SSO-DOUBLE-LOGIN-AUDIT.md` for full details and recommended fix for Route Optimizer.

---

## Docker & Deployment

### Production Build

```bash
cd /home/aleph/chs-platform-v2
sudo docker compose -f docker/docker-compose.prod.yml --env-file .env.prod up -d --build platform
```

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

**Important:** Coolify containers have dynamic name suffixes that change on redeploy (e.g., `pgk444cc088o0w40ssc8wkcw-144414962348`). The prefix (Coolify service ID) is stable. Use `docker ps` to find current names. The `proveedores-api` container has a stable DNS alias.

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
| `ANTHROPIC_API_KEY` | — | Claude API key |
| `AI_MODEL` | `claude-sonnet-4-20250514` | Default AI model |
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

**Total: 146 test cases across 8 files.**

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
- Streaming responses via Vercel AI SDK
- Conversation history with persistence
- Tool call auditing
- Per-agent permission model
- Multi-provider support (Anthropic, Google, OpenAI)
- Rate limiting and cost tracking

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
7. **Double login audit** — Identified Route Optimizer as only app needing SSO fix

---

## Known Issues

1. **Route Optimizer double login** — The only app that shows its own login form after ForwardAuth. Needs `/api/auth/sso` endpoint implementation. See `docs/SSO-DOUBLE-LOGIN-AUDIT.md` for recommended fix.

2. **Coolify container name instability** — Container suffixes change on every Coolify redeploy. The `internal_url` in the `app_instances` DB table must be updated manually after redeploys. Consider implementing a health-check based auto-discovery.

3. **Hairpin NAT** — Some domains (`arana`, `proveedores`) resolve to the public IP `94.130.248.102`, which causes connection failures when testing from the server itself. Use `curl --resolve "domain:443:127.0.0.1"` for local testing. External users are unaffected.

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

# Production
sudo docker compose -f docker/docker-compose.prod.yml --env-file .env.prod up -d --build platform
sudo docker compose -f docker/docker-compose.prod.yml --env-file .env.prod logs -f platform

# Traefik configs (on server)
ls /data/coolify/proxy/dynamic/chs-v2-*.yaml
ls /data/coolify/proxy/dynamic/proveedores-chs-auth.yaml

# Container inspection
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "chs|route|aon|arana|proveedores|elias"
sudo docker exec chs-platform node -e "const h=require('http'); ..."  # No curl in container

# Database access
sudo docker exec -it chs-db psql -U postgres -d chs_platform
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
