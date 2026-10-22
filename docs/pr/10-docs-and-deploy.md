# PR 10 — Docker, deploy, documentation

## What this adds

- **Docker**: a multi-stage `Dockerfile` (Node builds the demo with the mock API on, nginx serves it), `nginx.conf` (single-page-app fallback, gzip, immutable caching for the hashed `/assets`, `no-cache` for the page and for `mockServiceWorker.js`), `docker-compose.yml` (`docker compose up --build` serves on http://localhost:8080; nginx runs unprivileged, as a non-root user on port 8080, in a pinned image), `.dockerignore` and a container health check.
- **Static deploy**: `netlify.toml` (demo build flag, fallback to `index.html`, cache headers).
- **README** written for a reviewer with five minutes: what it is, screenshots, how to run it with pnpm and with Docker, the staff credentials, how to use the Dev tools panel, the demo database and the build flag, architecture, folder map, scripts, and an honest "Not done" list.
- **`docs/DECISIONS.md`**: one page on the choices and what would change with a real backend.
- **CI**: a second job builds the image, runs it and runs `scripts/check-image.sh`: the app and deep links are served, the bundle is JavaScript, gzipped, `immutable` and `nosniff`, the mock worker and the page are never cached, missing files are 404s; the container log is printed if anything fails.

## Decisions worth a look

- **The image is the demo build**: `VITE_ENABLE_MOCKS=true` is set in the Dockerfile, since without it the app would have no backend. A real deployment builds without it (the mock API, the panel and the worker file are then absent from `dist/`).
- **An address with an extension is a file or a `404`**; only an address without one (a route) gets the app. A missing script, map, icon or `robots.txt` therefore fails loudly instead of coming back as HTML with a `200`.
- **The README says the live demo is not deployed.** A link cannot be written before there is a URL; it is on the "Not done" list rather than a dead link.

## Review follow-up

Fixed: `nosniff` on the mock worker (a location that sets any header drops the inherited ones, so each repeats them); missing files are real 404s; the CI check is a script with real assertions (headers, gzip, 404s) and prints the container log on failure; the final image is the unprivileged nginx, on 8080, with a pinned tag; any pnpm settings files are copied before the install.

Not changed: Node stays on the floating `22-alpine` tag, matching `.nvmrc` (security patches within the major are wanted), and the pnpm version is pinned by `packageManager`, with no offline fallback for corepack. On Netlify the `/index.html` rule is dropped: it did not match `/`, and Netlify already serves HTML with `max-age=0, must-revalidate`. The README no longer states a test count or a pnpm major.

## How it was checked

- `format:check`, `lint` pass (no source code changed).
- `docker compose up --build` on a clean build: `/`, `/orders`, `/admin/menu` and `/mockServiceWorker.js` answer `200`, the hashed bundle is served gzipped with `immutable` caching, the page with `no-cache`, the container becomes healthy.
- The Docker build in Chrome: the menu loads through the service worker, a dish can be added, staff sign-in and the orders board work, the Dev tools panel opens, no console messages. The README screenshots were taken from it.
