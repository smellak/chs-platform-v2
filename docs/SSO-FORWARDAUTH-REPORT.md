# Informe SSO ForwardAuth — Integración de 4 Nuevos Dominios

**Fecha:** 9 de marzo de 2026
**Servidor:** 94.130.248.102 (Hetzner)
**Estado:** Completado y verificado

---

## 1. Resumen Ejecutivo

Se ha configurado el sistema de autenticación SSO vía Traefik ForwardAuth para **4 nuevos dominios** de aplicaciones internas de Centro Hogar Sánchez, además del dominio existente de Citas Almacén:

| Dominio | Aplicación | Estado |
|---------|-----------|--------|
| `citas.centrohogarsanchez.es` | Citas Almacén (Elias) | Ya funcionaba |
| `rutas.centrohogarsanchez.es` | Route Optimizer | **Nuevo** |
| `aon.centrohogarsanchez.es` | Sistema AON v2.0 | **Nuevo** |
| `arana.centrohogarsanchez.es` | Araña de Precios | **Nuevo** |
| `proveedores.centrohogarsanchez.es` | Portal Proveedores | **Nuevo** |

Todas las aplicaciones ahora requieren autenticación CHS Platform para acceder a rutas protegidas. El acceso se gestiona mediante políticas por departamento y rol.

---

## 2. Arquitectura SSO

### 2.1. Flujo de Autenticación

```
Usuario → HTTPS → Traefik → ForwardAuth middleware → CHS Platform /api/auth/verify-access
                                                              │
                                                    ┌────────┴────────┐
                                                    │ Token válido?   │
                                                    │ App registrada? │
                                                    │ Acceso permitido│
                                                    └────────┬────────┘
                                                             │
                                                   ┌────────┴────────┐
                                                   │ SÍ: 200 + headers │→ Traefik reenvía al backend
                                                   │ NO: 401/403       │→ Traefik bloquea la petición
                                                   └──────────────────┘
```

### 2.2. Headers SSO Inyectados

Cuando el ForwardAuth aprueba una petición, Traefik inyecta estos headers en la petición al backend:

| Header | Descripción | Ejemplo |
|--------|------------|---------|
| `X-CHS-User-Id` | UUID del usuario | `c36785d1-33d7-4257-a8a9-0ee25fcd51ef` |
| `X-CHS-User-Name` | Nombre completo | `Admin Sistema` |
| `X-CHS-User-Email` | Email | `admin@centrohogar.es` |
| `X-CHS-Org-Id` | UUID de la organización | `deffdef5-5887-4d0a-96a4-0b389c4bcbc9` |
| `X-CHS-Org-Name` | Nombre org | `Centro Hogar Sánchez` |
| `X-CHS-Dept` | Departamento | `IT` |
| `X-CHS-Dept-Id` | UUID departamento | `d44399f1-2218-4a38-ad31-6cd6f124598e` |
| `X-CHS-Role` | Rol del usuario | `super-admin`, `dept-admin`, `member` |
| `X-CHS-Access-Level` | Nivel de acceso | `full`, `readonly` |
| `X-CHS-Permissions` | JSON de permisos | `{"apps.read":true,...}` |
| `X-CHS-User-Dept` | Departamento (alias) | `IT` |
| `X-CHS-User-Role` | Rol (alias) | `super-admin` |

### 2.3. Middleware ForwardAuth (definición central)

Archivo: `/data/coolify/proxy/dynamic/chs-v2-citas-auth.yaml`

```yaml
http:
  middlewares:
    chs-v2-forward-auth:
      forwardAuth:
        address: "http://chs-platform:3000/api/auth/verify-access"
        trustForwardHeader: true
        authResponseHeaders:
          - "X-CHS-User-Id"
          - "X-CHS-User-Name"
          - "X-CHS-User-Email"
          - "X-CHS-Org-Id"
          - "X-CHS-Org-Name"
          - "X-CHS-Dept"
          - "X-CHS-Dept-Id"
          - "X-CHS-Role"
          - "X-CHS-Access-Level"
          - "X-CHS-Permissions"
          - "X-CHS-User-Dept"
          - "X-CHS-User-Role"
```

Este middleware se reutiliza en todos los archivos de configuración de los demás dominios.

---

## 3. Descubrimiento de Contenedores

### 3.1. Inventario de Contenedores

| Aplicación | Contenedor Docker | Puerto | Imagen | Red |
|-----------|------------------|--------|--------|-----|
| CHS Platform | `chs-platform` | 3000 | `docker-platform` | coolify, docker_chs-internal |
| Citas Almacén (Elias) | `cogk4c4s8kgsk4k4s00wskss-1772718757` | 5000 | `eliasortega:latest` | coolify |
| Route Optimizer | `route-optimizer-phase6` | 8000 | `route-optimizer:phase7` | coolify |
| Sistema AON v2.0 | `ms84cwosc0occ488ggccg8g8-135345214202` | 3000 | Coolify build | coolify |
| Araña de Precios | `pgk444cc088o0w40ssc8wkcw-*` | 3000 | Coolify build | coolify |
| Portal Proveedores | `kgskk0wkw4cwkkgo4ggk840g-131103823063` | 3010 | Coolify build | coolify |

> **Nota:** Los contenedores gestionados por Coolify (`ms84cwosc0occ488ggccg8g8-*`, `pgk444cc088o0w40ssc8wkcw-*`) cambian el sufijo numérico en cada redeploy. El prefijo (ID del servicio Coolify) es estable.

### 3.2. Conectividad de Red

Todos los contenedores están en la red Docker `coolify`, lo que permite comunicación directa por nombre de contenedor:

```
Desde chs-platform:
  Elias (Citas)    → cogk4c4s8kgsk4k4s00wskss-1772718757:5000 → HTTP 200 ✓
  Route Optimizer  → route-optimizer-phase6:8000               → HTTP 200 ✓
  AON              → ms84cwosc0occ488ggccg8g8-135345214202:3000 → HTTP 200 ✓
  Araña            → pgk444cc088o0w40ssc8wkcw-144414962348:3000 → HTTP 307 ✓
  Proveedores      → proveedores-api:3010                      → HTTP 200 ✓
```

> `proveedores-api` es un alias DNS estable configurado por Coolify.

### 3.3. Health Endpoints Descubiertos

| Aplicación | Endpoint | Respuesta |
|-----------|----------|-----------|
| Citas Almacén | `/api/health` | `{"status":"ok","database":"connected"}` |
| Route Optimizer | `/api/health` | `{"status":"ok","checks":{"postgresql":"ok","osrm":"ok","nominatim":"ok"}}` |
| Sistema AON | `/api/health` | `{"status":"healthy","timestamp":"...","uptime":"..."}` |
| Araña de Precios | `/dashboard` | HTTP 200 (no tiene endpoint `/api/health`) |
| Portal Proveedores | `/api/proveedores/health` | `{"status":"ok","service":"chs-proveedores-api","database":"connected"}` |

---

## 4. Gestión de Colisiones con Coolify

### 4.1. Problema

Tres aplicaciones (AON, Araña, Proveedores) ya tenían **Docker labels de Traefik** gestionadas por Coolify que creaban routers para sus dominios `*.centrohogarsanchez.es`. Esto generaba colisión con los file providers de ForwardAuth.

### 4.2. Solución

Se utilizó el sistema de **prioridades de Traefik** para resolver las colisiones:

- Los Docker labels de Coolify crean routers sin prioridad explícita (prioridad = longitud de la regla, ~40-50)
- Los file providers de CHS definen routers con **prioridad explícita** (100-250)
- Traefik selecciona el router de mayor prioridad cuando múltiples coinciden

```
Prioridad 250: Rutas públicas específicas (health, auth, portal)
Prioridad 200: Rutas protegidas específicas + rutas públicas genéricas
Prioridad 150: Frontend SPA público (solo Proveedores)
Prioridad 100: Catch-all protegido (ForwardAuth)
Prioridad ~45: Docker labels de Coolify (ignorados por prioridad inferior)
```

### 4.3. Estrategia por Aplicación

| App | Tipo de Backend | Razón |
|-----|----------------|-------|
| **Rutas** | Service propio (`chs-v2-rutas-svc`) | No tiene Docker labels Coolify; se define servicio apuntando a `route-optimizer-phase6:8000` |
| **AON** | Referencia Docker (`https-0-ms84cwosc0occ488ggccg8g8@docker`) | Reutiliza el servicio descubierto por Docker provider (se actualiza automáticamente en redeploy) |
| **Araña** | Referencia Docker (`https-0-pgk444cc088o0w40ssc8wkcw@docker`) | Mismo patrón que AON |
| **Proveedores** | Service propio (`proveedores-api-file`) | Usa alias DNS estable `proveedores-api:3010` |

---

## 5. Configuración de Traefik por Dominio

### 5.1. `rutas.centrohogarsanchez.es` — Route Optimizer

**Archivo:** `/data/coolify/proxy/dynamic/chs-v2-rutas-auth.yaml`

| Router | Regla | Middleware | Prioridad |
|--------|-------|-----------|-----------|
| `chs-v2-rutas-public` | `Host + PathPrefix(/api/health)` | gzip | 200 |
| `chs-v2-rutas-protected` | `Host(rutas.centrohogarsanchez.es)` | **chs-v2-forward-auth** + gzip | 100 |
| `chs-v2-rutas-http` | `Host` (HTTP) | redirect-to-https | — |

**Backend:** `http://route-optimizer-phase6:8000`

### 5.2. `aon.centrohogarsanchez.es` — Sistema AON v2.0

**Archivo:** `/data/coolify/proxy/dynamic/chs-v2-aon-auth.yaml`

| Router | Regla | Middleware | Prioridad |
|--------|-------|-----------|-----------|
| `chs-v2-aon-public` | `Host + PathPrefix(/api/health)` | gzip | 200 |
| `chs-v2-aon-protected` | `Host(aon.centrohogarsanchez.es)` | **chs-v2-forward-auth** + gzip | 100 |
| `chs-v2-aon-http` | `Host` (HTTP) | redirect-to-https | 100 |

**Backend:** `https-0-ms84cwosc0occ488ggccg8g8@docker` (referencia al servicio Docker de Coolify)

### 5.3. `arana.centrohogarsanchez.es` — Araña de Precios

**Archivo:** `/data/coolify/proxy/dynamic/chs-v2-arana-auth.yaml`

| Router | Regla | Middleware | Prioridad |
|--------|-------|-----------|-----------|
| `chs-v2-arana-public` | `Host + PathPrefix(/api/health)` | gzip | 200 |
| `chs-v2-arana-protected` | `Host(arana.centrohogarsanchez.es)` | **chs-v2-forward-auth** + gzip | 100 |
| `chs-v2-arana-http` | `Host` (HTTP) | redirect-to-https | 100 |

**Backend:** `https-0-pgk444cc088o0w40ssc8wkcw@docker` (referencia al servicio Docker de Coolify)

### 5.4. `proveedores.centrohogarsanchez.es` — Portal Proveedores

**Archivo:** `/data/coolify/proxy/dynamic/proveedores-chs-auth.yaml`

Configuración más compleja debido a la estructura SPA + API + WebSocket:

| Router | Regla | Middleware | Prioridad |
|--------|-------|-----------|-----------|
| `proveedores-chs-public-api` | `Host + PathPrefix(/api/proveedores/health, /auth, /portal)` | gzip | 250 |
| `proveedores-chs-protected-api` | `Host + PathPrefix(/api/proveedores)` | **chs-v2-forward-auth** + gzip | 200 |
| `proveedores-chs-ws` | `Host + PathPrefix(/ws/proveedores)` | (ninguno) | 200 |
| `proveedores-chs-frontend` | `Host(proveedores.centrohogarsanchez.es)` | gzip | 150 |
| `proveedores-chs-http` | `Host` (HTTP) | redirect-to-https | — |

**Backend:** `http://proveedores-api:3010` (alias DNS estable de Coolify)

> **Nota:** El frontend SPA de Proveedores es público (prioridad 150) porque la autenticación se gestiona por su propia aplicación. Solo las rutas `/api/proveedores/*` están protegidas por ForwardAuth.

### 5.5. `citas.centrohogarsanchez.es` — Citas Almacén (referencia)

**Archivos:** `chs-v2-citas-auth.yaml` + `chs-v2-elias-auth.yaml`

Ya estaba configurado previamente. Define el middleware `chs-v2-forward-auth` que reutilizan todos los demás dominios. Rutas públicas incluyen `/api/health`, `/api/appointments/confirm`, `/api/chat`, `/chat`, `/docs`, `/assets` y archivos estáticos.

---

## 6. Registro en Base de Datos

### 6.1. Aplicaciones Registradas

| Aplicación | Slug | Categoría | Estado | URL Interna | Dominio Externo |
|-----------|------|----------|--------|-------------|-----------------|
| Citas Almacén | `citas-almacen` | Logística | Activa | `cogk4c4s8kgsk4k4s00wskss-1772718757:5000` | `citas.centrohogarsanchez.es` |
| Route Optimizer | `route-optimizer` | Logística | Activa | `route-optimizer-phase6:8000` | `rutas.centrohogarsanchez.es` |
| Sistema AON v2.0 | `aon-polizas` | Seguros | Activa | `ms84cwosc0occ488ggccg8g8-135345214202:3000` | `aon.centrohogarsanchez.es` |
| Araña de Precios | `arana-precios` | E-commerce | **Nueva** | `pgk444cc088o0w40ssc8wkcw-144414962348:3000` | `arana.centrohogarsanchez.es` |
| Portal Proveedores | `proveedores-api` | Compras | **Nueva** | `proveedores-api:3010` | `proveedores.centrohogarsanchez.es` |
| Amazon A+ Generator | `amazon-aplus` | IA / Marketing | **Desactivada** | — | — |
| Procesador de Medidas | `medidas-excel` | Catálogo | **Desactivada** | — | — |

### 6.2. Cambios Realizados

1. **URLs internas corregidas:** Citas (`http://elias:5000` → contenedor real), Route Optimizer (`http://route-optimizer:3000` → `route-optimizer-phase6:8000`), AON (`http://aon:3000` → contenedor Coolify real)
2. **Dominios externos añadidos:** Route Optimizer (`rutas.centrohogarsanchez.es`), AON (`aon.centrohogarsanchez.es`)
3. **Apps nuevas creadas:** Araña de Precios, Portal Proveedores (con instancias y políticas de acceso)
4. **Apps placeholder desactivadas:** Amazon A+ Generator, Procesador de Medidas (no existen como contenedores reales)

### 6.3. Políticas de Acceso

| Aplicación | Departamento | Nivel |
|-----------|-------------|-------|
| **Araña de Precios** | IT | full |
| **Araña de Precios** | Compras | full |
| **Araña de Precios** | E-commerce | full |
| **Portal Proveedores** | IT | full |
| **Portal Proveedores** | Compras | full |
| **Portal Proveedores** | Logística y Almacén | readonly |
| Citas Almacén | IT | full |
| Citas Almacén | Logística y Almacén | full |
| Citas Almacén | Compras | readonly |
| Route Optimizer | IT | full |
| Route Optimizer | Logística y Almacén | full |
| Sistema AON v2.0 | IT | full |
| Sistema AON v2.0 | Ventas | full |

> Los super-admins tienen acceso `full` a todas las aplicaciones independientemente de las políticas.

---

## 7. Verificación

### 7.1. Test de Acceso sin Autenticación

| Dominio | Sin Cookie | Esperado |
|---------|-----------|----------|
| `rutas.centrohogarsanchez.es/` | **HTTP 401** | 401 (bloqueado) |
| `aon.centrohogarsanchez.es/` | **HTTP 401** | 401 (bloqueado) |
| `arana.centrohogarsanchez.es/` | **HTTP 401** | 401 (bloqueado) |
| `proveedores.centrohogarsanchez.es/` | **HTTP 200** | 200 (frontend SPA público) |
| `proveedores.centrohogarsanchez.es/api/proveedores/health` | **HTTP 200** | 200 (endpoint público) |
| `citas.centrohogarsanchez.es/` | **HTTP 401** | 401 (sin cambios) |
| `citas.centrohogarsanchez.es/api/health` | **HTTP 200** | 200 (endpoint público) |

### 7.2. Test de Acceso con Autenticación

| Dominio | Con Cookie `chs_access_token` | Esperado |
|---------|------------------------------|----------|
| `rutas.centrohogarsanchez.es/` | **HTTP 200** | 200 (acceso permitido) |
| `aon.centrohogarsanchez.es/` | **HTTP 200** | 200 (acceso permitido) |
| `arana.centrohogarsanchez.es/` | **HTTP 307** | 307 (redirect Next.js interno — normal) |
| `proveedores.centrohogarsanchez.es/` | **HTTP 200** | 200 (acceso permitido) |
| `citas.centrohogarsanchez.es/` | **HTTP 200** | 200 (sin cambios) |

### 7.3. Health Checker Interno

El health checker de CHS Platform ejecuta comprobaciones cada 60 segundos desde dentro de la red Docker:

```
Citas Almacén      → online (2ms,  HTTP 200)
Route Optimizer    → online (18ms, HTTP 200)
Sistema AON v2.0   → online (34ms, HTTP 200)
Araña de Precios   → online (10ms, HTTP 200)
Portal Proveedores → online (2ms,  HTTP 200)
```

### 7.4. API Monitor

```json
{
  "totalApps": 7,
  "onlineApps": 5,
  "offlineApps": 2,
  "maintenanceApps": 0
}
```

Las 2 apps offline son las placeholders desactivadas (Amazon A+ Generator, Procesador de Medidas).

### 7.5. Verify-Access por Slug

Todas las apps responden correctamente al endpoint `/api/auth/verify-access?app=<slug>`:

```
verify-access?app=route-optimizer  → HTTP 200, X-CHS-Access-Level: full
verify-access?app=aon-polizas      → HTTP 200, X-CHS-Access-Level: full
verify-access?app=arana-precios    → HTTP 200, X-CHS-Access-Level: full
verify-access?app=proveedores-api  → HTTP 200, X-CHS-Access-Level: full
verify-access?app=citas-almacen    → HTTP 200, X-CHS-Access-Level: full
```

### 7.6. Certificados TLS

Todos los dominios tienen certificados Let's Encrypt válidos:

```
platform.centrohogarsanchez.es     ✓
citas.centrohogarsanchez.es        ✓
rutas.centrohogarsanchez.es        ✓
aon.centrohogarsanchez.es          ✓
arana.centrohogarsanchez.es        ✓
proveedores.centrohogarsanchez.es  ✓
```

### 7.7. Tests Playwright

Se ejecutó la suite completa de 132 tests E2E:

```
tests/fase1.spec.ts         → 25/25 passed
tests/fase2.spec.ts         → 20/20 passed
tests/fase3.spec.ts         → 20/20 passed
tests/fase4.spec.ts         → 22/22 passed
tests/intro-video.spec.ts   →  5/5  passed
tests/app-integration.spec.ts → 20/20 passed
tests/ai-governance.spec.ts → 20/20 passed
────────────────────────────────────────
TOTAL                        132/132 passed
```

---

## 8. Configuración DNS

| Dominio | Tipo | Valor | Observación |
|---------|------|-------|-------------|
| `platform.centrohogarsanchez.es` | CNAME | localhost | Resuelve a 127.0.0.1 |
| `citas.centrohogarsanchez.es` | CNAME | localhost | Resuelve a 127.0.0.1 |
| `rutas.centrohogarsanchez.es` | CNAME | localhost | Resuelve a 127.0.0.1 |
| `aon.centrohogarsanchez.es` | CNAME | localhost | Resuelve a 127.0.0.1 |
| `arana.centrohogarsanchez.es` | A | 94.130.248.102 | IP pública directa |
| `proveedores.centrohogarsanchez.es` | A | 94.130.248.102 | IP pública directa |

> **Nota sobre hairpin NAT:** Los dominios que resuelven a la IP pública (94.130.248.102) no son accesibles desde el propio servidor vía curl por limitaciones de hairpin NAT. Los usuarios externos acceden normalmente. Los dominios con CNAME localhost funcionan desde el servidor y desde fuera.

---

## 9. Archivos de Configuración

### 9.1. Traefik Dynamic Configs

Ubicación: `/data/coolify/proxy/dynamic/`

| Archivo | Función | Estado |
|---------|---------|--------|
| `chs-v2-platform.yaml` | Router para `platform.centrohogarsanchez.es` | Existente |
| `chs-v2-citas-auth.yaml` | ForwardAuth middleware + routers para `citas.centrohogarsanchez.es` | Existente |
| `chs-v2-elias-auth.yaml` | Routers adicionales para `elias.centrohogarsanchez.es` | Existente |
| `chs-v2-rutas-auth.yaml` | ForwardAuth para `rutas.centrohogarsanchez.es` | **Nuevo** |
| `chs-v2-aon-auth.yaml` | ForwardAuth para `aon.centrohogarsanchez.es` | **Nuevo** |
| `chs-v2-arana-auth.yaml` | ForwardAuth para `arana.centrohogarsanchez.es` | **Nuevo** |
| `proveedores-chs-auth.yaml` | ForwardAuth para `proveedores.centrohogarsanchez.es` | Existente |
| `route-optimizer.yaml.disabled` | Config antigua sin ForwardAuth | **Desactivado** |
| `proveedores-aleph-auth.yaml.disabled` | Config antigua (pre-rebrand) | Desactivado |

### 9.2. Código Fuente Relevante

| Archivo | Función |
|---------|---------|
| `apps/platform/src/app/api/auth/verify-access/route.ts` | Endpoint ForwardAuth — valida token, identifica app, verifica permisos |
| `apps/platform/src/lib/health-checker.ts` | Health checker que monitorea apps cada 60s |
| `apps/platform/src/app/api/monitor/services/route.ts` | API de estado de servicios |
| `apps/platform/src/app/api/monitor/overview/route.ts` | API de resumen del monitor |
| `packages/db/src/schema/index.ts` | Esquema DB (apps, app_instances, app_access_policies) |

---

## 10. Consideraciones Operativas

### 10.1. Redeploy de Contenedores Coolify

Cuando Coolify redespliega AON o Araña, el sufijo numérico del contenedor cambia. Esto afecta:

1. **URLs internas en DB** (`app_instances.internal_url`): Deben actualizarse para que el health checker encuentre el contenedor.
2. **Traefik file providers para AON y Araña**: Usan `@docker` service references que se actualizan automáticamente — **no requieren cambio manual**.
3. **Docker labels de Coolify**: Se recrean automáticamente — el servicio Docker se re-registra en Traefik.

**Acción requerida tras redeploy:** Actualizar `internal_url` en `app_instances` para la app redeployada.

### 10.2. Servicios que NO Requieren Acción tras Redeploy

- **Route Optimizer**: Nombre de contenedor estable (`route-optimizer-phase6`)
- **Portal Proveedores**: Alias DNS estable (`proveedores-api`)
- **Citas Almacén**: Nombre estable si no se redespliega por Coolify

### 10.3. Añadir una Nueva Aplicación

Para integrar una nueva app con SSO:

1. Registrar la app en la tabla `apps` con su slug y categoría
2. Crear instancia en `app_instances` con `internal_url`, `external_domain`, y `health_endpoint`
3. Crear políticas en `app_access_policies` para los departamentos correspondientes
4. Crear archivo YAML en `/data/coolify/proxy/dynamic/chs-v2-<nombre>-auth.yaml`
5. Configurar DNS para el nuevo subdominio
6. Traefik recargará automáticamente (file watch)

---

## 11. Resumen de Cambios Realizados

### Base de Datos

- Corregidas 3 URLs internas que no apuntaban a contenedores reales
- Añadidos 2 dominios externos a apps existentes (Route Optimizer, AON)
- Creadas 2 apps nuevas (Araña de Precios, Portal Proveedores) con instancias y políticas
- Desactivadas 2 apps placeholder (Amazon A+ Generator, Procesador de Medidas)
- Creadas 6 políticas de acceso para las apps nuevas

### Traefik

- Creados 3 archivos YAML de ForwardAuth (rutas, aon, arana)
- Verificado archivo existente de Proveedores
- Desactivado config antiguo de Route Optimizer sin ForwardAuth

### Sin Cambios en Código Fuente

No se modificó ningún archivo del código fuente de CHS Platform. Toda la configuración es infraestructura (Traefik YAML + datos DB).

---

## 12. Diagrama de Red Final

```
                        Internet
                           │
                    ┌──────┴──────┐
                    │   Traefik   │  :80 (HTTP→HTTPS redirect)
                    │  (Coolify)  │  :443 (HTTPS + TLS termination)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────────────────────────────────┐
              │            │                                        │
    ForwardAuth            │                             Docker labels
    (file provider)        │                             (Coolify provider)
              │            │                                        │
    ┌─────────┴────────────┴───────────────────────┐     ┌──────────┴───────┐
    │                                              │     │                  │
    │  chs-v2-forward-auth middleware              │     │  sslip.io        │
    │  → http://chs-platform:3000/api/auth/...     │     │  domains         │
    │                                              │     │  (dev access)    │
    └──────────────────────────────────────────────┘     └──────────────────┘
              │
    ┌─────────┴────────────┐
    │ verify-access:       │
    │  1. Extrae cookie    │
    │  2. Verifica JWT     │
    │  3. Busca app        │
    │  4. Verifica acceso  │
    │  5. Inyecta headers  │
    └─────────┬────────────┘
              │
    ┌─────────┴──────────────────────────────────────────────────────┐
    │                                                                │
    ▼                    ▼                  ▼              ▼          ▼
┌────────┐     ┌──────────────┐    ┌───────────┐   ┌────────┐  ┌──────────┐
│ Citas  │     │    Route     │    │    AON    │   │ Araña  │  │Proveedores│
│ :5000  │     │  Optimizer   │    │   :3000   │   │ :3000  │  │  :3010   │
│        │     │    :8000     │    │           │   │        │  │          │
└────────┘     └──────────────┘    └───────────┘   └────────┘  └──────────┘

Red: coolify (todos los contenedores)
```
