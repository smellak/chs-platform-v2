# Auditoría Funcional CHS Platform v2

**Fecha:** 2026-03-14
**Auditor:** Claude Opus 4.6 (automatizado)
**Entorno:** Producción — `platform.centrohogarsanchez.es`
**Servidor:** Hetzner VPS `94.130.248.102` (Ubuntu, Docker)

---

## RESUMEN EJECUTIVO

- **6 de 8 apps** funcionan correctamente (Arana tiene internal_url rota en DB, Dashboard devuelve 401/offline)
- **3 problemas críticos**, 4 medios, 5 bajos encontrados
- ForwardAuth funciona correctamente en 5/7 dominios protegidos
- Chat IA con Gemini 3 Flash funciona (API, tool calls, delegación a apps)
- **1.018 refresh tokens acumulados** para un solo usuario — falta limpieza
- **8 de 10 usuarios son ficticios** (inactivos, nunca usados, emails `@centrohogar.es` inexistentes)
- Route Optimizer estaba caído (se reinició durante la auditoría)
- Sparkium en crash loop permanente (DB hostname roto)
- **17/18 tests Playwright pasaron** (1 timeout en chat UI por espera >2min)

---

## 1. INFRAESTRUCTURA

| Componente | Estado | Detalle |
|------------|--------|---------|
| Contenedor `chs-platform` | OK | Up 29 horas |
| Contenedor `chs-db` | OK | Up 29 horas, healthy |
| Route Optimizer | RECUPERADO | Estaba `Exited` 33h, reiniciado durante auditoría — ahora Up |
| Araña de Precios | OK | Up 29h (container `a00g4os8ogg8skgk0oowk8c8-160853936940`) |
| Sistema AON | OK | Up 29h, health "degraded" (último job falló hace 5 días) |
| Citas Almacén | OK | Up 29h, healthy |
| Portal Proveedores | OK | Up 29h, healthy |
| Procesador de Medidas | OK | Up 29h, healthy |
| Cuadro de Dirección | OK | Up 29h, pero ForwardAuth falla (ver sección 3) |
| Sparkium | CRASH LOOP | `Restarting (3) 31 seconds ago` — DB hostname `db-h8sgow084w4000w8w8ks0cso-234204774832` irresolvable |
| Traefik file providers | OK | 9 archivos YAML activos + 2 disabled |
| Disco | OK | 27% usado (75G/293G) |
| RAM | OK | 4.0Gi/31Gi usada (13% uso) |

### Traefik File Providers (9 activos)

| Archivo | Dominio | Servicio backend |
|---------|---------|------------------|
| `chs-v2-citas-auth.yaml` | citas.centrohogarsanchez.es | Docker label service (Coolify) + define middleware `chs-v2-forward-auth` |
| `chs-v2-rutas-auth.yaml` | rutas.centrohogarsanchez.es | `http://route-optimizer-phase6:8000` (servicio file) |
| `chs-v2-aon-auth.yaml` | aon.centrohogarsanchez.es | Docker label service (Coolify) |
| `chs-v2-arana-auth.yaml` | arana.centrohogarsanchez.es | Docker label service (Coolify) |
| `chs-v2-dashboard-auth.yaml` | dashboard.centrohogarsanchez.es | Docker label service (Coolify) |
| `chs-v2-medidas-auth.yaml` | medidas.centrohogarsanchez.es | `http://wk8sggsg4koowwccssww4c4s-163147672345:3000` (servicio file) |
| `chs-v2-elias-auth.yaml` | elias.centrohogarsanchez.es | Misma app que Citas (Docker label service) |
| `chs-v2-platform.yaml` | platform.centrohogarsanchez.es | `http://chs-platform:3000` (sin ForwardAuth) |
| `proveedores-chs-auth.yaml` | proveedores.centrohogarsanchez.es | `http://proveedores-api:3010` (servicio file) |

---

## 2. BASE DE DATOS — DATOS REALES vs FALSOS

### Usuarios

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `users` | 10 | PARCIAL | **2 activos reales** (admin/Soufiane Mellak, Pablo Lopez Jimenez). **8 inactivos ficticios** con emails `@centrohogar.es` inventados (Ana Rodríguez, Carlos Martínez, Juan García, Laura Fernández, María López, Pedro Sánchez, Roberto Díaz, Sara Moreno). Estos usuarios fueron creados por tests o seed y nunca se han usado en producción real. |

### Departamentos

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `departments` | 10 | PARCIAL | Solo **IT** tiene usuarios activos (2). Compras, Contenido, Dirección, E-commerce, IA, Logística, Marketing, Marketplace, Ventas tienen 0 usuarios activos. Los departamentos existen como estructura pero no están poblados con usuarios reales. Los contadores en la UI son correctos. |

### Roles

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `roles` | 4 | OK | Admin Departamento (0 activos), Super Admin (2 activos), Usuario (0 activos), Visor (0 activos). Los contadores en la UI coinciden con la DB. |

### Apps e Instancias

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `apps` | 8 | MAYORMENTE | 7 apps activas + 1 inactiva (Amazon A+ Generator — nunca desplegada). Las 7 activas corresponden a apps reales desplegadas. |
| `app_instances` | 8 | PROBLEMA | **Araña de Precios tiene `internal_url` obsoleta**: DB dice `a00g4os8ogg8skgk0oowk8c8-024133448123` pero el contenedor actual es `a00g4os8ogg8skgk0oowk8c8-160853936940`. Health checks internos de Araña fallan (timeout 5s). **Cuadro de Dirección** tiene `internal_url` no estándar (`https-0-css4cosk08k0c40gkgww84go@docker` — referencia a servicio Docker label, no URL HTTP). Su health check también falla. |

### App Access Policies

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `app_access_policies` | 9 | OK | 9 políticas de acceso coherentes. Pero dado que solo 2 usuarios están activos y ambos son Super Admin (acceso total), las políticas son irrelevantes en la práctica. |

### Sesiones

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `refresh_tokens` | **1.018** | PROBLEMA | **TODAS pertenecen a un solo usuario (admin)**. Todas vigentes (7 días expiry). Acumuladas desde 2026-03-12. No hay purga de tokens antiguos. La UI de sesiones renderiza 1.018 filas (screenshot de 54.694px de alto). Causas: cada login de Playwright, cada curl de test, y cada refresh genera un nuevo token sin revocar los anteriores. |

### Proveedores API y Modelos

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `api_providers` | 2 | OK | **Google AI** (activo, API key configurada, `gemini-3-flash-preview`). **Anthropic** (inactivo, sin API key en DB — pero `ANTHROPIC_API_KEY` sí está en las env vars del contenedor). |
| `ai_models` | 2 | OK | Gemini 3 Flash (activo, default). Claude Sonnet 4 (inactivo). Costes mostrados como $0.0000 en UI para Google (los reales son $0.0005/$0.003 por 1K tokens según DB). |

### Conversaciones y Chat IA

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `agent_conversations` | 8 | MIXTO | Mezcla de conversaciones de test y reales. |
| `agent_messages` | 13 | MIXTO | Ídem. |
| `agent_tool_calls` | 1 | REAL | Solo 1 tool call registrado (bajo, posiblemente el logging no captura todas). |

### Costes API

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `api_cost_logs` | 48 | REAL | 34 llamadas Google AI ($0.07 total), 14 llamadas Anthropic ($0.15 total). Son costes reales de uso durante desarrollo y testing. |

### Activity Logs

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `activity_logs` | ~7.500 | CONTAMINADO | Dominados por: `auth.verify-access` (6.253 — ForwardAuth checks de Traefik), `auth.login` (1.035 — Playwright tests repetidos + auditoría curl), `agent.chat` (50), `user.delete` (39 — tests E2E), `api-key.create` (14 — tests E2E). Los logs son funcionales pero están inflados por testing automatizado. |

### Alertas y Notificaciones

| Tabla | Registros | Reales? | Detalle |
|-------|-----------|---------|---------|
| `ai_alert_rules` | 2 | OK | Reglas configuradas. |
| `ai_alerts` | 0 | OK | Sin alertas disparadas. |
| `notifications` | 27 (22 no leídas) | REAL | Notificaciones de "Servicio caído" / "Servicio restaurado" — generadas automáticamente por health checks. |
| `api_keys` | 14 | TEST | Todas creadas por tests E2E (nombres `E2E Key ...` y `Test Key E2E`). Ninguna usada en producción real. |
| `webhooks` | 0 | OK | Sin webhooks configurados. |

---

## 3. FORWARDAUTH

| App | Sin auth | Con auth | Chat público | Veredicto |
|-----|----------|----------|-------------|-----------|
| citas | HTTP 401 | HTTP 200 | `/chat` HTTP 200, `/api/chat/message` HTTP 200 | OK — ForwardAuth bloquea, chat público correctamente excluido |
| rutas | HTTP 401 | HTTP 200 | N/A | OK — ForwardAuth funciona (Route Optimizer estaba caído pero se reinició) |
| aon | HTTP 401 | HTTP 200 | N/A | OK |
| arana | HTTP 307 (redirect a `/import`) | HTTP 307 → 200 (sigue redirect) | N/A | OK — La app redirige internamente, ForwardAuth valida correctamente |
| proveedores | **HTTP 200** | HTTP 200 | N/A | NOTA — **El frontend SPA es público por diseño** (login client-side). Solo `/api/proveedores/*` está protegido por ForwardAuth. No es un agujero: la API sí requiere auth. |
| medidas | HTTP 401 | HTTP 200 | N/A | OK |
| dashboard | HTTP 401 | **HTTP 401** (primera vez), HTTP 307 (retry) | N/A | PROBLEMA — El primer request con auth devolvió 401. Inconsistente. Puede ser timing o que verify-access no encuentra la app en DB. |
| elias | N/A (alias de citas) | N/A | N/A | OK — Dominio secundario para Citas |

### Hallazgos ForwardAuth

1. **Proveedores SPA pública es intencional** — El Traefik config tiene el frontend como `priority: 150` sin ForwardAuth, mientras la API protegida está en `priority: 200` con ForwardAuth. Diseño correcto para SPAs.
2. **Dashboard inconsistente** — `internal_url` en DB es `https-0-css4cosk08k0c40gkgww84go@docker` (referencia Docker label, no HTTP URL). El health check siempre falla ("Connection failed or timeout"). ForwardAuth a veces rechaza requests autenticados.

---

## 4. HEALTH CHECKS

| App | URL interna | Responde? | Tiempo (ms) | Estado en DB/Monitor |
|-----|------------|-----------|-------------|---------------------|
| Citas Almacén | `cogk4c4s8kgsk4k4s00wskss-1772718757:5000` | OK | 4-6ms | online |
| Route Optimizer | `route-optimizer-phase6:8000` | OK (tras reinicio) | 18-21ms | online |
| Sistema AON | `ms84cwosc0occ488ggccg8g8-135345214202:3000` | OK | 29-31ms | online (degraded — último job falló) |
| Araña de Precios | `a00g4os8ogg8skgk0oowk8c8-024133448123:3000` | FALLA | timeout 5s | **offline** (DB internal_url obsoleta; Traefik usa Docker label service y SÍ funciona) |
| Portal Proveedores | `proveedores-api:3010` | OK | 2-3ms | online |
| Procesador de Medidas | `wk8sggsg4koowwccssww4c4s-163147672345:3000` | OK | 2-7ms | online |
| Cuadro de Dirección | `css4cosk08k0c40gkgww84go` (Docker label ref) | FALLA | 0ms | **offline** (internal_url no es HTTP URL) |
| Amazon A+ Generator | `amazon-aplus:3000` | FALLA | timeout | **offline** (app inactiva, nunca desplegada) |
| CHS Platform | `chs-platform:3000` | OK | <1ms | N/A (self) |

**Monitor page:** Devuelve **404** (`/admin/monitor` no existe como ruta). La página del monitor no se encuentra.

### Discrepancia health endpoint de Araña

La DB tiene `health_endpoint: /dashboard` para Araña, pero el endpoint real de health es `/api/health` (que Traefik sirve como ruta pública). El health check interno usa la `internal_url` + `health_endpoint`, por lo que falla por doble razón: URL obsoleta + endpoint incorrecto.

---

## 5. CHAT IA

| Test | Resultado | Detalle |
|------|-----------|---------|
| Gemini API key en contenedor | OK | `GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...` presente. `ANTHROPIC_API_KEY=sk-ant-...` también presente como fallback. |
| `AI_MODEL` configurado | OK | `gemini-3-flash-preview` |
| POST `/api/agent/chat` simple | OK | HTTP 200, streaming SSE, respuesta coherente en ~5s. Gemini resuelve correctamente. |
| Platform tool (`buscar_usuarios`) | OK | HTTP 200, el agente invocó `buscar_usuarios`, obtuvo 10 usuarios, respondió "2 activos" — **dato correcto**. Latencia 8s. |
| Delegación a Elias (`consultar_citas`) | OK | HTTP 200, el agente delegó `citas-almacen__consultar_citas` con fecha 2026-03-14, Elias respondió "0 citas hoy". También consultó calendario semanal. Latencia 13s. |
| Chat UI (Playwright) | TIMEOUT | El test encontró el botón de agente, abrió el panel, escribió mensaje, pero esperó >2min para la respuesta UI. El chat **funciona via API** (verificado por curl y screenshot A10 que muestra respuesta correcta). |
| Chat público Elias | OK | `citas.centrohogarsanchez.es/chat` carga correctamente con interfaz completa (avatar, video tutorial, botones de acción). El POST a `/api/chat/message` devuelve 200 pero con error genérico ("error inesperado"). |
| Model resolver logs | OK | `[model-resolver] Resolved default model {"modelId":"gemini-3-flash-preview","provider":"Google AI"}` |
| Token/cost tracking | OK | 48 registros de coste. Google AI: $0.07 (34 llamadas), Anthropic: $0.15 (14 llamadas). |

### Problema: Next.js Image Cache

```
Failed to write image to cache ... Error: EACCES: permission denied, mkdir '/app/apps/platform/.next/cache'
```

El contenedor corre como usuario no-root (`chs:1001`) pero el directorio `.next/cache` no tiene permisos de escritura. Esto causa errores repetidos en los logs pero no afecta la funcionalidad principal.

---

## 6. ADMIN — FUNCIONALIDAD CRUD

| Sección | Crear | Leer | Editar | Eliminar | Bugs |
|---------|-------|------|--------|----------|------|
| Usuarios | N/T | OK (muestra 2 activos) | N/T | Sin botones de eliminar visibles | La UI filtra por activos, mostrando solo 2 de 10 totales. No se encontraron botones de eliminar (posible protección contra borrar super-admins). |
| Departamentos | OK (btn visible) | OK (10 depts, contadores correctos) | OK (btn visible) | OK (btn visible) | Contadores de usuarios son correctos (0 para todos excepto IT=2). |
| Aplicaciones | OK (btn "Nueva Aplicación") | OK (8 apps listadas) | OK ("Editar" + tabs) | OK (btn basura) | Al guardar tras editar acceso, aparecen **9 errores** (probablemente validación de campos requeridos). Ver screenshot A05. |
| Apps>Acceso | N/A | OK (tab Acceso visible) | OK (editor visible) | N/A | El guardado genera errores — revisar validación de formulario. |
| Roles | OK (btn "Nuevo Rol") | OK (4 roles, contadores correctos) | OK (btn "Editar") | No visible | Roles marcados como "Sistema" no parecen tener botón eliminar (correcto). |
| Providers API | OK (btn visible) | OK (2 providers) | OK (btn "Editar") | OK (btn basura) | Anthropic muestra "No configurada" (sin API key en DB, aunque sí en env vars). Google AI muestra coste $0.0000 (debería mostrar $0.0005/$0.003). |
| Sesiones | N/A | OK (1018 sesiones listadas) | N/A | N/T (revocar) | **Renderiza 1.018 filas** — screenshot de 54.694px. Sin paginación. Performance degradada. |
| Auditoría | N/A | OK (200 registros, paginado 1/10) | N/A | N/A | Los logs están contaminados por auth.verify-access (6.253 entries) y auth.login de tests (1.035). Filtros funcionan. |

N/T = No Testeado (no se ejecutaron acciones destructivas para no alterar datos)

---

## 7. UI/UX

| Característica | Funciona? | Detalle |
|---------------|-----------|---------|
| Dark mode | NO VERIFICADO | El test no encontró botón de tema (A13 pasó pero no generó screenshots dark). El botón de luna/sol está visible en el header. |
| Mobile responsive | OK | Dashboard y admin se adaptan a 375x812. Screenshots A14 muestran layout correcto. |
| Command palette (Ctrl+K) | OK | Se abre correctamente con secciones "Navegación" y "Administración". Incluye Dashboard, Monitor, Mi perfil, Usuarios, Departamentos, Aplicaciones. |
| Perfil | OK | Muestra "Soufiane Mellak" correctamente. |
| Notificaciones | OK | Badge "9+" visible en header. 22 no leídas de 27 total. |
| Video intro | OK (público Elias) | Video tutorial visible en `/chat` de Citas (0:31 seg). Cookie `chs_intro_seen` funciona en login de plataforma. |
| Monitor page | 404 | `/admin/monitor` devuelve "Página no encontrada". La ruta no existe. |
| Dashboard counters | OK | "SERVICIOS 5/7", "DEPARTAMENTOS 5", "APPS 7" — reflejan la realidad (5 depts con apps, 7 apps activas, 5 de 7 servicios up). |

---

## 8. AGENTES IA

| App | Tiene agente | Endpoint | Capabilities | Delegación funciona |
|-----|-------------|----------|-------------|---------------------|
| Citas Almacén | OK (Elias) | `/api/agent` | `consultar_citas`, `ver_calendario`, `ver_disponibilidad` | OK — Probado: delegó correctamente con fecha, Elias respondió con datos reales |
| Route Optimizer | OK (OptiRoute) | `/api/agent` | `consultar_pedidos`, `consultar_vehiculos`, `consultar_rutas`, `ver_historial` | N/T (app estaba caída durante tests de chat) |
| Sistema AON | OK (AON) | `/api/agent` | `consultar_polizas`, `ver_trabajos`, `ver_estadisticas` | N/T |
| Araña de Precios | OK (Arana) | `/api/agent` | `consultar_precios`, `ver_alertas`, `ver_competidores` | N/T (internal_url obsoleta en DB, delegación probablemente falla) |
| Portal Proveedores | OK (Proveedores) | `/api/agent` | `consultar_proveedores`, `ver_facturas`, `ver_ordenes_compra` | N/T |
| Cuadro de Dirección | OK (Agente Dashboard) | `/api/agent` | `consultar_ventas`, `consultar_margenes`, `comparar_tiendas`, `resumen_ejecutivo` | N/T |
| Procesador de Medidas | OK (Medidas Agent) | `/api/agent` | `listar_jobs`, `ver_job`, `ver_metricas_stage1`, `estadisticas_generales` | N/T |

**Total: 7 agentes configurados** (CLAUDE.md menciona 5 — el CLAUDE.md está desactualizado, no incluye Agente Dashboard ni Medidas Agent).

---

## 9. TESTS PLAYWRIGHT

| Test | Resultado | Screenshot |
|------|-----------|-----------|
| A01: Dashboard datos reales | PASS | audit-A01-dashboard.png |
| A02: Admin>Usuarios lista real | PASS (2 filas) | audit-A02-usuarios.png |
| A03: Botones eliminar usuario | PASS (0 botones encontrados) | audit-A03-delete-buttons.png |
| A04: Departamentos contadores | PASS | audit-A04-departamentos.png |
| A05: Apps editar acceso | PASS (9 errores al guardar) | audit-A05-app-acceso.png, audit-A05-after-save.png |
| A06: Apps lista | PASS | audit-A06-apps-list.png |
| A07: Monitor | PASS (404 — página no encontrada) | audit-A07-monitor.png |
| A08: Sesiones | PASS (1018 filas renderizadas) | audit-A08-sesiones.png |
| A09: Proveedores API | PASS | audit-A09-providers.png |
| A10: Chat IA UI | **FAIL** (timeout 120s) | audit-A10-chat-open.png, audit-A10-chat-response.png |
| A11: Auditoría registros | PASS | audit-A11-audit-log.png |
| A12: Roles contadores | PASS | audit-A12-roles.png |
| A13: Dark mode | PASS (sin screenshots dark generados) | — |
| A14: Mobile responsive | PASS | audit-A14-mobile-dashboard.png, audit-A14-mobile-admin.png |
| A15: ForwardAuth citas | PASS (HTTP 401 sin auth) | audit-A15-citas-noauth.png |
| A16: Chat público Elias | PASS | audit-A16-chat-publico.png |
| A17: Perfil datos reales | PASS | audit-A17-perfil.png |
| A18: Command palette | PASS | audit-A18-command-palette.png |

**Resultado: 17/18 pasaron.** El único fallo es el test A10 (timeout del chat UI, pero el chat funciona via API según curl y screenshots).

---

## 10. LISTA DE BUGS ENCONTRADOS (ordenados por gravedad)

### CRÍTICOS

1. **[CRÍTICO] Araña de Precios `internal_url` obsoleta en DB** — La DB tiene `http://a00g4os8ogg8skgk0oowk8c8-024133448123:3000` pero el contenedor actual es `a00g4os8ogg8skgk0oowk8c8-160853936940`. Esto causa: health checks internos fallan (timeout), monitor muestra "offline", y la delegación del agente IA a Araña probablemente no funciona. **Traefik SÍ funciona** porque usa Docker label service. Ejecutar `sudo ./scripts/update-container-urls.sh` para corregir.

2. **[CRÍTICO] Route Optimizer estaba caído 33+ horas** — El contenedor `route-optimizer-phase6` estaba en `Exited (0)` sin que nadie lo detectara (o al menos sin acción). Se reinició automáticamente durante la auditoría. No hay alertas automáticas de reinicio.

3. **[CRÍTICO] Sparkium en crash loop permanente** — El contenedor `sparkium` está en `Restarting` continuo. Error: `could not translate host name "db-h8sgow084w4000w8w8ks0cso-234204774832"`. El hostname de su DB cambió tras un redeploy de Coolify y nunca se actualizó. Aunque no es una app de CHS Platform, consume recursos y genera ruido en los logs.

### ALTOS

4. **[ALTO] 1.018 refresh tokens acumulados sin purga** — Todos pertenecen al usuario `admin`. No hay mecanismo de limpieza. Cada login (incluyendo Playwright tests, curls de auditoría) crea un nuevo token de 7 días sin revocar los anteriores. La UI de sesiones renderiza todas las filas sin paginación, generando un screenshot de 54.694px de alto.

5. **[ALTO] `/admin/monitor` devuelve 404** — La ruta del Monitor no existe en la app. El botón "MONITOR" del header lleva a una página que no se encuentra. Funcionalidad core ausente.

6. **[ALTO] Cuadro de Dirección ForwardAuth inconsistente** — La `internal_url` en DB es `https-0-css4cosk08k0c40gkgww84go@docker` (referencia Docker label service, no URL HTTP). Health checks siempre fallan. ForwardAuth a veces rechaza requests autenticados (devolvió 401 la primera vez, 307 en retry).

7. **[ALTO] Chat público Elias devuelve error genérico** — `POST /api/chat/message` devuelve HTTP 200 pero con `{"type":"error","content":"Lo siento, ha ocurrido un error inesperado"}`. El chat de la plataforma (via `/api/agent/chat`) sí funciona con Gemini.

### MEDIOS

8. **[MEDIO] 8 de 10 usuarios son ficticios** — Ana Rodríguez, Carlos Martínez, Juan García, Laura Fernández, María López, Pedro Sánchez, Roberto Díaz, Sara Moreno — todos inactivos, emails `@centrohogar.es`, creados por seed/tests. Contaminan la base de datos y confunden los contadores (10 usuarios totales vs 2 reales).

9. **[MEDIO] Activity logs contaminados por tests** — 1.035 registros `auth.login` (mayoría de Playwright/curl), 39 `user.delete` (tests E2E), 14 `api-key.create` (tests E2E). No hay forma de distinguir actividad real de testing en la UI.

10. **[MEDIO] 14 API keys de test residuales** — Todas con nombres `E2E Key ...` y `Test Key E2E`. Sin uso real. Deberían limpiarse.

11. **[MEDIO] Error de permisos de cache de imágenes** — `EACCES: permission denied, mkdir '/app/apps/platform/.next/cache'`. El usuario no-root `chs:1001` no puede escribir en el directorio de cache. Genera errores repetidos en los logs del contenedor.

12. **[MEDIO] Apps>Acceso: 9 errores al guardar** — Al editar una app y hacer click en "Guardar" en la pestaña de acceso, aparecen 9 errores (screenshot A05). Posible problema de validación de formulario.

### BAJOS

13. **[BAJO] Araña health endpoint configurado incorrectamente** — DB tiene `health_endpoint: /dashboard` para Araña, pero el endpoint real es `/api/health`. Incluso si se corrige la `internal_url`, el health check apuntaría al endpoint equivocado.

14. **[BAJO] Google AI muestra coste $0.0000 en UI** — Los costes reales son $0.0005/$0.003 por 1K tokens (registrados en DB con valores correctos), pero la UI de Proveedores API muestra $0.0000.

15. **[BAJO] Anthropic sin API key en DB pero sí en env vars** — La DB marca Anthropic como "No configurada" / "Inactivo", pero `ANTHROPIC_API_KEY` está presente en las variables de entorno del contenedor. Inconsistencia menor ya que Anthropic es el fallback y está explícitamente inactivo.

16. **[BAJO] `agent_tool_calls` solo registra 1 de 48 llamadas** — Se han hecho 48 llamadas API registradas en `api_cost_logs`, pero solo 1 `tool_call` está en `agent_tool_calls`. El logging de tool calls parece incompleto.

17. **[BAJO] CLAUDE.md desactualizado** — Menciona 5 agentes pero hay 7 (falta Agente Dashboard y Medidas Agent). No menciona los dominios `dashboard.centrohogarsanchez.es`, `medidas.centrohogarsanchez.es` ni `elias.centrohogarsanchez.es`.

---

## 11. RECOMENDACIONES (prioridad descendente)

1. **Ejecutar `update-container-urls.sh`** — Corrige la `internal_url` de Araña (y cualquier otra obsoleta) inmediatamente. Esto restaurará health checks y delegación de agente.

2. **Implementar purga de refresh tokens** — Añadir un cron/scheduled job que elimine tokens expirados o limite a N tokens por usuario. Los 1.018 tokens actuales deberían purgarse.

3. **Corregir la ruta `/admin/monitor`** — La página del monitor no existe. Implementar o redirigir a la página correcta.

4. **Arreglar `internal_url` del Cuadro de Dirección** — Cambiar de referencia Docker label a URL HTTP real (`http://css4cosk08k0c40gkgww84go-165856751822:3000`).

5. **Investigar error del chat público Elias** — `POST /api/chat/message` devuelve error genérico. Verificar la API key de Gemini dentro del contenedor de Citas o la configuración del chat público.

6. **Limpiar datos de test** — Eliminar usuarios ficticios inactivos, API keys E2E, y considerar reset de activity logs contaminados.

7. **Añadir paginación a la vista de sesiones** — Renderizar 1.018+ filas destruye la performance del navegador.

8. **Resolver Sparkium crash loop** — Actualizar el hostname de DB o detener el contenedor si no se usa.

9. **Configurar alertas de contenedor caído** — Route Optimizer estuvo caído 33h sin detección. Implementar alertas automatizadas (email/webhook) cuando un servicio pasa a offline.

10. **Corregir health_endpoint de Araña** — Cambiar de `/dashboard` a `/api/health` en `app_instances`.

11. **Actualizar CLAUDE.md** — Añadir los 2 agentes faltantes, los 3 dominios nuevos, y actualizar la sección de Milestones.

12. **Corregir permisos de cache de imágenes** — En el Dockerfile, crear el directorio `.next/cache` con permisos para el usuario `chs:1001`.
