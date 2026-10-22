# PR 03a — App shell, router, design tokens, first base components

First half of PR 03. 03b adds `BaseDialog`, `BaseSkeleton`, `AsyncBoundary`, `EmptyState`, `ErrorState` and `useAsyncState`.

## What changed

- **Router** (`src/router`): lazy routes for `/`, `/checkout`, `/orders/:id`, `/admin/login`, `/admin/orders`, `/admin/menu` and a 404, with typed route meta (`requiresAuth`). `/admin` redirects to the orders board. Pages are placeholders for now.
- **Layouts**: `GuestLayout` (sticky header, footer, skip link) and `AdminLayout` (tabs on a phone, fixed sidebar from 1024 px). The admin layout is lazy-loaded, so guests never download it.
- **Design tokens** (`src/styles/tokens.css`): colour (light and dark via `prefers-color-scheme`), spacing, radius, shadows, type scale, motion and the 44 px tap size, all as CSS custom properties. Components use only tokens.
- **Global styles**: a small reset, base typography, visible `:focus-visible` outlines, `.container`, `.visually-hidden`, a skip link, and a `prefers-reduced-motion` rule.
- **`BaseButton`** (primary / secondary / ghost / danger, `loading`, `disabled`, `block`) and **`BaseInput`** (visible label, hint, error linked with `aria-describedby` / `aria-invalid`, `v-model`).
- **Scroll handling**: back and forward restore the position, in-page links (the skip link) scroll to their target, any other navigation starts at the top.
- **Tests**: shell rendering for guest, admin and login, route resolution and meta inheritance, and the behaviour of both components.

## Why (decisions and trade-offs)

- **Vue Router 5, not 4.** The spec names Router 4; 5.4 is current and the API used here is the same. Same reasoning as MSW 3.
- **Layouts are parent routes**, with pages as children. The layout stays mounted while pages change, and `requiresAuth` on the admin parent is inherited by every admin page (`matched.some(...)`), so the guard in PR 07 is a single check. The login page sits outside the admin layout on purpose: it must not show a sidebar to someone who is not signed in.
- **`createAppRouter(history)` is a factory**, not a singleton, so tests build a router over a memory history without touching the real URL.
- **`scrollBehavior` despite the deprecation.** Vue Router 5 deprecates the option in favour of an experimental plugin (storage in `sessionStorage`, extra setup). Without any handling a user who scrolled a long menu would land mid-page after every navigation, so a three-line `scrollBehavior` is in (`src/router/scroll.ts`), with a lint exception that says why. Migrating to the stable replacement is the way out once it exists. Moving **focus** after navigation is still left to PR 09, where the spec puts it.
- **The 404 is a catch-all child of the guest layout record**, not a second record, so the header and footer stay mounted when moving between a page and the 404.
- **The skip link needs a focusable target.** `<main>` has `tabindex="-1"` so the link reliably moves focus into it; the focus ring on `main` itself is hidden because it is not interactive.
- **Mobile-first CSS.** Base rules are phone rules; `min-width` queries (`48rem`, `64rem`) add tablet and desktop. Custom properties cannot be used inside media queries, so the two breakpoints are documented as literals in `tokens.css`.
- **Contrast was checked, not eyeballed**, including button hover states. Text pairs reach at least 4.5:1 in both themes (the lowest, success text on its tint, is 4.6:1; the dark primary hover is 5.2:1). Dark mode needed separate tokens for fills and text: `--color-accent` is a fill that carries white text, `--color-accent-text` is a lighter tone for text and links on dark surfaces. In dark mode the primary button is a notch darker at rest and lightens on hover, so hover still lifts. The danger button has its own `--color-on-danger` and `--color-danger-hover` instead of borrowing the surface colour.
- **Only light and dark follow the OS.** There is no manual theme switch; the spec asks to respect `prefers-color-scheme`.
- **A bottom navigation bar is deferred.** The first sketch had one on phones, but with a single destination it would be noise. The cart (PR 05) brings a sticky cart bar on phones, which is the real mobile navigation need.
- **`BaseInput` attribute forwarding.** `class` and `style` go to the wrapper, so layout rules (grid placement, margins) move the whole field; every other attribute (`name`, `autocomplete`, `required`, ...) goes to the `<input>`. `id`, `type`, `aria-invalid` and `aria-describedby` are owned by the component and cannot be overridden, because overriding `id` would detach the label. `defineOptions({ inheritAttrs: false })` is the one `defineOptions` use; it does not make the component Options API.
- **No `type="number"` on `BaseInput`.** Its model is a string; a numeric field (cart quantity) will get its own control rather than a string that looks like a number.
- **A loading button stays enabled.** It sets `aria-busy` and `aria-disabled` and swallows the click (including the form submit) instead of using `disabled`, so keyboard focus is not thrown back to the page. The `disabled` prop still uses the real attribute.
- **Reduced motion keeps a loading cue.** The blanket `prefers-reduced-motion` rule would freeze the spinner, so the spinner pulses instead of rotating.
- **`vue/require-default-prop` is off.** With type-based props an optional prop is just `undefined` when absent, and the rule forced noise defaults.
- **Boolean props have no `= false` default**: Vue already treats an absent boolean prop as `false`.

## Visual check

Checked with headless Chrome in both colour schemes at 375, 768 and 1280 px (guest page, admin page, login). Findings fixed: the login card touched the screen edges on a phone. The dark-theme button states were checked by contrast calculation, not by screenshot. Screenshots are not committed; run `pnpm dev` to see them.

## Size

About 1270 changed lines excluding the lockfile, of which about 300 are tests and most of the rest is CSS (tokens, layouts, component styles). Over the ~600 guideline again; I kept it together because the layouts, tokens and the first components only make sense together.

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
5. Why the router is a factory, and why `scrollBehavior` is used despite being deprecated.
6. Why a loading button uses `aria-disabled` instead of `disabled`.
