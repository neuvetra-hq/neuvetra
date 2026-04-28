FROM oven/bun:1.3.12
WORKDIR /app

# Copy workspace root
COPY package.json bun.lock ./
COPY packages/database/package.json ./packages/database/
COPY packages/config/ ./packages/config/
COPY apps/api/package.json ./apps/api/

RUN bun install

COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
