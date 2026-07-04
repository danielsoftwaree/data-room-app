# syntax=docker/dockerfile:1

# ---- Build stage: produce the static Vite bundle ----
# Vite inlines VITE_* vars at build time, so the Clerk publishable key must be
# present here (build arg). VITE_API_URL is left empty on purpose: the browser
# talks to the same origin and nginx proxies /api to the API service, so there
# are no cross-origin calls and no CORS to configure.
FROM oven/bun:1.3.6 AS builder
WORKDIR /app

ARG VITE_CLERK_PUBLISHABLE_KEY=""
ARG VITE_API_URL=""
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN bun install --frozen-lockfile
RUN bun run build --filter=web

# ---- Runtime stage: serve the static bundle with nginx ----
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
