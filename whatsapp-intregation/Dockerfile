# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install build tools required by native modules (e.g. sharp, better-sqlite3)
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app

# Copy package files and install ALL dependencies (including devDeps for tsc)
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps


# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune devDependencies for production image
RUN npm prune --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production runner
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Runtime libs for native modules
RUN apk add --no-cache vips tini

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Auth data directory — expected to be a mounted PVC in Kubernetes
RUN mkdir -p /data/wa-auth && chown appuser:appgroup /data/wa-auth

# Copy production artifacts from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

USER appuser

EXPOSE 3000

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]

# ─────────────────────────────────────────────────────────────────────────────
# Labels / metadata
# ─────────────────────────────────────────────────────────────────────────────
LABEL org.opencontainers.image.title="whatsapp-intregation" \
    org.opencontainers.image.description="WhatsApp Web integration microservice" \
    org.opencontainers.image.version="1.0.0"
