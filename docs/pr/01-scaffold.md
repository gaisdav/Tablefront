# PR 01 — Project scaffold and tooling

## What changed

- Vite 8 + Vue 3.5 + TypeScript project, pnpm, Node 22 (`.nvmrc`, `engines`).
- Folder structure from the spec (`src/api|components|composables|pages|stores|router|types|mocks|styles`, `docs`). Empty folders hold a `.gitkeep` that the PR that fills them removes.
- `@/` path alias, declared in two places that must agree: `tsconfig.app.json` (types) and `vite.config.ts` (bundler and Vitest).
- TypeScript: `strict` plus `noUncheckedIndexedAccess` and `noUnused*`; `verbatimModuleSyntax` comes from `@vue/tsconfig`. Two projects: `tsconfig.app.json` (`src`) and `tsconfig.node.json` (`vite.config.ts`), checked together by `vue-tsc --build`.
- ESLint flat config (`typescript-eslint` strict type-checked, `eslint-plugin-vue`, `eslint-config-prettier`) and Prettier.
- Vitest (jsdom) with `@vue/test-utils` and one trivial component test (`App.spec.ts`).
- GitHub Actions: format check, lint, typecheck, test, build on every PR and on `main`.
- `.editorconfig`, `.nvmrc`, README stub with the script table.

## Why (decisions and trade-offs)

- **Hard rules are lint rules.** The spec's rules are enforced by ESLint rather than left to review: `no-explicit-any`, `no-non-null-assertion`, `no-console`, `vue/block-lang` (TS only), `vue/component-api-style` (`script-setup` only), type-based `defineProps`/`defineEmits`. Casts are banned via `no-restricted-syntax` on `as` (except `as const`); a legitimate boundary cast needs an inline `eslint-disable-next-line ... -- reason`, which doubles as the one-line explanation the spec asks for.
- **TypeScript 6.0, not 7.** `typescript-eslint` declares support for `<6.1.0`, so TS is pinned to `~6.0.3`. Revisit once `typescript-eslint` supports 7.
- **`src/shims-vue.d.ts`.** typescript-eslint cannot read SFCs, so without a `*.vue` module declaration every `.vue` import is typed `error` and type-aware rules fire. `vue-tsc` ignores the shim and uses the real component types.
- **Type-aware linting only under `src/`.** Config files are outside the app tsconfig, so they get `disableTypeChecked`.
- **Vitest config lives in `vite.config.ts`** so tests and the app share one alias/plugin setup.
- **Tests are colocated** (`Foo.spec.ts` next to `Foo.vue`).
- **No `vue-router` / `pinia` yet.** They are in the stack but first used in PR 03 / PR 05, so they are added there.

## Dependencies added beyond the spec's table (please confirm)

The spec says to ask before adding dependencies. These are tooling support for rows already in the table, not runtime code:

| Package                  | Needed because                                        |
| ------------------------ | ----------------------------------------------------- |
| `jsdom`                  | DOM environment for Vitest + `@vue/test-utils`        |
| `@vitejs/plugin-vue`     | Vue SFC support in Vite                               |
| `@vue/tsconfig`          | Vue team's baseline tsconfig                          |
| `@eslint/js`, `globals`  | ESLint flat-config base rules and environment globals |
| `eslint-config-prettier` | Turns off ESLint rules that conflict with Prettier    |
| `@types/node`            | Types for `vite.config.ts`                            |

I also added `pnpm format:check` to CI on top of lint/typecheck/test/build, so unformatted code fails the build. Easy to drop if you would rather not.

## How to verify

```sh
pnpm install
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm dev   # shows the placeholder page
```

To see the rules bite, add `const a: any = 1` or `x!` or `y as Foo` under `src/` and run `pnpm lint`.

## Review talking points

1. Why the conventions are lint rules, and how the `as` escape hatch works (`no-restricted-syntax` + disable comment with a reason).
2. Why two tsconfig projects and `vue-tsc --build` instead of a single config.
3. Why the `*.vue` shim exists and why it does not weaken `vue-tsc`.
4. Why TypeScript is pinned to 6.0 and what has to happen before moving to 7.
5. Why dependencies like Pinia and Vue Router are not installed yet.
