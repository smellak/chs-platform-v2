# DESIGN AUDIT: CHS Platform vs Aleph Platform

**Fecha:** 2026-03-07
**Autor:** Auditoría automatizada con Playwright + análisis de código fuente
**Objetivo:** Documentar exhaustivamente las diferencias visuales y de diseño entre CHS Platform (referencia) y Aleph Platform (a corregir)

---

## 1. Resumen Ejecutivo

Aleph Platform replica la arquitectura funcional de CHS Platform pero presenta diferencias significativas en la capa visual. Ambas plataformas comparten la misma base tecnológica (Next.js 15, Tailwind CSS, shadcn/ui, Radix UI, next-themes), pero CHS tiene un sistema de diseño más maduro y pulido.

### Diferencias Críticas Detectadas

| Área | CHS Platform | Aleph Platform | Impacto |
|------|-------------|----------------|---------|
| **Color primario** | `#1976D2` (HSL 210 79% 46%) | `#2563eb` en código, `#0D47A1` en CSS vars | Inconsistencia interna |
| **Tipografía** | Inter + Open Sans (dual) | Solo Inter | Menor riqueza tipográfica |
| **Glassmorphism** | blur(16px) sat(180%), bg 12% | blur(12px), bg 6% | Efecto glass más débil |
| **Animaciones** | Framer Motion + CSS stagger (8 niveles) | Solo CSS pulse-dot | Sin animaciones de entrada |
| **App cards hover** | translateY(-4px) + shadow + icon scale | Sólo shadow-md | Interactividad pobre |
| **Dept. icon gradients** | Gradientes 135° completos por color | Opacidad `color40→color20` | Menos vibrante |
| **Login** | Custom CSS classes, blur(40px), partículas | Clases Tailwind, blur(12px), 3 dots | Menos premium |
| **Elevation system** | hover-elevate, active-elevate, toggle-elevate | No existe | Sin sistema de profundidad |
| **Branding** | "SANCHEZ" + "PORTAL CORPORATIVO" | "ALEPH" + "Portal Corporativo" | Texto y logo diferentes |

---

## 2. Paleta de Colores

### 2.1 Variables CSS — Modo Claro

| Variable | CHS | Aleph | ¿Coincide? |
|----------|-----|-------|------------|
| `--background` | `0 0% 98%` (#FAFAFA) | `0 0% 98%` (#F7F7F7) | ✅ Sí |
| `--foreground` | `210 6% 13%` (#1F2124) | `210 6% 13%` (#1F2937) | ✅ Sí |
| `--card` | `0 0% 100%` (#FFFFFF) | `0 0% 100%` (#FFFFFF) | ✅ Sí |
| `--card-foreground` | `210 6% 13%` | `210 6% 13%` | ✅ Sí |
| `--primary` | `210 79% 46%` (#1976D2) | `210 79% 46%` (#0D47A1) | ✅ Sí |
| `--primary-foreground` | `0 0% 98%` | `0 0% 98%` | ✅ Sí |
| `--secondary` | `210 6% 91%` | `210 6% 91%` | ✅ Sí |
| `--muted` | `210 5% 93%` | `210 5% 93%` | ✅ Sí |
| `--muted-foreground` | `210 5% 38%` | `210 5% 38%` | ✅ Sí |
| `--accent` | `210 6% 94%` | `210 6% 94%` | ✅ Sí |
| `--destructive` | `0 84% 60%` (#EF4444) | `0 84% 60%` (#EF4444) | ✅ Sí |
| `--border` | `210 4% 89%` | `210 4% 89%` | ✅ Sí |
| `--input` | `210 6% 75%` | `210 6% 75%` | ✅ Sí |
| `--ring` | `210 79% 46%` | `210 79% 46%` | ✅ Sí |

### 2.2 Variables CSS — Modo Oscuro

| Variable | CHS | Aleph | ¿Coincide? |
|----------|-----|-------|------------|
| `--background` | `210 11% 15%` (#222730) | `210 11% 15%` (#1A202C) | ✅ Sí |
| `--foreground` | `210 6% 93%` (#EAEBED) | `210 6% 93%` (#EEEEF2) | ✅ Sí |
| `--card` | `210 11% 17%` (#272C36) | `210 11% 17%` (#1E293B) | ✅ Sí |
| `--border` | `210 8% 24%` (#373D49) | `210 8% 24%` (#334155) | ✅ Sí |
| `--muted` | `210 10% 22%` (#333846) | `210 10% 22%` (#30384F) | ✅ Sí |
| `--muted-foreground` | `210 6% 70%` (#AAACB0) | `210 6% 70%` (#A1AAB8) | ✅ Sí |

> **Conclusión colores:** Las variables CSS base son idénticas. Las diferencias están en los colores hardcodeados en componentes.

### 2.3 Colores de Marca Específicos

| Color | CHS | Aleph | Corrección |
|-------|-----|-------|------------|
| Azul Profundo (Navy Deep) | `#0a1628` | `#0a1628` | ✅ Igual |
| Azul 900 | `#0D47A1` | `#0D47A1` | ✅ Igual |
| Azul 800 | `#1565C0` | `#1565C0` | ✅ Igual |
| Azul 700 | `#1976D2` | `#1976D2` | ✅ Igual |
| Azul 400 (Accents) | `#42A5F5` | No usado | ❌ Añadir |
| Azul 500 (Glow) | `#2196F3` | No usado | ❌ Añadir |
| Indigo Deep | `#1A237E` | `#1A237E` | ✅ Igual |
| Navy Dark | `#0d2847` | `#0d2847` | ✅ Igual |
| Navy Medium | `#134a8a` | `#134a8a` | ✅ Igual |

### 2.4 Colores de Estado

| Estado | CHS | Aleph | ¿Coincide? |
|--------|-----|-------|------------|
| Online/Operativo | `#10b981` (emerald) | `#10B981` (emerald) | ✅ Sí |
| Offline | `#ef4444` (red) | `#EF4444` (red) | ✅ Sí |
| Degradado | `#f59e0b` (amber) | `#F59E0B` (amber) | ✅ Sí |
| Mantenimiento | `#3b82f6` (blue) | `#3B82F6` (blue) | ✅ Sí |
| Sin datos | — | `#9E9E9E` (gray) | N/A |

### 2.5 Colores de Gráficos (Chart)

| Chart | CHS Light | CHS Dark | Aleph |
|-------|----------|----------|-------|
| chart-1 | `210 79% 46%` | `210 79% 65%` | Verificar |
| chart-2 | `122 39% 49%` | `122 39% 65%` | Verificar |
| chart-3 | `36 100% 50%` | `36 100% 65%` | Verificar |
| chart-4 | `271 91% 65%` | `271 91% 75%` | Verificar |
| chart-5 | `339 82% 52%` | `339 82% 68%` | Verificar |

### 2.6 Colores de Proveedores IA (Monitor)

| Proveedor | CHS | Aleph |
|-----------|-----|-------|
| Anthropic | `#D97706` (Amber) | Verificar |
| OpenAI | `#10B981` (Emerald) | Verificar |
| Google/Gemini | `#3B82F6` (Blue) | Verificar |
| Replicate | `#8B5CF6` (Violet) | Verificar |
| Flux | `#EC4899` (Pink) | Verificar |
| Default | `#6B7280` (Gray) | Verificar |

---

## 3. Tipografía

### 3.1 Familias de Fuentes

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| `--font-sans` | `Open Sans, sans-serif` | `Inter, ui-sans-serif, system-ui, sans-serif` | ❌ Cambiar a Open Sans como body |
| Headings | Inter (Google Fonts) | Inter | ✅ Igual |
| Body | Open Sans (Google Fonts) | Inter | ❌ Añadir Open Sans |
| Mono | Menlo | Tailwind defaults | ❌ Añadir Menlo |

### 3.2 Tamaños y Pesos por Elemento

| Elemento | CHS Font | CHS Size | CHS Weight | CHS Spacing | Aleph | Corrección |
|----------|----------|----------|------------|-------------|-------|------------|
| h1 (título página) | Inter | 30px (text-3xl) | 700 | — | Similar | Verificar |
| h2 (título sección) | Inter | 24px (text-2xl) | 700 | — | Similar | Verificar |
| h3 (título card) | Inter | 16px (text-base) | 700 | — | font-semibold | ❌ Cambiar a font-bold |
| Subtítulo | Open Sans | 14px (text-sm) | 400 | — | Inter text-sm | ❌ Cambiar font |
| Login labels | Inter | 11px | 600 | 1.5px uppercase | No tiene | ❌ Añadir clase .chs-login-label |
| Login button | Inter | 13px | 700 | 2px uppercase | font-medium | ❌ Cambiar a 700, uppercase, 2px |
| Badge/Meta | Inter | 10px | 500-600 | wider uppercase | text-xs | ❌ Cambiar a text-[10px] |
| Stats KPI | Inter | 30px | 700 | — | Similar | Verificar |
| Nav Tabs | Inter | 12px (text-xs) | 600 | wider uppercase | Similar | ✅ OK |
| Navbar brand | Open Sans | 14px (text-sm) | 600 | wide | Inter text-sm font-bold | ❌ Fuente y peso |
| Cmd+K text | Default | text-sm | 400 | — | Similar | ✅ OK |

---

## 4. Logo y Branding

### 4.1 Texto de Marca Visible

| Ubicación | CHS | Aleph |
|-----------|-----|-------|
| Navbar logo | "SANCHEZ" (img logo.svg) | "ALEPH" (texto + Z icon SVG) |
| Navbar subtítulo | "PORTAL CORPORATIVO" | "Portal Corporativo" |
| Login título | "SANCHEZ" + logo | "Aleph Platform" |
| Login subtítulo | "PORTAL CORPORATIVO" | — |
| Login footer | — | "Aleph Platform v1.0" |
| Page title | "CHS Platform" | "Aleph Platform" |
| Agent nombre | "Agente CHS" | "Agente Aleph" |

### 4.2 TODAS las Referencias a "Aleph" en el Código Fuente

A continuación se listan **TODAS** las ocurrencias de "Aleph"/"aleph" en `src/` que deberán ser renombradas:

#### Branding & UI (11 ocurrencias)

| Archivo | Línea | Texto | Categoría |
|---------|-------|-------|-----------|
| `src/components/navbar.tsx` | 61 | `"ALEPH"` — texto logo navbar | UI visible |
| `src/app/(auth)/login/page.tsx` | 62 | `"Aleph Platform"` — alt text logo | UI visible |
| `src/app/(auth)/login/page.tsx` | 151 | `"Aleph Platform v1.0"` — footer | UI visible |
| `src/app/layout.tsx` | 12 | `title: "Aleph Platform"` — page title | UI visible |
| `src/app/(dashboard)/layout.tsx` | 29 | `orgName: "Aleph Platform"` — fallback | UI visible |
| `src/components/agent/agent-panel.tsx` | 200 | `"Agente Aleph"` — panel heading | UI visible |
| `src/components/agent/agent-button.tsx` | 16 | `aria-label="Agente Aleph"` — accessibility | UI visible |
| `src/i18n/es.ts` | 306 | `"Agente Aleph"` — traducción | i18n |
| `src/i18n/en.ts` | 308 | `"Aleph Agent"` — translation | i18n |
| `src/app/api/auth/sso-info/route.ts` | 5 | `platform: "Aleph"` — SSO info | API |
| `src/lib/agent/system-prompt.ts` | 75 | `"Eres el Agente Aleph..."` — AI prompt | Backend |

#### API Keys & Tokens (3 ocurrencias)

| Archivo | Línea | Texto |
|---------|-------|-------|
| `src/lib/actions/api-keys.ts` | 31 | `aleph_sk_{randomBytes}` — API key prefix |
| `src/app/api/api-keys/route.ts` | 48 | `aleph_sk_{randomBytes}` — API key generation |
| `src/lib/auth.ts` | 9 | `"chs_access_token"` — cookie name |

#### Cookie Names (4 ocurrencias)

| Archivo | Línea | Texto |
|---------|-------|-------|
| `src/lib/auth.ts` | 9 | `"chs_access_token"` |
| `src/app/api/auth/logout/route.ts` | 31 | `"chs_access_token"` cookie |
| `src/app/api/auth/logout/route.ts` | 39 | `"chs_refresh_token"` cookie |
| `src/app/api/auth/refresh/route.ts` | 14 | `"chs_refresh_token"` cookie |

#### HTTP Headers (14 ocurrencias)

| Archivo | Línea | Header |
|---------|-------|--------|
| `src/middleware.ts` | 68 | `"x-chs-user-id"` |
| `src/middleware.ts` | 69 | `"x-chs-org-id"` |
| `src/app/api/search/route.ts` | 14 | `"x-chs-user-id"` |
| `src/app/api/agent/chat/route.ts` | 25 | `"x-chs-user-id"` |
| `src/app/api/agent/conversations/route.ts` | 7 | `"x-chs-user-id"` |
| `src/app/api/agent/conversations/route.ts` | 32 | `"x-chs-org-id"` |
| `src/app/api/agent/conversations/[id]/route.ts` | 14 | `"x-chs-user-id"` |
| `src/app/api/agent/conversations/[id]/route.ts` | 58 | `"x-chs-user-id"` |
| `src/app/api/agent/conversations/[id]/route.ts` | 103 | `"x-chs-user-id"` |
| `src/app/api/auth/verify-access/route.ts` | 300-306 | `X-CHS-*` response headers |

#### Infraestructura (8 ocurrencias)

| Archivo | Línea | Texto |
|---------|-------|-------|
| `src/lib/traefik-manager.ts` | 21 | `"aleph-app-{appSlug}.yaml"` — config filename |
| `src/lib/traefik-manager.ts` | 25 | `"aleph-forward-auth.yaml"` — auth config |
| `src/lib/traefik-manager.ts` | 40 | `"Auto-generated by Aleph Platform"` — comment |
| `src/lib/traefik-manager.ts` | 165 | `resolveAlephVerifyUrl()` — function name |
| `src/lib/traefik-manager.ts` | 166 | `process.env["ALEPH_INTERNAL_URL"]` — env var |
| `src/lib/actions/traefik.ts` | 50, 73 | `alephVerifyUrl` parameter |
| `src/app/api/apps/[id]/traefik-preview/route.ts` | 42 | `alephVerifyUrl` |

#### User-Agent (3 ocurrencias)

| Archivo | Línea | Texto |
|---------|-------|-------|
| `src/lib/traefik-manager.ts` | 157 | `"Aleph-ConnCheck/0.1"` |
| `src/lib/health-checker.ts` | 24 | `"Aleph-HealthChecker/0.1"` |
| `src/lib/actions/webhooks.ts` | 158 | `"Test webhook from Aleph Platform"` |

> **Total: 43 referencias** en el código fuente que contienen "Aleph" o "aleph".

---

## 5. Componentes — Comparación Detallada

### 5.1 Login Page

#### Background

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Tipo | 3 radial-gradient + base color | 4 capas (3 radial + 1 linear) | ⚠️ Similar pero diferente |
| Base | `#0a1628` solid | `linear-gradient(180deg, #0a1628, #0d1b2e)` | Aleph usa linear base |
| Radial 1 | `ellipse at 30% 20%, #134a8a` | `ellipse at 20% 50%, #0d2847` | ❌ Posición y color |
| Radial 2 | `ellipse at 70% 80%, #0d2847` | `ellipse at 80% 20%, #134a8a` | ❌ Posición invertida |
| Radial 3 | `ellipse at 50% 50%, #0d2847→#0a1628` | `ellipse at 50% 80%, #0d2847` | ❌ Posición diferente |
| Grid pattern | `60px × 60px, rgba(255,255,255,0.015)` | No tiene | ❌ Falta grid |
| Partículas | 28 partículas animadas, `#42A5F5`, 1-3px, 10-25s | 3 dots estáticos con pulse | ❌ Muy inferior |
| Background anim | `loginBgPulse` 15s | No tiene | ❌ Falta |

#### Login Card

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Max width | `max-w-[420px]` | `max-w-md` (448px) | ❌ Cambiar a 420px |
| Border radius | `20px` (custom) | `rounded-2xl` (16px) | ❌ Cambiar a 20px |
| Padding | `48px 40px 40px` (custom) | `p-8` (32px uniform) | ❌ Más padding top |
| Background | `rgba(10, 22, 40, 0.55)` | `rgba(255, 255, 255, 0.06)` | ❌ Color base diferente |
| Backdrop blur | `blur(40px)` | `blur(12px)` | ❌ Mucho menos blur |
| Border | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.1)` | ⚠️ Casi igual |
| Box shadow | triple shadow con glow azul | No tiene box-shadow | ❌ Falta shadow |

```
CHS box-shadow:
  0 4px 24px rgba(0,0,0,0.3),
  0 0 60px rgba(21,101,192,0.08),
  inset 0 1px 0 rgba(255,255,255,0.05)
```

#### Login Inputs

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Clase | `.chs-login-input` (custom CSS) | Tailwind classes | ❌ Crear clase custom |
| Font | Inter 14px | Default | ❌ Especificar |
| Background | `rgba(255,255,255,0.06)` | `bg-white/5` (0.05) | ⚠️ Casi igual |
| Border | `rgba(255,255,255,0.12)` | `border-white/10` (0.1) | ⚠️ Casi igual |
| Border radius | `10px` | `rounded-xl` (12px) | ❌ Cambiar a 10px |
| Padding | `14px 16px` | `pl-10 pr-4 py-3` (12px) | ❌ Diferente padding |
| Focus border | `#1976D2` | `border-blue-400/50` | ❌ Color diferente |
| Focus shadow | `0 0 0 3px rgba(25,118,210,0.4)` | `ring-1 ring-blue-400/30` | ❌ Más sutil en Aleph |
| Placeholder | `rgba(139, 163, 196, 0.5)` (#8ba3c4) | `placeholder-blue-200/40` | ⚠️ Similar |
| Transition | `all 0.25s ease` | `transition-all` | ✅ Similar |

#### Login Labels

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Font | Inter 11px 600 | No tiene labels styled | ❌ Añadir |
| Letter spacing | 1.5px | — | ❌ Añadir |
| Transform | uppercase | — | ❌ Añadir |
| Color | `#8ba3c4` | — | ❌ Añadir |

#### Login Button

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Clase | `.chs-login-btn` (custom) | Tailwind classes | ❌ Crear clase custom |
| Font size | 13px | Default (14px) | ❌ Cambiar |
| Font weight | 700 | font-medium (500) | ❌ Cambiar a 700 |
| Letter spacing | 2px | Default | ❌ Añadir 2px |
| Transform | uppercase | Normal | ❌ Añadir uppercase |
| Gradient | `135deg, #1565C0, #1976D2` | `to-r, blue-600, blue-700` | ❌ Diferente ángulo y colores |
| Border | `1px solid rgba(21,101,192,0.6)` | No tiene | ❌ Añadir |
| Border radius | 10px | `rounded-xl` (12px) | ❌ Cambiar |
| Min height | 48px | `py-3` (~44px) | ❌ Añadir min-height |
| Hover transform | `translateY(-1px)` | No tiene | ❌ Añadir |
| Hover shadow | `0 8px 24px rgba(21,101,192,0.35)` | No tiene | ❌ Añadir |

#### Login Decorative Elements

| Elemento | CHS | Aleph | Corrección |
|----------|-----|-------|------------|
| Línea decorativa | `gradient(90deg, transparent, #42A5F5, transparent)` | No tiene | ❌ Añadir |
| Texto "O accede con" | Sí | No | ❌ Añadir si aplica |
| Eye toggle (password) | `.chs-eye-toggle` custom class | Posible | Verificar |

---

### 5.2 Navbar

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Height | `h-14` (56px) | Similar | ✅ OK |
| Position | `sticky top-0 z-[999]` | Similar | Verificar z-index |
| Background | `linear-gradient(135deg, #0D47A1 0%, #1565C0 50%, #1976D2 100%)` | `.hero-gradient` class | ✅ Mismo concepto |
| Border bottom | `1px solid rgba(255,255,255,0.1)` | Shadow-based | ⚠️ Diferente enfoque |
| Padding | `px-5` (20px) | Similar | Verificar |
| Logo | SVG image `brightness(0) invert(1)` opacity 0.9 | SVG Z icon inline | ❌ Diferente logo |
| Brand text | "SANCHEZ" (img) | "ALEPH" (text-sm font-bold tracking-wider) | ❌ Texto diferente |
| Subtitle | "PORTAL CORPORATIVO" | "Portal Corporativo" (text-[10px] text-blue-200/70) | ❌ Case diferente |
| Divider | `w-px h-6 bg-white/15` | Similar | Verificar |
| Tab active | `bg-white/20 text-white border-white/10` | `bg-white/15 text-white` | ❌ 20% vs 15% |
| Tab inactive | `text-white/60` | `text-blue-100/80` | ❌ Color diferente |
| Tab size | `text-xs font-semibold tracking-wider` | Similar | Verificar |
| Cmd+K button | `rgba(255,255,255,0.08)`, `text-[10px]` | `bg-white/10 text-[10px]` | ⚠️ Casi igual |
| Avatar | `h-7 w-7 bg-white/20 text-[10px]` | Similar | Verificar |
| Theme toggle | `text-white/60` | `p-2 rounded-lg hover:bg-white/10` | ⚠️ Diferente hover |
| Notification badge | `bg-red-500 h-4 w-4 text-[9px]` | Similar | Verificar |

---

### 5.3 Dashboard Header (Hero/Banner)

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Gradient | `135deg, #0D47A1 0%, #1565C0 40%, #1976D2 70%, #1A237E 100%` | `135deg, #0D47A1 0%, #1565C0 25%, #1976D2 50%, #1A237E 100%` | ❌ Stops diferentes |
| Padding | `pt-10 pb-16 px-6` | Similar | Verificar |
| Dot pattern | `radial-gradient 24×24px, rgba(255,255,255,0.08)` | No tiene | ❌ Falta dot-pattern |
| Stats cards | `.glass-card` con blur(16px) | `.glass-card` con blur(12px) | ❌ Menos blur |
| Stats layout | Glass cards en fila | Barras sólidas oscuras | ❌ Diseño diferente |
| Stats label | `text-white/50 text-[10px] uppercase tracking-wider` | Similar | Verificar |
| Stats value | `text-white text-lg font-bold` | Similar | Verificar |
| Content overlap | `-mt-6` (24px negative margin) | Similar | Verificar |

#### Glass Card Comparison

| Propiedad | CHS `.glass-card` | Aleph `.glass-card` | Corrección |
|-----------|-------------------|---------------------|------------|
| Backdrop blur | `blur(16px) saturate(180%)` | `blur(12px)` | ❌ Menos blur, sin saturate |
| Background | `rgba(255,255,255,0.12)` | `rgba(255,255,255,0.06)` | ❌ Menos opaco |
| Border | `rgba(255,255,255,0.2)` | `rgba(255,255,255,0.1)` | ❌ Menos visible |

#### Glass Card Strong (solo CHS)

```css
/* CHS tiene .glass-card-strong — Aleph NO */
.glass-card-strong {
  backdrop-filter: blur(24px) saturate(200%);
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
```

---

### 5.4 Department Cards

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Layout | Grid de cards colapsadas | Lista flat con apps inline | ❌ Diseño muy diferente |
| Card bg | `var(--card)` | `var(--card)` | ✅ Igual |
| Card border | `border/50%` | `border` | ⚠️ Similar |
| Card radius | `rounded-md` (6px) | Similar | Verificar |
| Card shadow | `shadow-md` | Similar | Verificar |
| Card padding | `p-6` (24px) | Similar | Verificar |
| Icon container | `w-16 h-16 rounded-md` + gradient bg + shadow-lg | `w-8 h-8 rounded-lg` + opacity gradient | ❌ Mucho más pequeño |
| Icon size | `h-8 w-8 text-white` | Icon más pequeño | ❌ Diferente |
| Icon gradient | `linear-gradient(135deg, lightColor 0%, darkColor 100%)` — full gradients | `linear-gradient(135deg, ${color}40, ${color}20)` — opacity based | ❌ Menos vibrante |
| Click behavior | Expande/colapsa para mostrar apps | Siempre expandido con apps | ❌ Diferente UX |
| Hover effect | translateY + shadow increase | Minimal | ❌ Falta hover |

#### Department Icon Gradient Maps (CHS)

Cada departamento en CHS tiene un gradiente completo definido de color claro a oscuro:

| Departamento | Color Base | Gradiente CHS | Aleph |
|-------------|-----------|---------------|-------|
| Compras | `#0891B2` | `135deg, #22d3ee → #0e7490` | `#0891B240 → #0891B220` |
| Ventas | `#16A34A` | `135deg, #4ade80 → #15803d` | `#16A34A40 → #16A34A20` |
| Logística | `#DC2626` | `135deg, #f87171 → #b91c1c` | `#DC262640 → #DC262620` |
| Marketplace | `#7C3AED` | `135deg, #a78bfa → #6d28d9` | `#7C3AED40 → #7C3AED20` |
| Marketing | `#DB2777` | `135deg, #f472b6 → #be185d` | `#DB277740 → #DB277720` |
| Contenido | `#9333EA` | `135deg, #c084fc → #7e22ce` | `#9333EA40 → #9333EA20` |
| E-commerce | `#2563EB` | `135deg, #60a5fa → #1d4ed8` | `#2563EB40 → #2563EB20` |
| IT | `#4F46E5` | `135deg, #818cf8 → #4338ca` | `#4F46E540 → #4F46E520` |
| IA | `#F59E0B` | `135deg, #fbbf24 → #d97706` | `#F59E0B40 → #F59E0B20` |
| Dirección | `#0F172A` | `135deg, #0F172A → #0F172ACC` | Opacity based |

---

### 5.5 App Cards

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Layout | Aparecen al expandir departamento | Inline bajo cada departamento | ❌ Diferente |
| Hover class | `.app-card` custom CSS | Tailwind hover classes | ❌ Crear clase |
| Hover transform | `translateY(-4px)` | No tiene | ❌ Añadir |
| Hover shadow | `0 12px 40px rgba(0,0,0,0.12)` | `hover:shadow-md` | ❌ Shadow más suave |
| Transition | `transform 0.25s ease, box-shadow 0.25s ease` | Tailwind default | ❌ Especificar |
| Icon hover | `.app-card-icon` `scale(1.08)` con `cubic-bezier(0.34,1.56,0.64,1)` | No tiene | ❌ Añadir |
| Icon container | `w-10 h-10 rounded-xl` | Similar | Verificar |
| Icon gradient | Full gradient map por color | `${color} → ${color}CC` (80% opacity) | ❌ Diferente |
| Title hover color | `#1565C0` | No tiene hover color | ❌ Añadir |
| Link "Abrir" | `opacity-0 group-hover:opacity-100` | No tiene | ❌ Añadir |
| Description | `text-xs text-muted-foreground line-clamp-2` | Similar | Verificar |
| Status badge | Inline con dot pulsante | Similar | ✅ OK |

#### CHS App Card Hover CSS

```css
.app-card {
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.app-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
}
.app-card-icon {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.app-card:hover .app-card-icon {
  transform: scale(1.08);
}
```

#### CHS App Icon Gradient Map (dynamic-icon.tsx)

| Color | Light Stop | Dark Stop |
|-------|-----------|----------|
| `#2196F3` | `#42A5F5` | `#1565C0` |
| `#4CAF50` | `#66BB6A` | `#2E7D32` |
| `#9C27B0` | `#AB47BC` | `#6A1B9A` |
| `#FF9800` | `#FFA726` | `#E65100` |
| `#607D8B` | `#78909C` | `#37474F` |
| `#E91E63` | `#EC407A` | `#AD1457` |
| `#00BCD4` | `#26C6DA` | `#00838F` |
| `#795548` | `#8D6E63` | `#4E342E` |
| `#3F51B5` | `#5C6BC0` | `#283593` |
| `#009688` | `#26A69A` | `#00695C` |
| `#F44336` | `#EF5350` | `#C62828` |
| `#3b82f6` | `#60a5fa` | `#2563eb` |
| + todos los dept colors | (ver arriba) | (ver arriba) |

---

### 5.6 Admin Panel

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Header | Hero gradient como dashboard | Hero gradient | ✅ Similar |
| Header padding | `pt-8 pb-12 px-6` | Similar | Verificar |
| Content overlap | `-mt-4` (16px) | Similar | Verificar |
| Tab names (ES) | Usuarios, Departamentos, Aplicaciones, Roles, Auditoría | Usuarios, Departamentos, Aplicaciones, Roles, Auditoría | ✅ Iguales |
| Tab style | `text-xs font-semibold tracking-wider uppercase` | Similar | Verificar |
| Table style | Standard shadcn Table | Standard shadcn Table | ✅ Igual |

---

### 5.7 Monitor Page

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Layout | Grid de service cards | Similar | ✅ Similar |
| Status badges | colored bg + dot | Similar | ✅ Similar |
| Provider colors | 6 provider-specific colors | Verificar implementación | Verificar |
| Refresh interval | Auto-refresh | Similar | Verificar |

---

### 5.8 Profile Page

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Layout | Card-based form | Card-based form | ✅ Similar |
| Header | Hero gradient | Hero gradient | ✅ Similar |
| Avatar | Large centered | Similar | Verificar |
| Form fields | Standard inputs | Standard inputs | ✅ Similar |

---

### 5.9 Badges y Botones

#### Badge Variants

| Variant | CHS | Aleph | ¿Coincide? |
|---------|-----|-------|------------|
| default | Primary bg | Primary bg | ✅ Sí |
| secondary | Secondary bg | Secondary bg | ✅ Sí |
| destructive | Red bg | Red bg | ✅ Sí |
| outline | Transparent + border | Transparent + border | ✅ Sí |
| success | Emerald | Emerald | ✅ Sí |
| warning | Amber | Amber | ✅ Sí |

#### Button Variants

| Variant | CHS | Aleph | ¿Coincide? |
|---------|-----|-------|------------|
| default | Primary bg + shadow | Primary bg + shadow | ✅ Sí |
| destructive | Red bg | Red bg | ✅ Sí |
| outline | Border + hover accent | Border + hover accent | ✅ Sí |
| secondary | Secondary bg | Secondary bg | ✅ Sí |
| ghost | Transparent + hover | Transparent + hover | ✅ Sí |
| link | Primary underline | Primary underline | ✅ Sí |

#### Button Sizes

| Size | CHS | Aleph | ¿Coincide? |
|------|-----|-------|------------|
| default | h-9 px-4 py-2 | h-9 px-4 py-2 | ✅ Sí |
| sm | h-8 px-3 text-xs | h-8 px-3 text-xs | ✅ Sí |
| lg | h-10 px-8 | h-10 px-8 | ✅ Sí |
| icon | h-9 w-9 | h-9 w-9 | ✅ Sí |

---

### 5.10 Dark Mode

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Provider | next-themes | next-themes | ✅ Igual |
| Attribute | class | class | ✅ Igual |
| Default | system | light | ⚠️ CHS usa system |
| Storage key | "chs-theme" | Default | ❌ Diferente |
| Variables | Full override set | Full override set | ✅ Similares |
| Gradients in dark | Unchanged (blue nav/hero) | Unchanged | ✅ Igual |
| Glass effects | Same values | Same values | ✅ Igual |

---

### 5.11 Responsive (Mobile)

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Breakpoints | Tailwind defaults (sm/md/lg/xl) | Tailwind defaults | ✅ Iguales |
| Mobile navbar | Hamburger menu | Similar | Verificar |
| Mobile cards | Stack vertical | Stack vertical | ✅ Similar |
| Cmd+K visible | `hidden lg:flex` | `hidden lg:flex` | ✅ Igual |
| Mobile dashboard | Full width cards | Full width cards | ✅ Similar |

---

### 5.12 Command Palette (Ctrl+K)

| Propiedad | CHS | Aleph | Corrección |
|-----------|-----|-------|------------|
| Trigger | `Control+K` / `⌘+K` | `Control+K` / `⌘+K` | ✅ Igual |
| Overlay | `bg-black/50 backdrop-blur-sm` | `bg-black/50 backdrop-blur-sm` | ✅ Igual |
| Position | Fixed top-20% centered | Fixed top-20% centered | ✅ Igual |
| Width | `max-w-lg` | `max-w-lg` | ✅ Igual |
| Border | `rounded-xl border` | `rounded-xl border` | ✅ Igual |
| Shadow | `shadow-2xl` | `shadow-2xl` | ✅ Igual |
| Sections | "Navegación" + "Aplicaciones" | "Navegación" + "Aplicaciones" | ✅ Igual |
| Item hover | `data-[selected=true]:bg-accent` | Similar | ✅ Igual |

---

## 6. Elementos que CHS Tiene y Aleph NO

### 6.1 Sistema de Animaciones Completo

CHS tiene un sistema de animaciones que Aleph no implementa:

```css
/* Keyframes que faltan en Aleph */
@keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes scaleIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
@keyframes slideDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
@keyframes shimmer { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
@keyframes gradientShift { 0% { background-position:0% 50%; } 50% { background-position:100% 50%; } 100% { background-position:0% 50%; } }
@keyframes pulse-glow { 0%,100% { box-shadow:0 0 20px rgba(33,150,243,0.15); } 50% { box-shadow:0 0 40px rgba(33,150,243,0.3); } }
@keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
@keyframes particleFloat { 0% { transform:translateY(0); opacity:0; } 10% { opacity:1; } 90% { opacity:1; } 100% { transform:translateY(-100vh); opacity:0; } }
@keyframes loginBgPulse { 0%,100% { filter:brightness(1) hue-rotate(0deg); } 50% { filter:brightness(1.05) hue-rotate(5deg); } }

/* Clases de animación que faltan */
.animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; opacity: 0; }
.animate-fade-in { animation: fadeIn 0.4s ease-out forwards; opacity: 0; }
.animate-scale-in { animation: scaleIn 0.4s ease-out forwards; opacity: 0; }
.animate-slide-down { animation: slideDown 0.4s ease-out forwards; opacity: 0; }

/* Stagger delays que faltan */
.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.1s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.2s; }
.stagger-5 { animation-delay: 0.25s; }
.stagger-6 { animation-delay: 0.3s; }
.stagger-7 { animation-delay: 0.35s; }
.stagger-8 { animation-delay: 0.4s; }

/* Gradient animate que falta */
.gradient-animate { background-size: 200% 200%; animation: gradientShift 8s ease infinite; }
```

### 6.2 Framer Motion

CHS usa `framer-motion` para transiciones de página y animaciones de cards:

```tsx
// Page transitions (page-transition.tsx)
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3, ease: "easeOut" }}

// Card stagger (dashboard.tsx)
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3, delay: index * 0.05 }}

// View switch (dashboard.tsx)
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -10 }}
transition={{ duration: 0.2 }}
```

**Aleph no tiene `framer-motion` instalado.**

### 6.3 Elevation System

CHS tiene un sistema de elevación con pseudo-elementos que Aleph no tiene:

```css
/* Elevation variables */
--elevate-1: rgba(0,0,0, .03);  /* Light */  rgba(255,255,255, .04);  /* Dark */
--elevate-2: rgba(0,0,0, .08);  /* Light */  rgba(255,255,255, .09);  /* Dark */

/* Elevation classes */
.hover-elevate:hover::after { background-color: var(--elevate-1); }
.hover-elevate-2:hover::after { background-color: var(--elevate-2); }
.active-elevate:active::after { background-color: var(--elevate-1); }
.active-elevate-2:active::after { background-color: var(--elevate-2); }
.toggle-elevate.toggle-elevated::before { background-color: var(--elevate-2); }
```

### 6.4 Glass Card Strong

```css
/* Solo existe en CHS */
.glass-card-strong {
  backdrop-filter: blur(24px) saturate(200%);
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
```

### 6.5 Dot Pattern Background

```css
/* Solo existe en CHS */
.dot-pattern {
  background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

### 6.6 Text Gradient Class

```css
/* Solo existe en CHS */
.text-gradient {
  background: linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.8) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 6.7 Login Custom CSS Classes

CHS tiene clases CSS dedicadas para el login que Aleph no tiene:

- `.chs-login-input` — Input styling completo
- `.chs-login-btn` — Button styling completo
- `.chs-skip-btn` — Skip intro button
- `.chs-eye-toggle` — Password visibility toggle

### 6.8 Intro Video / Splash Screen

CHS tiene un splash screen con video/animación de intro que Aleph no implementa:
- Progress bar con gradient animado
- Skip button glassmorphism
- Z-index layers: 9999 (overlay), 10000 (progress), 10001 (skip)

### 6.9 Segunda Fuente (Open Sans)

CHS carga Open Sans como fuente de body además de Inter para headings. Aleph solo usa Inter.

### 6.10 Department Expand/Collapse UX

CHS muestra departamentos como cards colapsadas que se expanden al click para revelar apps. Aleph muestra todos los departamentos con sus apps siempre visibles en lista plana.

### 6.11 Card Hover Effects Sofisticados

- App cards: `translateY(-4px)` + sombra grande + icon `scale(1.08)` con bouncy bezier
- Title hover color: `#1565C0`
- "Abrir" link fade-in: `opacity-0 group-hover:opacity-100`

### 6.12 Shadow System (CHS usa shadows cero en tokens base)

CHS define todas las shadow tokens como `0px` opacity, creando un look ultra-limpio (flat design) por defecto, con shadows solo en hover/interactive states.

---

## 7. Elementos que Aleph Tiene y CHS NO

### 7.1 Agent Button Gradient (Indigo→Purple)

```css
/* Aleph agent button - diferente al CHS */
background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
/* vs CHS: linear-gradient(135deg, #1565C0 0%, #0D47A1 100%) */
```

Aleph usa un gradiente indigo-a-púrpura para el botón del agente AI, mientras CHS usa azul consistente con la marca.

### 7.2 Tailwind v4 con @theme

Aleph usa Tailwind CSS v4 con la directiva `@theme` para definir variables, mientras CHS usa Tailwind v3 con `tailwind.config.ts`. Esto es una mejora técnica de Aleph.

### 7.3 Login Background con Linear Gradient Base

Aleph añade un `linear-gradient(180deg, #0a1628, #0d1b2e)` como capa base del login, creando una transición vertical sutil que CHS no tiene (CHS usa color sólido `#0a1628`).

### 7.4 Badge Variants Adicionales

Aleph define variantes `success` y `warning` en el componente Badge que CHS podría no tener explícitas.

### 7.5 Status Dot Pulse Animation

```css
/* Aleph define una animación pulse específica para status dots */
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.status-dot-pulse { animation: pulse-dot 2s ease-in-out infinite; }
```

---

## 8. Referencia de Screenshots

### 8.1 CHS Platform Screenshots

| # | Archivo | Descripción |
|---|---------|-------------|
| 01 | `chs/01-login.png` | Pantalla de login con splash/intro, imagen de corredor y texto "sanchez" |
| 02 | `chs/02-dashboard.png` | Dashboard completo: gradient header, glass stats, department grid |
| 03 | `chs/03-navbar.png` | Navbar aislada: gradient azul, logo, tabs, cmd+k, avatar |
| 04 | `chs/04-header-gradient.png` | Zoom al header gradient con stats en glass cards |
| 05 | `chs/05-department-expanded.png` | Departamento expandido mostrando app cards |
| 06 | `chs/06-app-card.png` | Zoom a una app card individual |
| 07 | `chs/07-monitor.png` | Página de monitor (sesión expirada, muestra login) |
| 08 | `chs/08-admin-main.png` | Admin panel principal |
| 08 | `chs/08-admin-users.png` | Admin - Pestaña Usuarios |
| 08 | `chs/08-admin-departments.png` | Admin - Pestaña Departamentos |
| 08 | `chs/08-admin-apps.png` | Admin - Pestaña Aplicaciones |
| 08 | `chs/08-admin-roles.png` | Admin - Pestaña Roles |
| 08 | `chs/08-admin-audit.png` | Admin - Pestaña Auditoría |
| 09 | `chs/09-profile.png` | Página de perfil |
| 10 | `chs/10-dark-dashboard.png` | Dashboard en modo oscuro |
| 10 | `chs/10-dark-admin.png` | Admin en modo oscuro |
| 11 | `chs/11-mobile-dashboard.png` | Dashboard en viewport móvil (375×812) |
| 11 | `chs/11-mobile-admin.png` | Admin en viewport móvil |
| 12 | `chs/12-command-palette.png` | Command palette (Ctrl+K) con secciones |

### 8.2 Aleph Platform Screenshots

| # | Archivo | Descripción |
|---|---------|-------------|
| 01 | `aleph/01-login.png` | Login page con background gradient multi-capa |
| 02 | `aleph/02-dashboard.png` | Dashboard completo: gradient header, stats barras, dept list |
| 03 | `aleph/03-navbar.png` | Navbar: gradient azul, "ALEPH" text, Z icon |
| 04 | `aleph/04-header-gradient.png` | Zoom al header gradient con stats |
| 06 | `aleph/06-app-card.png` | App card individual |
| 07 | `aleph/07-monitor.png` | Página de monitor completa |
| 08 | `aleph/08-admin-main.png` | Admin panel principal |
| 08 | `aleph/08-admin-usuarios.png` | Admin - Pestaña Usuarios |
| 08 | `aleph/08-admin-departamentos.png` | Admin - Pestaña Departamentos |
| 08 | `aleph/08-admin-aplicaciones.png` | Admin - Pestaña Aplicaciones |
| 08 | `aleph/08-admin-roles.png` | Admin - Pestaña Roles |
| 08 | `aleph/08-admin-auditoria.png` | Admin - Pestaña Auditoría |
| 08 | `aleph/08-admin-audit.png` | Admin - Auditoría (nombre inglés) |
| 09 | `aleph/09-profile.png` | Página de perfil |
| 10 | `aleph/10-dark-dashboard.png` | Dashboard en modo oscuro |
| 10 | `aleph/10-dark-admin.png` | Admin en modo oscuro |
| 11 | `aleph/11-mobile-dashboard.png` | Dashboard móvil (375×812) |
| 11 | `aleph/11-mobile-admin.png` | Admin móvil |
| 12 | `aleph/12-command-palette.png` | Command palette (Ctrl+K) |

> **Nota:** El screenshot `chs/05-department-expanded.png` no tiene equivalente directo en Aleph porque Aleph muestra apps expandidas por defecto.

---

## 9. Plan de Correcciones Priorizado

### Prioridad CRÍTICA (Impacto visual alto)

#### 9.1 Glassmorphism — Igualar valores de blur y opacidad
**Archivos:** `src/app/globals.css`
**Cambios:**
```css
/* Cambiar de: */
.glass-card {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* A: */
.glass-card {
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

Añadir `.glass-card-strong`:
```css
.glass-card-strong {
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
```

**Esfuerzo:** Bajo

#### 9.2 Sistema de Animaciones CSS
**Archivos:** `src/app/globals.css`
**Cambios:** Añadir todos los keyframes y clases de animación listados en sección 6.1
**Esfuerzo:** Bajo

#### 9.3 Dot Pattern Background
**Archivos:** `src/app/globals.css`
**Cambios:** Añadir clase `.dot-pattern` y aplicar al dashboard hero
**Esfuerzo:** Bajo

#### 9.4 App Card Hover Effects
**Archivos:** `src/app/globals.css` + dashboard component
**Cambios:** Añadir clases `.app-card` y `.app-card-icon` con hover transforms
**Esfuerzo:** Bajo

#### 9.5 Text Gradient Class
**Archivos:** `src/app/globals.css`
**Cambios:** Añadir clase `.text-gradient`
**Esfuerzo:** Bajo

### Prioridad ALTA (Mejora de UX significativa)

#### 9.6 Login Card — Glassmorphism Premium
**Archivos:** `src/app/(auth)/login/page.tsx`, `src/app/globals.css`
**Cambios:**
- Crear clases `.chs-login-input`, `.chs-login-btn`, `.chs-eye-toggle`
- Aumentar blur a 40px
- Cambiar background a `rgba(10, 22, 40, 0.55)`
- Añadir box-shadow triple
- Cambiar max-width a 420px
- Cambiar border-radius a 20px
- Ajustar padding a `48px 40px 40px`
**Esfuerzo:** Medio

#### 9.7 Login Partículas Animadas
**Archivos:** `src/app/(auth)/login/page.tsx`
**Cambios:** Reemplazar 3 dots estáticos por 28 partículas animadas con `particleFloat`
**Esfuerzo:** Medio

#### 9.8 Login Button — Estilo Premium
**Archivos:** `src/app/globals.css` + login page
**Cambios:** Aplicar `.chs-login-btn` con gradient 135°, uppercase, letter-spacing 2px, hover translateY
**Esfuerzo:** Bajo

#### 9.9 Login Labels — Typography
**Archivos:** login page
**Cambios:** Añadir labels con Inter 11px, 600 weight, 1.5px spacing, uppercase, color #8ba3c4
**Esfuerzo:** Bajo

#### 9.10 Login Grid Pattern
**Archivos:** login page
**Cambios:** Añadir grid overlay 60×60px con rgba(255,255,255,0.015)
**Esfuerzo:** Bajo

#### 9.11 Department Icon Gradients — Full Color Maps
**Archivos:** Dashboard component
**Cambios:** Reemplazar gradientes opacity-based por gradientes completos (light→dark) para cada departamento
**Esfuerzo:** Medio

#### 9.12 Hero Gradient Stops
**Archivos:** `src/app/globals.css`
**Cambios:** Ajustar stops del hero-gradient de `25%, 50%` a `40%, 70%` para coincidir con CHS
**Esfuerzo:** Bajo

### Prioridad MEDIA (Polish y refinamiento)

#### 9.13 Instalar Framer Motion
**Archivos:** `package.json`, page-transition wrapper, dashboard
**Cambios:** `npm install framer-motion`, crear PageTransition wrapper, añadir stagger a cards
**Esfuerzo:** Alto

#### 9.14 Tipografía Dual (Open Sans)
**Archivos:** `src/app/layout.tsx`, `src/app/globals.css`
**Cambios:** Importar Open Sans de Google Fonts, establecer como `--font-sans` body
**Esfuerzo:** Bajo

#### 9.15 Elevation System
**Archivos:** `src/app/globals.css`
**Cambios:** Añadir variables `--elevate-1/2` y clases `.hover-elevate`, `.active-elevate`, `.toggle-elevate`
**Esfuerzo:** Bajo

#### 9.16 Department Expand/Collapse UX
**Archivos:** Dashboard component
**Cambios:** Cambiar layout de lista plana a grid colapsable con expand al click
**Esfuerzo:** Alto

#### 9.17 Shadow Tokens (Flat por defecto)
**Archivos:** `src/app/globals.css`
**Cambios:** Igualar shadow tokens a 0px opacity por defecto (flat design)
**Esfuerzo:** Bajo

#### 9.18 Border Radius System
**Archivos:** `src/app/globals.css`
**Cambios:** Cambiar `--radius` de 10px (0.625rem) a base system: lg=9px, md=6px, sm=3px
**Esfuerzo:** Bajo — pero verificar impacto en todos los componentes

### Prioridad BAJA (Detalles menores)

#### 9.19 Agent Button Gradient
**Archivos:** `src/components/agent/agent-button.tsx`
**Cambios:** Cambiar de indigo→purple (`#4F46E5→#7C3AED`) a blue (`#1565C0→#0D47A1`)
**Esfuerzo:** Bajo

#### 9.20 Navbar Tab Active Background
**Archivos:** `src/components/navbar.tsx`
**Cambios:** Cambiar `bg-white/15` a `bg-white/20` para tab activo
**Esfuerzo:** Bajo

#### 9.21 Navbar Tab Inactive Color
**Archivos:** `src/components/navbar.tsx`
**Cambios:** Cambiar `text-blue-100/80` a `text-white/60`
**Esfuerzo:** Bajo

#### 9.22 Login Background Radial Positions
**Archivos:** `src/app/globals.css`
**Cambios:** Ajustar posiciones de los radial-gradient para coincidir con CHS
**Esfuerzo:** Bajo

#### 9.23 Dark Mode Default Theme
**Archivos:** Theme provider config
**Cambios:** Considerar cambiar default de "light" a "system"
**Esfuerzo:** Bajo

#### 9.24 Z-index Navbar
**Archivos:** Navbar component
**Cambios:** Verificar que usa `z-[999]` como CHS
**Esfuerzo:** Bajo

---

## Apéndice A: Resumen de Archivos a Modificar

| Archivo | Secciones | Prioridad |
|---------|-----------|-----------|
| `src/app/globals.css` | Glass cards, animations, dot-pattern, text-gradient, elevation, shadows, login classes, hero-gradient stops | CRÍTICA-MEDIA |
| `src/app/(auth)/login/page.tsx` | Card styling, particles, labels, button, grid pattern | ALTA |
| Dashboard component(s) | Dept gradients, app card hover, card layout, framer motion | ALTA-MEDIA |
| `src/components/navbar.tsx` | Tab colors, logo, branding text | BAJA |
| `src/components/agent/agent-button.tsx` | Gradient color | BAJA |
| `src/app/layout.tsx` | Open Sans import, page title | MEDIA |
| `package.json` | framer-motion dependency | MEDIA |

## Apéndice B: Herramientas Utilizadas

- **Playwright** (Chromium headless) para capturas de pantalla automatizadas
- **Análisis estático** de código fuente (grep, cat) para extracción de tokens
- **CHS acceso:** `http://127.0.0.1:5001` (puerto directo)
- **Aleph acceso:** `https://platform.centrohogarsanchez.es` (via Traefik)
- **Credenciales:** admin / admin123

---

*Fin del documento de auditoría de diseño.*
