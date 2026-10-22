# syntax=docker/dockerfile:1

# ---- Build: compile the app with the mock API included (the demo build) ----
FROM node:22-alpine AS build
WORKDIR /app

# The pnpm version comes from the `packageManager` field in package.json.
RUN corepack enable

# Dependencies first, so this layer is reused until the lockfile changes.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Without this flag the mock API (and the Dev tools panel) is left out of the bundle, and the app
# would have no backend to talk to.
ENV VITE_ENABLE_MOCKS=true
RUN pnpm build

# ---- Serve: static files behind nginx ----
FROM nginx:1.29-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
