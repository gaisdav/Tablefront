/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Starts the mock API (MSW) in the browser. Always on in `pnpm dev`; in a production build it
   * is on only when this is the string "true" (the demo build). A real production build leaves
   * it unset, and the mock code is then dropped from the bundle.
   */
  readonly VITE_ENABLE_MOCKS?: string
}
