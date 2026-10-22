/** Reloads the page. Its own function so tests can replace it (jsdom cannot navigate). */
export function reloadPage(): void {
  window.location.reload()
}
