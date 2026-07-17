# ─── deps ────────────────────────────────────────────────────────────
# Use Bun for install speed. Node 20 for build/runtime.
FROM oven/bun:1.1.22 as deps
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps required until @react-router/express catches up to
# the node/serve peer range. Remove once versions align.
RUN bun install --frozen-lockfile || bun install

# ─── build ───────────────────────────────────────────────────────────
FROM node:20-alpine as builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma engines
RUN npx prisma generate

# React Router production build → build/
RUN npm run build

# ─── runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# curl is needed for the Docker HEALTHCHECK below (alpine ships neither
# curl nor wget with SSL by default — apk add is a few kB).
RUN apk add --no-cache curl

# Copy only what runtime needs, not the whole build tree
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Docker's own healthcheck. Compose's healthcheck is redundant with this
# but doesn't hurt. Keep the interval loose — nginx polls too.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -fsS http://localhost:3000/healthz > /dev/null || exit 1

CMD ["node", "server.js"]
