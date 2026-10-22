// vue-tsc resolves `.vue` files natively; this shim only exists so typescript-eslint,
// which cannot read SFCs, sees a component type instead of `error` on `.vue` imports.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
