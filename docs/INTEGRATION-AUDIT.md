# Auditoría de Integración: Usuarios e IA

**Fecha:** 2026-03-15
**Alcance:** Integración SSO (ForwardAuth + X-CHS-* headers) y claves de IA entre CHS Platform v2 y las 7 aplicaciones activas.

---

## Tabla 1 — Usuarios (SSO / ForwardAuth)

| App | SSO endpoint | Lee X-CHS-* | Usuarios propios | Double login | Nombre CHS en UI |
|-----|-------------|-------------|-----------------|-------------|------------------|
| **Citas Almacén** | `GET /api/auth/sso` ✅ | Sí (`x-chs-user-id`, `x-chs-user-name`) | Sí — BD `eliasortega`, tabla Prisma `User`. Usuarios sintéticos con email `chs-{uuid}@sso.centrohogarsanchez.es` | No — SSO auto-login funciona | Sí — muestra nombre del header |
| **Route Optimizer** | `GET /api/auth/sso` ✅ | Sí (`x-chs-user-id`, `x-chs-user-name`, `x-chs-role`) | Sí — BD `optimizer_db`, tabla `users` (5 usuarios). Crea usuario local en primer SSO login | No — SSO auto-login funciona | Sí — `soufiane.mellak` visible |
| **Sistema AON** | `GET /api/auth/sso` ✅ | Sí (`x-chs-user-id`, `x-chs-user-name`, `x-chs-role`) | Sí — BD `aon_db`, tabla `users` (3 usuarios). Sesión iron-session 7d | No — SSO auto-login funciona | Sí — `soufiane.mellak` visible |
| **Araña de Precios** | `GET /api/auth/sso` → 404 ❌ | Parcial — código compilado contiene referencias a `x-chs-*` headers, pero endpoint SSO no existe | Sí — BD `arana_precios` propia | Sí — ForwardAuth protege acceso, pero no hay auto-login SSO | No — sin endpoint SSO activo |
| **Portal Proveedores** | `GET /api/proveedores/auth/sso` ✅ | Sí (`X-CHS-User-Id`, `X-CHS-User-Name`, `X-CHS-Role`, `X-CHS-User-Email`, `X-CHS-Dept`) + legacy `X-Aleph-*` | Sí — BD `chs_platform` compartida, tabla `proveedores.sso_users`. También tiene `public.users` con auth propia (bcrypt) | Potencial — tiene `/api/proveedores/auth/login` con password propio además de SSO | Sí — mapea roles CHS a roles locales |
| **Cuadro de Dirección** | No existe ❌ | No | No — usa BD `chs_platform` compartida (credenciales de Route Optimizer) | Sí — sin SSO, depende solo de ForwardAuth para protección | No |
| **Procesador de Medidas** | No existe ❌ | No | No — sin `DATABASE_URL`, sin tabla de usuarios | Sí — sin SSO, depende solo de ForwardAuth para protección | No |

### Notas sobre usuarios

- **Citas Almacén** genera emails sintéticos (`chs-{uuid}@sso.centrohogarsanchez.es`) porque el header `x-chs-user-email` no siempre está presente.
- **Route Optimizer** y **AON** usan el mismo patrón: leen headers, crean usuario local con password aleatorio (nunca usado), mapean roles (`super-admin`/`dept-admin` → admin, otros → operator/viewer).
- **Proveedores** lee headers tanto del sistema nuevo (`X-CHS-*`) como del legacy (`X-Aleph-*`) para compatibilidad con la migración v1→v2.
- **Araña** tiene código que referencia `x-chs-*` headers en el bundle compilado, pero el endpoint `/api/auth/sso` devuelve 404. Probablemente el endpoint fue eliminado o nunca se desplegó.
- **Cuadro** y **Medidas** no tienen ningún mecanismo SSO propio — dependen exclusivamente de ForwardAuth de Traefik para control de acceso. El usuario ve la app directamente si ForwardAuth lo permite, pero la app no sabe quién es el usuario.

---

## Tabla 2 — IA (API Keys y Modelos)

| App | Proveedor | API key presente | Key válida | Uso de IA | Notas |
|-----|-----------|-----------------|-----------|-----------|-------|
| **Citas Almacén** | Anthropic | Sí — `ANTHROPIC_API_KEY` ✅ | Sí (misma key que la plataforma) | Chat público "Elias" — agente conversacional para gestión de citas | Key compartida con CHS Platform |
| **Route Optimizer** | Google | Sí — `GEMINI_API_KEY` ✅ | Sí | Agente OptiRoute para consultas de rutas y pedidos | También tiene `GOOGLE_MAPS_API_KEY` para geocoding/routing |
| **Sistema AON** | — | No ❌ | N/A | Sin IA | La plataforma define un agente AON, pero la app no tiene key propia |
| **Araña de Precios** | — | No ❌ | N/A | Tiene rutas `/api/agent` y `/api/assistant` | Endpoints existen pero sin API key configurada — llamadas IA fallarán |
| **Portal Proveedores** | Anthropic | No ❌ | N/A | Clasificador de documentos AI (`ai-classifier.js`) usa `claude-sonnet-4-20250514` | **BUG**: Código referencia Anthropic pero `ANTHROPIC_API_KEY` no está en las variables de entorno del contenedor — clasificador fallará en runtime |
| **Cuadro de Dirección** | — | No ❌ | N/A | Sin IA | La plataforma define un agente Dashboard, pero la app no tiene key propia |
| **Procesador de Medidas** | — | No ❌ | N/A | Sin IA | La plataforma define un agente Medidas, pero la app no tiene key propia |

### Notas sobre IA

- La **CHS Platform** define agentes para las 7 apps (Elias, OptiRoute, AON, Araña, Proveedores, Dashboard, Medidas), pero las llamadas a herramientas (`POST {internal_url}/api/agent`) solo funcionan si la app destino tiene el endpoint implementado.
- **Proveedores** tiene un bug crítico: el código `ai-classifier.js` importa y usa el SDK de Anthropic con modelo `claude-sonnet-4-20250514`, pero la variable `ANTHROPIC_API_KEY` no está configurada en el contenedor. Cualquier intento de clasificación de documentos fallará con error de autenticación.
- **Araña** tiene endpoints `/api/agent` y `/api/assistant` en su código compilado que leen headers `x-chs-*`, pero sin API key configurada las llamadas a modelos de IA no pueden funcionar.
- **AON**, **Cuadro** y **Medidas** no tienen ninguna funcionalidad de IA propia. Los agentes definidos en la plataforma para estas apps necesitarán que las apps implementen el endpoint `/api/agent` con las herramientas (capabilities) correspondientes.

---

## Conclusiones

**SSO completo (sin double login):** Citas Almacén, Route Optimizer y Sistema AON tienen integración SSO funcional — el usuario accede al subdominio y entra automáticamente sin ver formulario de login.

**SSO parcial o ausente:** Araña de Precios tiene código de headers pero endpoint SSO roto (404). Proveedores tiene SSO funcional pero también mantiene su propio login con passwords (potencial double login). Cuadro de Dirección y Procesador de Medidas no tienen SSO — dependen exclusivamente de ForwardAuth para protección, pero la app no identifica al usuario.

**Acciones recomendadas — Usuarios:**
1. **Araña**: Implementar o reparar el endpoint `/api/auth/sso` para eliminar el double login.
2. **Proveedores**: Verificar si el login propio (`/api/proveedores/auth/login`) sigue siendo necesario o si se puede desactivar en favor del SSO.
3. **Cuadro y Medidas**: Implementar endpoint `/api/auth/sso` para que las apps identifiquen al usuario autenticado vía headers X-CHS-*.

**Acciones recomendadas — IA:**
1. **Proveedores (URGENTE)**: Añadir `ANTHROPIC_API_KEY` a las variables de entorno del contenedor para que el clasificador de documentos funcione.
2. **Araña**: Decidir si los endpoints `/api/agent` y `/api/assistant` deben funcionar. Si sí, configurar la API key correspondiente (Google o Anthropic).
3. **AON, Cuadro, Medidas**: Implementar endpoint `/api/agent` con las herramientas definidas en la plataforma si se desea activar los agentes de IA para estas apps.

---

*Informe generado como parte de la auditoría de integración CHS Platform v2.*
