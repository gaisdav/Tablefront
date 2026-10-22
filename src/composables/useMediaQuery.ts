import { getCurrentScope, onScopeDispose, shallowRef, type ShallowRef } from 'vue'

/** Whether a CSS media query matches right now, kept up to date as the window changes. */
export function useMediaQuery(query: string): Readonly<ShallowRef<boolean>> {
  const media = window.matchMedia(query)
  const matches = shallowRef(media.matches)

  function onChange(event: MediaQueryListEvent): void {
    matches.value = event.matches
  }
  media.addEventListener('change', onChange)
  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => {
      media.removeEventListener('change', onChange)
    })
  }
  return matches
}
