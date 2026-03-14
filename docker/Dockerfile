FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/platform/package.json ./apps/platform/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/config/package.json ./packages/config/
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/platform/node_modules ./apps/platform/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/platform && npx next build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 chs && \
    adduser --system --uid 1001 chs

# Copy Next.js standalone output
COPY --from=builder /app/apps/platform/.next/standalone ./
COPY --from=builder /app/apps/platform/.next/static ./apps/platform/.next/static
COPY --from=builder /app/apps/platform/public ./apps/platform/public

# Copy packages needed for migrations/seed at runtime
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/auth ./packages/auth
COPY --from=builder /app/packages/config ./packages/config

# Copy all node_modules for migration/seed runtime (pg, drizzle, tsx, bcryptjs)
COPY --from=builder /app/node_modules ./node_modules

COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# Create cache directory with correct ownership for non-root user
RUN mkdir -p /app/apps/platform/.next/cache && chown -R chs:chs /app/apps/platform/.next/cache

USER chs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
