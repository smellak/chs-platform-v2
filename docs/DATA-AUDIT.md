# CHS Platform v2 — Auditoría de Datos

**Fecha:** 2026-03-09
**Auditor:** Claude (automated)
**Objetivo:** Identificar qué datos son REALES vs FALSOS/INVENTADOS/SIMULADOS en la plataforma.

---

## Resumen Ejecutivo

| Categoría | Veredicto | Detalle |
|-----------|-----------|---------|
| Organización | REAL | Centro Hogar Sánchez es una empresa real |
| Departamentos (10) | REALES | Reflejan la estructura real de CHS |
| Usuarios (9) | PARCIALMENTE REALES | Nombres plausibles, pero contraseña compartida `admin123` |
| Roles (4) | REALES | Estructura de permisos funcional |
| Apps (5) | REALES | Representan herramientas reales de CHS |
| Estado de servicios | REAL PERO ROTO | Chequeos de salud reales, pero fallan por DNS incorrecto |
| Monitor - Gráfico de costes | **FALSO** | Datos demo hardcodeados |
| Activity Logs | REALES | Generados por uso real del sistema |
| Conversaciones IA | REALES | Generadas por tests automatizados del agente |
| API Cost Logs | REALES | 12 entradas reales de uso de Anthropic |
| Notificaciones | VACÍO | 0 registros (los servicios nunca estuvieron online para generar transiciones) |
| API Keys | TEST | 13 claves generadas por tests E2E |
| API Providers | BUG | Los 3 tienen `provider_type='anthropic'` (error de migración) |
| AI Models | VACÍO | La migración borró los que creó el seed |

---

## 1. Organización

| Campo | Valor | Veredicto |
|-------|-------|-----------|
| Nombre | Centro Hogar Sánchez | REAL — empresa existente |
| Slug | `chs` | REAL |
| Dominio | `.centrohogarsanchez.es` | REAL — dominio activo en producción |

**Origen:** `seed.ts` línea 17-19, configurable por env vars `ORG_NAME`, `ORG_SLUG`, `ORG_DOMAIN`.

---

## 2. Departamentos

Se crearon 10 departamentos vía `migrate-chs.sql`. La seed original crea solo 8.

| Departamento | Slug | ¿Real? | Notas |
|--------------|------|--------|-------|
| Compras | compras | SI | Departamento real de CHS |
| Contenido | contenido | SI | Gestión de contenido real |
| Dirección | direccion | SI | Dirección de la empresa |
| E-commerce | ecommerce | SI | Canal de venta online |
| IT | it | SI | Departamento tecnológico |
| Inteligencia Artificial | ia | SI | Proyecto IA activo |
| Logística y Almacén | logistica-almacen | SI | Core del negocio |
| Marketing | marketing | SI | Marketing real |
| Marketplace | marketplace | SI | Venta en marketplaces |
| Ventas | ventas | SI | Equipo comercial |

**Veredicto:** REALES. Los 10 departamentos representan áreas reales de CHS. Los 2 adicionales (Dirección e IA) fueron añadidos en `migrate-chs.sql`.

---

## 3. Usuarios

| Username | Nombre | Email | Rol | Dept | Super Admin | Activo | Último Login | ¿Real? |
|----------|--------|-------|-----|------|-------------|--------|-------------|--------|
| admin | Admin Sistema | admin@centrohogar.es | super-admin | IT | SI | SI | 2026-03-09 11:55 | FUNCIONAL (cuenta de sistema) |
| carlos.martinez | Carlos Martínez | carlos@centrohogar.es | user | Logística | NO | SI | 2026-03-09 00:25 | PLAUSIBLE |
| ana.rodriguez | Ana Rodríguez | ana@centrohogar.es | user | Marketing | NO | SI | 2026-03-09 00:09 | PLAUSIBLE |
| pedro.sanchez | Pedro Sánchez | pedro@centrohogar.es | dept-admin | IT | NO | SI | nunca | PLAUSIBLE |
| maria.lopez | María López | maria@centrohogar.es | user | Compras | NO | SI | 2026-03-09 00:25 | PLAUSIBLE |
| juan.garcia | Juan García | juan@centrohogar.es | user | Ventas | NO | SI | nunca | PLAUSIBLE |
| laura.fernandez | Laura Fernández | laura@centrohogar.es | user | E-commerce | NO | **NO** | nunca | PLAUSIBLE (desactivada) |
| roberto.diaz | Roberto Díaz | roberto@centrohogar.es | user | Logística | NO | SI | nunca | PLAUSIBLE |
| sara.moreno | Sara Moreno | sara@centrohogar.es | viewer | IA | NO | SI | nunca | PLAUSIBLE |

### Problemas detectados:
- **Contraseña compartida:** TODOS los usuarios tienen el mismo hash bcrypt (`admin123`). Esto es útil para desarrollo/testing pero inseguro para producción.
- **Solo 4 de 9 usuarios han iniciado sesión alguna vez** (admin, carlos, ana, maria) — los logins fueron generados por tests Playwright.
- **laura.fernandez está desactivada** (`is_active=false`), intencionalmente para testing.
- **Emails usan dominio `@centrohogar.es`** — no verificado si existen realmente.

**Veredicto:** INVENTADOS. Los nombres son españoles plausibles pero no corresponden necesariamente a personas reales de CHS. Fueron creados en `migrate-chs.sql` para demostración.

---

## 4. Roles

| Rol | Slug | Permisos | Sistema | ¿Real? |
|-----|------|----------|---------|--------|
| Super Admin | super-admin | Full (8 permisos) | SI | REAL (diseño funcional) |
| Admin Departamento | dept-admin | apps.read/manage, users.read/manage | SI | REAL |
| Usuario | user | apps.read, apps.use | SI | REAL |
| Visor | viewer | apps.read | SI | REAL |

**Veredicto:** REALES. La estructura de permisos es funcional y se usa activamente en `verify-access`.

---

## 5. Aplicaciones

| App | Slug | Internal URL | External Domain | Estado | ¿Existe? |
|-----|------|-------------|-----------------|--------|----------|
| Citas Almacén | citas-almacen | http://elias:5000 | citas.centrohogarsanchez.es | offline | **SI** — Elias está corriendo |
| Route Optimizer | route-optimizer | http://route-optimizer:3000 | (ninguno) | offline | **SI** — contenedor `route-optimizer-phase6` en puerto 8000 |
| Amazon A+ Generator | amazon-aplus | http://amazon-aplus:3000 | (ninguno) | offline | **NO** — no hay contenedor |
| Procesador de Medidas | medidas-excel | http://medidas:3000 | (ninguno) | offline | **NO** — no hay contenedor |
| Sistema AON v2.0 | aon-polizas | http://aon:3000 | (ninguno) | offline | **NO** — no hay contenedor |

### Problemas detectados:

1. **Citas Almacén (Elias):**
   - Internal URL `http://elias:5000` NO resuelve desde `chs-platform`. El contenedor real se llama `cogk4c4s8kgsk4k4s00wskss-1772718757` (nombre Coolify).
   - External domain `citas.centrohogarsanchez.es` SÍ funciona (HTTP 401 = ForwardAuth activo, health endpoint devuelve 200).
   - El health checker falla porque intenta conectar a `http://elias:5000` que no resuelve por DNS.

2. **Route Optimizer:**
   - Internal URL `http://route-optimizer:3000` apunta al puerto incorrecto. El contenedor real es `route-optimizer-phase6` en puerto **8000**, no 3000.
   - Accesible desde chs-platform como `http://route-optimizer-phase6:8000/api/health` → HTTP 200.
   - No tiene external_domain configurado.

3. **Amazon A+ Generator, Procesador de Medidas, Sistema AON:**
   - Son **placeholders** en `migrate-chs.sql` (comentados como "placeholder, not yet deployed").
   - No existen contenedores Docker para estas apps.
   - Sus URLs internas son ficticias.

**Veredicto:** PARCIALMENTE REAL. Solo Elias y Route Optimizer existen como servicios reales, pero sus URLs internas están mal configuradas. Las 3 apps restantes son placeholders.

---

## 6. Estado de Servicios (service_status)

| Métrica | Valor |
|---------|-------|
| Total registros | 3,797 |
| Estados distintos | Solo `offline` |
| Intervalo de chequeo | ~60 segundos |
| Período cubierto | 2026-03-08 23:19 → 2026-03-09 12:04 (~13 horas) |

### Análisis:
- El health checker (`lib/health-checker.ts`) ejecuta chequeos **REALES** cada 60 segundos.
- Hace peticiones HTTP reales a las `internal_url` de cada app instance.
- **Todos fallan** porque:
  - `http://elias:5000` → DNS timeout (nombre de contenedor incorrecto)
  - `http://route-optimizer:3000` → DNS no resuelve (nombre/puerto incorrectos)
  - `http://amazon-aplus:3000` → No existe
  - `http://medidas:3000` → No existe
  - `http://aon:3000` → No existe

**Veredicto:** DATOS REALES de un sistema que no puede conectar a los servicios. El mecanismo es real, pero las URLs están mal configuradas, por lo que siempre reporta `offline`.

---

## 7. Monitor — Gráfico de Costes API

**Archivo:** `apps/platform/src/app/(dashboard)/monitor/page.tsx`, líneas 93-102

```typescript
// Demo chart data for API costs
const chartData = [
  { day: "Lun", cost: 2.4 },
  { day: "Mar", cost: 3.1 },
  { day: "Mié", cost: 1.8 },
  { day: "Jue", cost: 4.2 },
  { day: "Vie", cost: 3.7 },
  { day: "Sáb", cost: 1.2 },
  { day: "Dom", cost: 0.8 },
];
```

**Veredicto:** **FALSO / DATOS DEMO HARDCODEADOS.** El gráfico muestra datos inventados. La tabla `api_cost_logs` tiene 12 registros reales que podrían usarse en su lugar.

---

## 8. Monitor — Estadísticas Hero (Total Apps, En Línea, etc.)

**Archivo:** `apps/platform/src/app/(dashboard)/monitor/page.tsx`, líneas 57-76

- `apps.length` → consulta REAL a la tabla `apps`
- `onlineCount` → filtro REAL sobre status de instancias
- `offlineCount` → filtro REAL
- `maintenanceCount` → filtro REAL sobre `isMaintenance`

**Veredicto:** REAL. Las estadísticas vienen de consultas reales a la base de datos.

---

## 9. Dashboard — Hero Stats

**Archivo:** `apps/platform/src/app/(dashboard)/page.tsx`, líneas 15-118

- "Servicios" → cuenta REAL de apps con status `online`
- "Departamentos" → cuenta REAL de departamentos con apps asignadas
- "Apps" → cuenta REAL de apps únicas accesibles por el usuario

**Veredicto:** REAL. Todas las estadísticas son consultas reales a la BD.

---

## 10. Activity Logs

| Acción | Cantidad | Origen |
|--------|----------|--------|
| auth.login | 1,352 | Logins reales (mayoría de tests Playwright) |
| auth.verify-access | 91 | Verificaciones SSO reales |
| api-key.create | 13 | Creación de API keys (tests E2E) |
| agent.chat | 12 | Conversaciones con agente IA |
| **Total** | **1,468** | |

### Desglose de logins por usuario:
| Usuario | Logins |
|---------|--------|
| admin | 1,296 |
| carlos.martinez | 39 |
| ana.rodriguez | 13 |
| maria.lopez | 4 |

### IP addresses observadas:
- `10.0.1.1` — red interna Docker (tests Playwright)
- `84.124.77.201` — IP pública real (acceso manual)

**Veredicto:** REALES. Todos los logs son generados por acciones reales del sistema. La gran mayoría (1,296 logins de admin) provienen de ejecuciones repetidas de tests Playwright.

---

## 11. Conversaciones del Agente IA

| Métrica | Valor |
|---------|-------|
| Total conversaciones | 12 |
| Total mensajes | 24 (12 user + 12 assistant) |
| Usuario | Todos del usuario `admin` |
| Título | Todos "hello" |
| Tokens (input) | 2,349 por respuesta (consistente) |
| Tokens (output) | 217-268 por respuesta |
| Período | 2026-03-08 23:24 → 2026-03-09 00:25 |

### Análisis:
- Todas las conversaciones son idénticas: el usuario envía "hello" y el agente responde con su saludo estándar.
- Generadas por el test Playwright `fase3.spec.ts` T09 (`agent chat API responds when API key is configured`).
- Los tokens son **REALES** — se registran desde la respuesta real de Anthropic API.

**Veredicto:** DATOS REALES de tests automatizados. No hay conversaciones de usuarios humanos reales.

---

## 12. API Cost Logs

| Métrica | Valor |
|---------|-------|
| Total registros | 12 |
| Proveedor | Anthropic (todos) |
| Tokens promedio | ~2,595 |
| Coste promedio | ~$0.0107 por consulta |
| Coste total | ~$0.13 |
| Endpoint | `agent.chat` (todos) |
| Usuario | admin (todos) |

**Veredicto:** REALES. Costes reales de llamadas a la API de Anthropic generadas por el agente IA durante tests.

---

## 13. API Keys

| Nombre | Prefijo | Estado |
|--------|---------|--------|
| Test Key E2E | chs_sk_* | 13 claves activas |

**Veredicto:** TEST DATA. Todas generadas por el test Playwright `fase2.spec.ts` T14 (`Create API key shows generated key`). Ninguna ha sido usada (`last_used=null`).

---

## 14. API Providers

| Provider | Slug | provider_type | ¿Correcto? |
|----------|------|--------------|-------------|
| Anthropic | anthropic | anthropic | SI |
| OpenAI | openai | **anthropic** | **BUG** — debería ser `openai` |
| Google AI | google-ai | **anthropic** | **BUG** — debería ser `google` |

### Causa raíz:
El archivo `migrate-chs.sql` (línea 247) no especifica `provider_type` al insertar providers:
```sql
INSERT INTO api_providers (org_id, name, slug, model, is_active) VALUES ...
```
La columna `provider_type` tiene DEFAULT `'anthropic'`, por lo que los 3 providers terminan con type `'anthropic'`.

El `seed.ts` SÍ establece correctamente `providerType` (líneas 279-298), pero `migrate-chs.sql` sobreescribe los datos del seed.

**Veredicto:** BUG. El tipo de proveedor es incorrecto para OpenAI y Google AI.

---

## 15. AI Models

| Tabla | Registros |
|-------|-----------|
| ai_models | 0 |
| app_model_assignments | 0 |

### Causa raíz:
1. El `seed.ts` crea 4 modelos IA (Claude Sonnet 4, Claude Haiku 3.5, GPT-4o, Gemini 2.0 Flash)
2. El `migrate-chs.sql` ejecuta `DELETE FROM api_providers WHERE org_id = v_org_id` (línea 66)
3. Los `ai_models` tienen FK `CASCADE` a `api_providers`, así que se borran en cascada
4. El `migrate-chs.sql` NO re-inserta los AI models

**Veredicto:** VACÍO por error de migración. Los modelos deberían existir pero fueron eliminados en cascada.

---

## 16. Notificaciones

| Tabla | Registros |
|-------|-----------|
| notifications | 0 |

### Análisis:
El health checker genera notificaciones cuando un servicio **cambia** de estado (online→offline o offline→online). Como TODOS los servicios siempre han estado `offline` (nunca hubo una transición), nunca se generó ninguna notificación.

**Veredicto:** VACÍO. El sistema es funcional, pero no ha tenido oportunidad de generar datos.

---

## 17. Webhooks, Alertas IA, Permisos IA

| Tabla | Registros |
|-------|-----------|
| webhooks | 0 |
| ai_alert_rules | 0 |
| ai_alerts | 0 |
| agent_permissions | 0 |

**Veredicto:** VACÍOS. Funcionalidades implementadas pero no configuradas.

---

## Contenedores Docker Activos (Estado Real)

| Contenedor | Imagen | Estado | App en CHS |
|------------|--------|--------|------------|
| chs-platform | docker-platform | Up 12h | LA PLATAFORMA |
| chs-db | postgres:16-alpine | Up 13h (healthy) | Base de datos |
| cogk4c4s8kgsk4k4s00wskss-1772718757 | eliasortega:latest | Up 3 días | Citas Almacén (Elias) |
| route-optimizer-phase6 | route-optimizer:phase7 | Up 13h | Route Optimizer |
| sparkium | sparkium-app:latest | Up 17h | NO registrado en CHS |
| proveedores-api-* | chs-proveedores-api:latest | Up 13h | NO registrado en CHS |
| nominatim-andalucia | mediagis/nominatim:4.4 | Up 3 días | Servicio auxiliar (geocoding) |
| osrm-backend | osrm/osrm-backend | Up 3 días | Servicio auxiliar (routing) |

### Apps que existen pero NO están en CHS Platform:
- **Sparkium** — App activa en puerto 5050, no registrada
- **Proveedores API** — Servicio activo en puerto 3010, no registrado

---

## Resumen de Problemas Críticos

### P1: URLs internas incorrectas (CRÍTICO)
- Citas Almacén usa `http://elias:5000` pero el contenedor se llama `cogk4c4s8kgsk4k4s00wskss-1772718757`
- Route Optimizer usa `http://route-optimizer:3000` pero el contenedor es `route-optimizer-phase6` en puerto `8000`
- **Resultado:** El health checker nunca puede alcanzar los servicios reales

### P2: Gráfico de costes con datos demo (MODERADO)
- El monitor muestra datos inventados en el gráfico de "Costes API"
- Existen 12 registros reales en `api_cost_logs` que podrían usarse

### P3: provider_type incorrecto (MODERADO)
- OpenAI tiene `provider_type='anthropic'` en vez de `'openai'`
- Google AI tiene `provider_type='anthropic'` en vez de `'google'`
- Causa: `migrate-chs.sql` no establece la columna `provider_type`

### P4: AI Models vacíos (MODERADO)
- La tabla `ai_models` está vacía por DELETE CASCADE desde `migrate-chs.sql`
- Sin modelos, el model resolver siempre fallback a env vars

### P5: 3 apps placeholder sin servicios reales (BAJO)
- Amazon A+ Generator, Procesador de Medidas, Sistema AON no tienen contenedores desplegados
- Están correctamente marcadas como "unknown" → "offline" por el health checker

### P6: Contraseña compartida (BAJO para dev, CRÍTICO para producción)
- Los 9 usuarios comparten la contraseña `admin123`

### P7: API Keys de test no limpiadas (BAJO)
- 13 claves "Test Key E2E" acumuladas por ejecuciones de Playwright

---

## Clasificación Final

| Dato | Real | Fake | Bug | Test Data | Vacío |
|------|------|------|-----|-----------|-------|
| Organización | X | | | | |
| Departamentos | X | | | | |
| Usuarios | | X | | | |
| Roles | X | | | | |
| Apps (definición) | X | | | | |
| Apps (URLs internas) | | | X | | |
| Service Status | X* | | | | |
| Monitor stats | X | | | | |
| Monitor chart | | X | | | |
| Activity Logs | X | | | X** | |
| Conversaciones IA | | | | X | |
| API Cost Logs | X | | | | |
| API Keys | | | | X | |
| API Providers | | | X | | |
| AI Models | | | X | | X |
| Notificaciones | | | | | X |
| Webhooks | | | | | X |
| AI Alerts/Rules | | | | | X |
| AI Permissions | | | | | X |

\* Mecanismo real, pero URLs rotas causan que siempre reporte offline
\** 96% de los logs de actividad provienen de tests automatizados Playwright
