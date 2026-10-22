# PR 10 — Docker, deploy, documentation

## What this adds

- **Docker**: a multi-stage `Dockerfile` (Node builds the demo with the mock API on, nginx serves it), `nginx.conf` (single-page-app fallback, gzip, immutable caching for the hashed `/assets`, `no-cache` for the page and for `mockServiceWorker.js`), `docker-compose.yml` (`docker compose up --build` serves on http://localhost:8080), `.dockerignore` and a container health check.
- **Static deploy**: `netlify.toml` (demo build flag, fallback to `index.html`, cache headers).
- **README** written for a reviewer with five minutes: what it is, screenshots, how to run it with pnpm and with Docker, the staff credentials, how to use the Dev tools panel, the demo database and the build flag, architecture, folder map, scripts, and an honest "Not done" list.
- **`docs/DECISIONS.md`**: one page on the choices and what would change with a real backend.
- **CI**: a second job builds the image, runs it and checks that `/`, a deep link (`/orders`) and the mock worker are served.

## Decisions worth a look

- **The image is the demo build**: `VITE_ENABLE_MOCKS=true` is set in the Dockerfile, since without it the app would have no backend. A real deployment builds without it (the mock API, the panel and the worker file are then absent from `dist/`).
- **A missing file under `/` answers with the app (`200`)**, the usual single-page-app fallback; only `/assets/` returns a real `404`, so a stale link to an old bundle fails loudly instead of loading HTML as JavaScript.
- **The README says the live demo is not deployed.** A link cannot be written before there is a URL; it is on the "Not done" list rather than a dead link.

## How it was checked

- `format:check`, `lint` pass (no source code changed).
- `docker compose up --build` on a clean build: `/`, `/orders`, `/admin/menu` and `/mockServiceWorker.js` answer `200`, the hashed bundle is served gzipped with `immutable` caching, the page with `no-cache`, the container becomes healthy.
- The Docker build in Chrome: the menu loads through the service worker, a dish can be added, staff sign-in and the orders board work, the Dev tools panel opens, no console messages. The README screenshots were taken from it.
