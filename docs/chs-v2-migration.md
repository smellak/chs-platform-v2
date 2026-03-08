# Migración CHS v1 → v2 Completada

## Fecha: 2026-03-08

## Estado
- CHS Platform v1: ELIMINADA (contenedor chs-platform-app removido)
- CHS Platform v2 (ex-Aleph): ÚNICA plataforma activa
- Elias: Sin cambios, SSO via v2

## Contenedores
- aleph-platform → CHS Platform v2 (Next.js 16, puerto 3000)
- aleph-db → PostgreSQL 16 de v2
- cogk4c4s8kgsk4k4s00wskss → Elias (sin cambios)

## File providers Traefik
- chs-v2-platform.yaml → platform.centrohogarsanchez.es → aleph-platform:3000
- chs-v2-citas-auth.yaml → citas.centrohogarsanchez.es con ForwardAuth v2
- chs-v2-elias-auth.yaml → elias.centrohogarsanchez.es con ForwardAuth v2

## Cookie
- chs_access_token (nombre técnico interno)
- Domain: .centrohogarsanchez.es
- HttpOnly, Secure, SameSite=lax

## Headers SSO (ForwardAuth → Elias)
- X-Aleph-User-Id, X-Aleph-User-Name, X-Aleph-Dept, X-Aleph-Role, X-Aleph-Access-Level
- X-CHS-User-Id, X-CHS-User-Name, X-CHS-User-Dept, X-CHS-User-Role, X-CHS-Access-Level
- Elias lee los headers X-CHS-* en /api/auth/sso

## Rollback
No hay rollback a v1. La v1 está eliminada.
Si v2 falla, arreglar v2.
