# Changelog

Todas las versiones notables de Aleph Platform se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

## [0.4.0] - 2026-03-07

### Added
- Documentación completa con Nextra (getting started, architecture, admin, developer, API reference)
- CLI `create-aleph` para setup rápido de nuevas instalaciones
- Template de agente con ejemplo de capabilities
- Logo SVG y favicon de Aleph
- README profesional con arquitectura y ejemplos
- CONTRIBUTING.md y CHANGELOG.md
- Nombre de organización configurable desde variables de entorno
- Security headers en Next.js config
- .dockerignore para builds optimizados
- 22 tests Playwright para Fase 4

## [0.3.0] - 2026-03-06

### Added
- Agente IA central con orquestación multi-agente
- Panel de agente con UI conversacional (slide-in panel)
- Botón flotante del agente + atajo Ctrl+J
- API de chat con streaming (Vercel AI SDK v6)
- Conversaciones persistentes con historial
- System prompt dinámico basado en permisos del usuario
- Platform tools: listar usuarios, apps, departamentos, buscar datos
- App tools: delegación a agentes de apps registradas
- Rate limiting por usuario (mensajes/hora + tokens/día)
- SDK de agente (@aleph-platform/agent-sdk) con AlephAgent class
- API de búsqueda global (usuarios, apps, departamentos)
- Página de AI Analytics en admin
- Registro de agentes IA por app (admin > apps > Agente IA tab)
- Command palette con búsqueda y acción de agente
- i18n para sección de agente (es/en)
- 20 tests Playwright para Fase 3

## [0.2.0] - 2026-03-05

### Added
- Motor de integración con Traefik ForwardAuth
- SSO bridge para single sign-on automático
- Health checker para monitoreo de servicios
- API providers CRUD (admin)
- API keys CRUD con hashing seguro
- Webhooks CRUD con firma HMAC
- SDK (@aleph-platform/sdk) con middleware Express y Next.js
- Verify-access endpoint con headers X-CHS-*
- Seed data con organización, departamentos, roles y apps por defecto
- 20 tests Playwright para Fase 2

## [0.1.0] - 2026-03-04

### Added
- Dashboard con estadísticas y actividad reciente
- Panel de administración (usuarios, departamentos, roles, apps)
- Monitor de servicios
- Perfil de usuario con edición
- Modo oscuro
- Command palette (Ctrl+K)
- Notificaciones
- UI responsive (mobile/desktop)
- 25 tests Playwright para Fase 1

## [0.0.1] - 2026-03-03

### Added
- Monorepo Turborepo con workspaces
- 20 tablas PostgreSQL con Drizzle ORM
- Autenticación JWT + cookies HttpOnly
- Login/logout con bcrypt
- Docker Compose (PostgreSQL + Platform)
- CI workflow con GitHub Actions
- Edge middleware para protección de rutas
- 14 tests Playwright para Fase 0
