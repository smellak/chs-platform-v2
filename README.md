<p align="center">
  <img src="apps/platform/public/logo.svg" width="200" alt="CHS Platform" />
</p>

<h1 align="center">CHS Platform v2</h1>

<p align="center">
  Plataforma de gestión de aplicaciones internas con identidad unificada,<br/>
  control de acceso, y orquestación de agentes de IA.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/next.js-15-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/typescript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/AI-Claude-blueviolet" alt="AI" />
</p>

---

## Qué es CHS Platform

CHS Platform es el portal central donde una empresa gestiona todas sus aplicaciones internas. Los usuarios se loguean una vez y acceden a cualquier app sin segundo login. Un agente de IA central orquesta agentes especializados de cada app, respetando los permisos del usuario.

**Lo que hace CHS Platform:**

- **SSO automático** — Registra una app, asigna permisos, y el SSO funciona via ForwardAuth de Traefik. Sin tocar YAML.
- **Agente IA orquestador** — Un agente central que delega a agentes de cada app según los permisos del usuario.
- **Permisos granulares** — Departamentos, roles, y niveles de acceso (full/readonly) para cada app.
- **Auto-configuración de Traefik** — ForwardAuth generado automáticamente desde la UI de admin.
- **SDKs para desarrolladores** — Integra tu app con `@chs-platform/sdk` en pocas líneas de código.

## Quick Start

```bash
git clone https://github.com/smellak/chs-platform-v2.git
cd chs-platform-v2/docker
cp .env.example .env
docker compose up -d
```

Abre http://localhost:3000 — Login: **admin / admin123**

> Cambia `JWT_SECRET` y `POSTGRES_PASSWORD` en `.env` antes de usar en producción.

## Arquitectura

```
                       Internet
                          |
                      Traefik Proxy
                          |
           +--------------+--------------+
           |              |              |
   chs.empresa.com  app1.empresa.com  app2.empresa.com
           |              |              |
     CHS Platform   ForwardAuth +   ForwardAuth +
     (login, admin)    App 1 backend   App 2 backend
           |              |
      Set-Cookie:    Headers X-CHS-*
      chs_token    (inyectados por Traefik)
           |
      Agente Central IA
           |
      +----+----+
      |         |
    Agente    Agente
    App 1     App 2
```

**Flujo de autenticación:**

1. Usuario accede a `app1.empresa.com`
2. Traefik envía request a CHS Platform `/api/auth/verify-access`
3. CHS Platform verifica la cookie JWT y los permisos del usuario para esa app
4. Si es válido, devuelve headers `X-CHS-*` que Traefik inyecta en la request a la app
5. La app lee los headers para identificar al usuario — sin necesidad de manejar autenticación propia

## Stack

| Componente | Tecnología |
|------------|-----------|
| Frontend | Next.js 15 (App Router) |
| Backend | Next.js Route Handlers + Server Actions |
| Base de datos | PostgreSQL 16 + Drizzle ORM |
| UI | Tailwind CSS + Radix UI (shadcn/ui) |
| IA | Anthropic Claude + Vercel AI SDK |
| Proxy | Traefik v3 (ForwardAuth) |
| Monorepo | Turborepo |
| Testing | Playwright |
| Contenedor | Docker (multi-stage, non-root) |

## Estructura del proyecto

```
chs-platform-v2/
├── apps/
│   ├── platform/       # Next.js — la plataforma principal
│   ├── docs/           # Documentación (Nextra)
│   └── cli/            # CLI de instalación
├── packages/
│   ├── db/             # Schema Drizzle + migraciones + seed
│   ├── auth/           # JWT + bcrypt + cookies
│   ├── sdk/            # SDK para integrar apps externas
│   ├── agent-sdk/      # SDK para crear agentes IA
│   ├── ui/             # Componentes compartidos
│   └── config/         # Configs compartidas (TS, ESLint)
├── templates/
│   └── agent-example/  # Template para crear agentes
├── tests/              # Tests Playwright (Fases 0-4)
└── docker/
    ├── Dockerfile
    ├── docker-compose.yml
    └── entrypoint.sh
```

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | Sí | URL de conexión PostgreSQL |
| `JWT_SECRET` | Sí | Secreto para firmar JWT (mín 64 chars) |
| `DOMAIN` | No | Dominio para cookies cross-domain |
| `ORG_NAME` | No | Nombre de la organización |
| `ANTHROPIC_API_KEY` | No | API key para agente IA (Claude) |
| `AI_MODEL` | No | Modelo de IA (default: claude-sonnet-4-20250514) |
| `AI_MAX_TOKENS` | No | Tokens máximos por respuesta (default: 4096) |
| `AI_RATE_LIMIT_MESSAGES_PER_HOUR` | No | Límite de mensajes/hora por usuario (default: 50) |
| `AI_RATE_LIMIT_TOKENS_PER_DAY` | No | Límite de tokens/día por usuario (default: 100000) |

## Integrar tu app

```bash
npm install @chs-platform/sdk
```

**Express:**
```typescript
import { chsMiddleware, requireCHS } from "@chs-platform/sdk/express";

app.use(chsMiddleware());     // Parsea headers X-CHS-*
app.use(requireCHS());        // Rechaza requests sin autenticación

app.get("/api/data", (req, res) => {
  const user = req.chs;       // { id, name, email, role, ... }
  res.json({ message: `Hola ${user.name}` });
});
```

**Next.js:**
```typescript
import { getCHSUser } from "@chs-platform/sdk/next";

export async function GET(request: Request) {
  const user = getCHSUser(request);
  if (!user) return Response.json({ error: "No auth" }, { status: 401 });
  return Response.json({ user });
}
```

## Crear un agente IA

```typescript
import { CHSAgent } from "@chs-platform/agent-sdk";

const agent = new CHSAgent({
  name: "Mi Agente",
  description: "Agente de ejemplo",
  capabilities: [{
    name: "saludar",
    description: "Saluda al usuario",
    requiredPermission: "read",
    parameters: {}
  }],
  handler: async ({ capability, parameters, user }) => {
    return { text: `¡Hola ${user.name}!` };
  }
});

// Express
app.post("/api/agent", agent.middleware());

// Next.js Route Handler
export async function POST(req: Request) {
  return agent.routeHandler(req);
}
```

Ver `templates/agent-example/` para un ejemplo completo.

## Documentación

```bash
cd apps/docs && npm install && npm run dev
# → http://localhost:3001
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Base de datos
cd docker && docker compose up -d db
cd .. && npm run db:migrate && npm run db:seed

# Desarrollo
npm run dev
# → http://localhost:3000

# Tests
npx playwright test

# Type check
npm run type-check
```

## Licencia

MIT — ver [LICENSE](LICENSE)
