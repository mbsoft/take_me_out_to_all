# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install all deps (including devDependencies)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build arguments for NEXT_PUBLIC_* variables (must be available at build time)
# Note: NBAI_API_KEY is NOT needed at build time - it's proxied server-side at runtime
ARG NEXT_PUBLIC_SUPABASE_URL

# Set them as environment variables for the build
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL

# Build Next.js app
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy the 2026 schedule JSON (needed at runtime)
COPY --from=builder /app/2026_mlb_schedule.json ./2026_mlb_schedule.json

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Cloud Run provides PORT env var
EXPOSE 3000

# Start Next.js server
CMD ["node", "server.js"]
