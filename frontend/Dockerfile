# ─────────────────────────────────────────────────────────────────────────────
# ARTSA Dashboard — multi-stage production image
#
# Stage 1 builds the Next.js app with `output: "standalone"` (see next.config.js).
# Stage 2 ships a minimal runner: the standalone server + traced node_modules,
# static assets and public/. No devDependencies, no source, non-root user.
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1 — deps + build
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* variables are inlined into the client bundle at build time,
# so they must be build args, not just runtime env vars. The browser reaches
# the backend through the published host port, hence the default.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000

# Install deps first for layer caching (npm ci requires the lockfile).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# Stage 2 — minimal runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user — never root in the container.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone output contains the server binary + traced dependencies.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static build output (client JS/CSS chunks).
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Static files served as-is (favicons, manifests, frameworks).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
