FROM oven/bun:1 AS builder
WORKDIR /app

# Build-time env vars for Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
ARG VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=$VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
ENV VITE_API_URL=$VITE_API_URL

COPY package.json bun.lock ./
COPY packages/database/package.json ./packages/database/
COPY apps/web/package.json ./apps/web/

RUN bun install

COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN cd apps/web && bun run build

FROM node:20-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=builder /app/apps/web/dist ./dist
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
