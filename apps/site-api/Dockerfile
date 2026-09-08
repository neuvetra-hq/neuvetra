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

FROM workspace AS production-dependencies
RUN bun install --frozen-lockfile --production --filter site-api

FROM oven/bun:1.3.12 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=production-dependencies /app/ ./
COPY tsconfig.base.json ./
COPY config/ ./config/
COPY apps/site-api/src/ ./apps/site-api/src/
COPY apps/site-api/tsconfig.json ./apps/site-api/tsconfig.json
WORKDIR /app/apps/site-api
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
