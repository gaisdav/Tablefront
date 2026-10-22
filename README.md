# Tablefront

A small restaurant online-ordering app (Vue 3 + TypeScript), built as a code sample.
Guests browse the menu and order; staff manage orders and the menu in an admin panel.

> Work in progress. The full README (demo link, screenshots, architecture, credentials) lands in PR 10.

## Getting started

Requires Node 22 (see `.nvmrc`) and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev
```

## Scripts

| Script              | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `pnpm dev`          | Vite dev server with HMR                           |
| `pnpm build`        | Production build into `dist/`                      |
| `pnpm preview`      | Serve the production build locally                 |
| `pnpm lint`         | ESLint (flat config, type-aware)                   |
| `pnpm lint:fix`     | ESLint with autofix                                |
| `pnpm format`       | Prettier, write                                    |
| `pnpm format:check` | Prettier, check only (used in CI)                  |
| `pnpm typecheck`    | `vue-tsc --build` over the app and tooling configs |
| `pnpm test`         | Vitest, single run                                 |
| `pnpm test:watch`   | Vitest in watch mode                               |
