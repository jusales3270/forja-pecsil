# ---- Base com pnpm (Debian slim - OpenSSL ok pro Prisma) ----
FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl ca-certificates postgresql-client && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# ---- Dependências ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile --filter @forja/backend... --filter @forja/shared

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared ./shared
COPY backend ./backend
RUN pnpm --filter @forja/shared build
RUN pnpm --filter @forja/backend exec prisma generate
RUN pnpm --filter @forja/backend build

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/backend/prisma ./backend/prisma
COPY backend/ops ./backend/ops
COPY --from=build /app/shared ./shared
WORKDIR /app/backend
CMD ["node", "dist/index.js"]
