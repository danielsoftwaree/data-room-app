# syntax=docker/dockerfile:1

# ---- Build stage: install the whole workspace and compile the API ----
# The repo is a Bun + Turbo monorepo; the API build (`--filter=api`) also builds
# its workspace deps (@repo/db, @repo/domain, ...) via Turbo's ^build.
FROM oven/bun:1.3.6 AS builder
WORKDIR /app

# Copy the full monorepo. .dockerignore keeps host node_modules/dist out, so the
# lockfile-driven install below is reproducible.
COPY . .

RUN bun install --frozen-lockfile
RUN bun run build --filter=api

# ---- Runtime stage: carry the built workspace, run with Bun ----
FROM oven/bun:1.3.6 AS runner
WORKDIR /app
ENV NODE_ENV=production

# Bring the installed node_modules (workspace symlinks) and all compiled dist
# output across. Everything the API resolves at runtime lives under /app.
COPY --from=builder /app ./

EXPOSE 3000

# Bun executes the Nest build directly, so no separate Node runtime is needed.
CMD ["bun", "apps/api/dist/main.js"]
