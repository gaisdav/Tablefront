# syntax=docker/dockerfile:1

# ---- Build: compile the app with the mock API included (the demo build) ----
FROM node:22-alpine AS build
WORKDIR /app

# The pnpm version comes from the `packageManager` field in package.json.
RUN corepack enable

# Dependencies first, so this layer is reused until the lockfile changes.
# (Any pnpm settings files are copied too, so the install uses the same config as local and CI.)
COPY package.json pnpm-lock.yaml .npmrc* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .
# Without this flag the mock API (and the Dev tools panel) is left out of the bundle, and the app
# would have no backend to talk to.
ENV VITE_ENABLE_MOCKS=true
RUN pnpm build

# ---- Serve: static files behind nginx ----
# The unprivileged image runs as a non-root user and listens on 8080, so it also starts on
# platforms that forbid root or ports below 1024. The tag is pinned for reproducible builds.
FROM nginxinc/nginx-unprivileged:1.29.8-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
