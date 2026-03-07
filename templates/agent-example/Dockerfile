# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json ./
COPY ../../packages/agent-sdk ./packages/agent-sdk

RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only production dependencies and built output
COPY package.json ./
COPY --from=builder /app/packages/agent-sdk ./packages/agent-sdk
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4000

USER node

CMD ["node", "dist/index.js"]
