# Contribuir a Aleph Platform

## Desarrollo local

1. Clonar el repo:
   ```bash
   git clone https://github.com/smellak/aleph-platform.git
   cd aleph-platform
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Levantar la base de datos:
   ```bash
   cd docker && docker compose up -d db
   ```

4. Ejecutar migraciones y seed:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Iniciar desarrollo:
   ```bash
   npm run dev
   ```

## Convenciones de código

- **TypeScript strict** — cero `any`, cero `console.log`, cero `catch` vacíos
- **Commits** — Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `security:`
- **Tests** — Obligatorios para nuevas funcionalidades. Usar Playwright para E2E.
- **i18n** — Todos los textos de la UI en archivos de traducción (`src/i18n/`)
- **Imports** — Usar `@/` alias para imports dentro de `apps/platform`
- **Errores** — Siempre `catch (error: unknown)` con instanceof Error check

## Estructura de branches

- `main` — Código estable y desplegable
- `feat/*` — Nuevas funcionalidades
- `fix/*` — Correcciones de bugs
- `docs/*` — Documentación

## Pull Requests

1. Crea una branch desde `main`
2. Implementa cambios con tests
3. Asegura que pasa:
   ```bash
   npm run type-check
   npm run build
   npx playwright test
   ```
4. Describe **qué** y **por qué** en el PR
5. Un reviewer debe aprobar antes de merge

## Añadir un endpoint API

1. Crea el route handler en `apps/platform/src/app/api/`
2. Valida inputs con Zod
3. Verifica autenticación via `x-aleph-user-id` header
4. Documenta en `apps/docs/pages/api-reference/`
5. Añade test en `tests/`

## Añadir una página admin

1. Crea la page en `apps/platform/src/app/(dashboard)/admin/`
2. Usa Server Components para data fetching
3. Client Components solo para interactividad
4. Añade entrada en el sidebar (`admin/layout.tsx`)
5. Añade traducciones en `src/i18n/`
