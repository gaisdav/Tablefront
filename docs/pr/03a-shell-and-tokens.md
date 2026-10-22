# PR 03a — App shell, router, design tokens, first base components

First half of PR 03. 03b adds `BaseDialog`, `BaseSkeleton`, `AsyncBoundary`, `EmptyState`, `ErrorState` and `useAsyncState`.

## What changed

- **Router** (`src/router`): lazy routes for `/`, `/checkout`, `/orders/:id`, `/admin/login`, `/admin/orders`, `/admin/menu` and a 404, with typed route meta (`requiresAuth`). `/admin` redirects to the orders board. Pages are placeholders for now.
- **Layouts**: `GuestLayout` (sticky header, footer, skip link) and `AdminLayout` (tabs on a phone, fixed sidebar from 1024 px). The admin layout is lazy-loaded, so guests never download it.
- **Design tokens** (`src/styles/tokens.css`): colour (light and dark via `prefers-color-scheme`), spacing, radius, shadows, type scale, motion and the 44 px tap size, all as CSS custom properties. Components use only tokens.
- **Global styles**: a small reset, base typography, visible `:focus-visible` outlines, `.container`, `.visually-hidden`, a skip link, and a `prefers-reduced-motion` rule.
- **`BaseButton`** (primary / secondary / ghost / danger, `loading`, `disabled`, `block`) and **`BaseInput`** (visible label, hint, error linked with `aria-describedby` / `aria-invalid`, `v-model`).
- **Tests**: shell rendering for guest, admin and login, route resolution and meta inheritance, and the behaviour of both components.

## Why (decisions and trade-offs)

- **Vue Router 5, not 4.** The spec names Router 4; 5.4 is current and the API used here is the same. Same reasoning as MSW 3.
- **Layouts are parent routes**, with pages as children. The layout stays mounted while pages change, and `requiresAuth` on the admin parent is inherited by every admin page (`matched.some(...)`), so the guard in PR 07 is a single check. The login page sits outside the admin layout on purpose: it must not show a sidebar to someone who is not signed in.
- **`createAppRouter(history)` is a factory**, not a singleton, so tests build a router over a memory history without touching the real URL.
- **No `scrollBehavior`.** Vue Router 5 deprecates it in favour of an experimental API. I did not want either in a code sample, so scroll and focus handling after navigation is left to PR 09 (the accessibility pass), where focus management is specified anyway.
- **Mobile-first CSS.** Base rules are phone rules; `min-width` queries (`48rem`, `64rem`) add tablet and desktop. Custom properties cannot be used inside media queries, so the two breakpoints are documented as literals in `tokens.css`.
- **Contrast was checked, not eyeballed.** Text pairs reach at least 4.5:1 in both themes (the lowest, success text on its tint, is 4.6:1). Dark mode needed two accent tokens: `--color-accent` is a fill that carries white text, `--color-accent-text` is a lighter tone for text and links on dark surfaces.
- **Only light and dark follow the OS.** There is no manual theme switch; the spec asks to respect `prefers-color-scheme`.
- **A bottom navigation bar is deferred.** The first sketch had one on phones, but with a single destination it would be noise. The cart (PR 05) brings a sticky cart bar on phones, which is the real mobile navigation need.
- **`defineOptions({ inheritAttrs: false })` in `BaseInput`.** Native attributes (`name`, `autocomplete`, `required`) go to the `<input>`, not the wrapper. It is the one `defineOptions` use; it does not make the component Options API.
- **`vue/require-default-prop` is off.** With type-based props an optional prop is just `undefined` when absent, and the rule forced noise defaults.
- **Boolean props have no `= false` default**: Vue already treats an absent boolean prop as `false`.

## Visual check

Checked with headless Chrome in both colour schemes at 375, 768 and 1280 px (guest page, admin page, login). Findings fixed: the login card touched the screen edges on a phone. Screenshots are not committed; run `pnpm dev` to see them.

## Size

About 1080 changed lines excluding the lockfile, of which 225 are tests and most of the rest is CSS (tokens, layouts, component styles). Over the ~600 guideline again; I kept it together because the layouts, tokens and the first components only make sense together.

## How to verify

```sh
pnpm install
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm dev
```

Then open `/`, `/admin/orders`, `/admin/login` and a made-up address; switch your OS between light and dark; narrow the window to 375 px. `pnpm build` shows each page as its own small chunk.

## Review talking points

1. Layouts as parent routes, and how `requiresAuth` inheritance keeps the later guard to one line.
2. The token system: what is a token, what is not, and why dark mode has `accent` and `accent-text`.
3. Mobile-first CSS and the two breakpoints.
4. `BaseInput` accessibility: label, `aria-describedby` and `aria-invalid`, and attribute forwarding.
5. Why the router is a factory and why scroll handling is not here.
