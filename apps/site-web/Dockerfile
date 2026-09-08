# Build from the repository root; see docs/deployment.md.
FROM oven/bun:1.3.12 AS workspace
WORKDIR /app

# Keep every workspace manifest available for frozen lockfile validation.
COPY package.json bun.lock ./
COPY apps/frontdesk-api/package.json ./apps/frontdesk-api/
COPY apps/frontdesk-web/package.json ./apps/frontdesk-web/
COPY apps/site-api/package.json ./apps/site-api/
COPY apps/site-web/package.json ./apps/site-web/
COPY apps/terrascope-api/package.json ./apps/terrascope-api/
COPY apps/terrascope-web/package.json ./apps/terrascope-web/
COPY packages/frontdesk-config/package.json ./packages/frontdesk-config/
COPY packages/frontdesk-database/package.json ./packages/frontdesk-database/
COPY packages/terrascope-config/package.json ./packages/terrascope-config/
COPY packages/terrascope-database/package.json ./packages/terrascope-database/
COPY packages/terrascope-calculator/package.json ./packages/terrascope-calculator/

FROM workspace AS build
RUN bun install --frozen-lockfile --filter site-web
COPY tsconfig.base.json ./
COPY config/ ./config/
COPY apps/site-web/ ./apps/site-web/

# These public values are embedded by Vite; Railway passes declared ARGs.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_SUPABASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN bun run --filter site-web build

FROM workspace AS production-dependencies
RUN bun install --frozen-lockfile --production --filter site-web

FROM oven/bun:1.3.12 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
# Copy the selected workspace's production dependency tree, including serve.
COPY --from=production-dependencies /app/ ./
COPY --from=build /app/apps/site-web/dist/ ./apps/site-web/dist/
WORKDIR /app/apps/site-web
EXPOSE 8080
CMD ["bun", "run", "--bun", "serve", "-s", "dist", "-l", "tcp://0.0.0.0:8080", "--no-clipboard", "--no-port-switching"]
