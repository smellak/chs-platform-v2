# Auditoría de Doble Login — Apps tras ForwardAuth CHS Platform

**Fecha:** 9 de marzo de 2026
**Objetivo:** Identificar qué apps muestran su propio panel de login al usuario después de pasar el ForwardAuth de CHS Platform. El usuario NUNCA debería ver un segundo login.

---

## Resumen Ejecutivo

| App | Segundo login visible? | SSO integrado? | Acción requerida |
|-----|----------------------|----------------|-----------------|
| Citas Almacén (Elias) | **NO** | Si — auto-SSO funcional | Ninguna |
| Route Optimizer | **SI** | No tiene SSO | **Requiere integración SSO** |
| Sistema AON | **NO** | No necesita (sin auth propia) | Ninguna |
| Araña de Precios | **NO** | No necesita (sin auth propia) | Ninguna |
| Portal Proveedores | **NO** | Si — auto-SSO funcional | Ninguna |

**Resultado:** Solo **Route Optimizer** presenta un segundo login al usuario.

---

## 1. Citas Almacén (Elias) — SIN SEGUNDO LOGIN

### Comportamiento

1. Usuario accede a `citas.centrohogarsanchez.es`
2. Traefik ForwardAuth valida el token CHS e inyecta headers `X-CHS-*`
3. El SPA de Elias carga y detecta que está en dominio `citas.centrohogarsanchez.es`
4. Llama automáticamente a `fetch("/api/auth/sso")` — Traefik inyecta los headers CHS en esta petición
5. El backend de Elias lee los `X-CHS-*` headers y crea una sesión local (JWT propio)
6. El SPA guarda el token en `localStorage` y muestra el dashboard directamente

### Evidencia

```
GET /api/auth/sso (sin headers)  → HTTP 401 {"error":"No CHS authentication headers"}
GET /api/auth/sso (con X-CHS-*) → HTTP 200 {"token":"eyJ...","user":{...}}
```

Código JS del SPA:
```javascript
fetch("/api/auth/sso").then(g => {
  if (!g.ok) throw new Error("SSO failed");
  return g.json();
}).then(g => {
  wp(g.token);           // Guarda token en localStorage
  jp(g.refreshToken);    // Guarda refresh token
  n(g.user);             // Actualiza estado del usuario
}).catch(() => {
  // Fallback: redirige a CHS Platform login
  window.location.href = `https://platform.centrohogarsanchez.es/login?redirect=...`;
});
```

### Flujo de fallback

Si el SSO falla (ej: headers no llegan), Elias redirige a `platform.centrohogarsanchez.es/login?redirect=<url_actual>` — el usuario vuelve a CHS Platform, se autentica, y se le devuelve a Elias.

### Veredicto: Funciona correctamente. Sin acción necesaria.

---

## 2. Route Optimizer — SEGUNDO LOGIN VISIBLE

### Comportamiento

1. Usuario accede a `rutas.centrohogarsanchez.es`
2. Traefik ForwardAuth valida el token CHS e inyecta headers `X-CHS-*`
3. El SPA de Next.js carga y ejecuta: `localStorage.getItem("token")`
4. Como no hay token en localStorage (primera visita), el SPA redirige a `/login`
5. **El usuario ve el formulario de login de Route Optimizer** (username + password)

### Evidencia

```
GET /api/auth/sso       → HTTP 404 {"ok":false,"message":"API endpoint not found"}
GET /api/auth/me        → HTTP 401 {"detail":"Token expirado o inválido"}
POST /api/auth/login    → HTTP 200 {"ok":true,"token":"eyJ..."}  (auth propia)
GET /login              → HTTP 200 (página de login con formulario)
```

Código JS del SPA (root page):
```javascript
useEffect(() => {
  localStorage.getItem("token")
    ? e.replace("/dashboard")   // Si hay token → dashboard
    : e.replace("/login")       // Si no hay token → LOGIN PROPIO
}, [e]);
```

### Endpoints de auth propios

| Endpoint | Método | Función |
|----------|--------|---------|
| `/api/auth/login` | POST | Login con username/password → devuelve JWT |
| `/api/auth/me` | GET | Verificar sesión (necesita header `Authorization: Bearer <token>`) |
| `/api/auth/sso` | — | **NO EXISTE** (404) |

### Veredicto: Requiere integración SSO.

### Recomendación

Crear un endpoint `/api/auth/sso` en Route Optimizer que:
1. Lea los headers `X-CHS-*` inyectados por Traefik
2. Cree o actualice un usuario local basado en `X-CHS-User-Id`, `X-CHS-User-Name`, `X-CHS-Role`
3. Devuelva un JWT local que el SPA almacene en `localStorage`

Además, modificar el SPA para que:
1. Antes de redirigir a `/login`, intente llamar a `fetch("/api/auth/sso")`
2. Si tiene éxito, guarde el token y vaya al dashboard
3. Si falla, redirija a `platform.centrohogarsanchez.es/login?redirect=<url_actual>`

**Patrón de referencia:** Copiar la implementación de Elias (`/api/auth/sso`) que ya funciona correctamente con los mismos headers.

---

## 3. Sistema AON v2.0 — SIN SEGUNDO LOGIN

### Comportamiento

1. Usuario accede a `aon.centrohogarsanchez.es`
2. Traefik ForwardAuth valida y deja pasar
3. El SPA de AON carga directamente el dashboard/contenido principal
4. **No hay sistema de autenticación propio** — la app no tiene login, ni verifica sesiones

### Evidencia

```
GET /         → HTTP 200 (SPA shell → carga dashboard directamente)
GET /login    → HTTP 404
GET /api/auth/sso     → HTTP 404
GET /api/auth/me      → HTTP 404
GET /api/auth/session → HTTP 404
GET /dashboard        → HTTP 307 → / (redirect a raíz)
```

El análisis de los 6 JS bundles de AON no encontró ninguna referencia a `login`, `isAuthenticated`, `authToken`, `localStorage.token`, ni ningún patrón de autenticación.

### Veredicto: Funciona correctamente. La app confía completamente en que Traefik/ForwardAuth ya validó al usuario. Sin acción necesaria.

---

## 4. Araña de Precios — SIN SEGUNDO LOGIN

### Comportamiento

1. Usuario accede a `arana.centrohogarsanchez.es`
2. Traefik ForwardAuth valida y deja pasar
3. La app redirige `/` → `/import` (HTTP 307) — esta es la página principal
4. **No hay sistema de autenticación propio**

### Evidencia

```
GET /         → HTTP 307 → /import (redirect a página de importación)
GET /login    → HTTP 404
GET /api/auth/sso → HTTP 404
GET /api/auth/me  → HTTP 404
GET /dashboard    → HTTP 200 (panel principal)
GET /api/health   → HTTP 404 (no tiene health endpoint)
```

El JS tiene referencias a `Session` y `zustand persist`, pero son para estado de la aplicación (gestión de datos importados), no para autenticación.

### Veredicto: Funciona correctamente. Sin acción necesaria.

---

## 5. Portal Proveedores — SIN SEGUNDO LOGIN

### Comportamiento

1. Usuario accede a `proveedores.centrohogarsanchez.es`
2. El frontend SPA es público (no pasa por ForwardAuth en la carga inicial)
3. El SPA detecta que está en dominio `proveedores.centrohogarsanchez.es`
4. Llama automáticamente a `fetch("/api/proveedores/auth/sso", {credentials: "include"})` — la cookie `chs_access_token` va incluida, Traefik aplica ForwardAuth en esta ruta, inyecta `X-CHS-*`
5. El backend lee los headers CHS y crea sesión local
6. El SPA guarda el token y muestra el dashboard

### Evidencia

```
GET /api/proveedores/auth/sso (sin headers)  → HTTP 401 {"error":"SSO headers missing"}
GET /api/proveedores/auth/sso (con X-CHS-*)  → HTTP 200 {"token":"eyJ...","user":{...}}
```

Código JS del SPA:
```javascript
// Detecta dominio de producción
if (hostname === "proveedores.centrohogarsanchez.es") {
  fetch("/api/proveedores/auth/sso", { credentials: "include" })
    .then(v => {
      if (!v.ok) throw new Error("SSO failed");
      return v.json();
    })
    .then(v => {
      gx(v.token);    // Guarda token local
      t(v.user);       // Actualiza usuario
    })
    .catch(() => {
      // Fallback: redirige a CHS Platform login
      window.location.href = `https://platform.centrohogarsanchez.es/login?redirect=...`;
    });
}
```

### Flujo especial

Proveedores tiene una configuración de ForwardAuth más granular:
- **Frontend SPA** (`/`, `/dashboard`, etc.): Público — se carga sin auth
- **API protegida** (`/api/proveedores/*`): ForwardAuth — inyecta headers CHS
- **API pública** (`/api/proveedores/health`, `/auth`, `/portal`): Sin auth

El SSO funciona porque la llamada `fetch("/api/proveedores/auth/sso")` pasa por ForwardAuth (es una ruta `/api/proveedores/*` protegida), que inyecta los headers CHS antes de llegar al backend.

### Veredicto: Funciona correctamente. Sin acción necesaria.

---

## Resumen de Acciones

| Prioridad | App | Acción |
|-----------|-----|--------|
| **ALTA** | Route Optimizer | Implementar endpoint `/api/auth/sso` que lea headers `X-CHS-*` y cree sesión local. Modificar SPA para intentar SSO antes de redirigir a `/login`. |
| Ninguna | Citas Almacén | SSO auto-login ya funciona. |
| Ninguna | Sistema AON | No tiene auth propia; ForwardAuth es suficiente. |
| Ninguna | Araña de Precios | No tiene auth propia; ForwardAuth es suficiente. |
| Ninguna | Portal Proveedores | SSO auto-login ya funciona. |

---

## Diagrama: Flujo SSO por App

```
                   CHS Platform ForwardAuth
                          │
              ┌───────────┼───────────────────────┐
              │           │                       │
         Con SSO propio   │              Sin auth propia
         (auto-login)     │              (acceso directo)
              │           │                       │
     ┌────────┴────┐      │              ┌────────┴────────┐
     │             │      │              │                 │
   Elias    Proveedores   │            AON             Araña
  (funciona) (funciona)   │         (funciona)       (funciona)
                          │
                   Con auth propia
                   SIN SSO
                          │
                   Route Optimizer
                   (SEGUNDO LOGIN)
```

---

## Apéndice: Implementación SSO Recomendada para Route Optimizer

### Backend: Nuevo endpoint `/api/auth/sso`

```python
# Pseudocódigo basado en la arquitectura FastAPI de Route Optimizer
@router.get("/api/auth/sso")
async def sso_login(request: Request):
    user_id = request.headers.get("X-CHS-User-Id")
    user_name = request.headers.get("X-CHS-User-Name")
    user_email = request.headers.get("X-CHS-User-Email")
    role = request.headers.get("X-CHS-Role")
    dept = request.headers.get("X-CHS-Dept")

    if not user_id:
        raise HTTPException(401, "No CHS authentication headers")

    # Buscar o crear usuario local
    user = await find_or_create_sso_user(user_id, user_name, user_email, role, dept)

    # Generar JWT local
    token = create_token({"user_id": user.id, "username": user.username, "role": user.role})

    return {"token": token, "user": user.to_dict()}
```

### Frontend: Modificar lógica de auth en el SPA

```javascript
// Antes (actual):
useEffect(() => {
  localStorage.getItem("token")
    ? router.replace("/dashboard")
    : router.replace("/login")
}, []);

// Después (con SSO):
useEffect(() => {
  if (localStorage.getItem("token")) {
    router.replace("/dashboard");
    return;
  }

  // Intentar SSO automático
  fetch("/api/auth/sso")
    .then(res => {
      if (!res.ok) throw new Error("SSO failed");
      return res.json();
    })
    .then(data => {
      localStorage.setItem("token", data.token);
      router.replace("/dashboard");
    })
    .catch(() => {
      // Redirigir a CHS Platform login
      window.location.href =
        `https://platform.centrohogarsanchez.es/login?redirect=${encodeURIComponent(window.location.href)}`;
    });
}, []);
```

### Traefik: Añadir `/api/auth/sso` como ruta pública protegida

Actualizar `chs-v2-rutas-auth.yaml` para que `/api/auth/sso` pase por ForwardAuth (actualmente ya lo hace como parte del catch-all protegido, así que no requiere cambio en Traefik).
