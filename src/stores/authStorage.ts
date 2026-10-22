const STORAGE_KEY = 'tablefront:admin-token'

// sessionStorage, not localStorage: the session ends with the tab, which is what a shared back-office
// computer needs. (The token is still readable by any script on the page, as with any browser
// storage; a real backend would use an HttpOnly cookie instead.)

/** The saved token, or null. Never throws: blocked storage is just "signed out". */
export function loadToken(): string | null {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY)
    return token === null || token === '' ? null : token
  } catch {
    return null
  }
}

/** Saves the token, or forgets it for null. Storage that is blocked or full is not an error. */
export function saveToken(token: string | null): void {
  try {
    if (token === null) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, token)
  } catch {
    // Nothing useful to do: the session then simply lasts until the page is reloaded.
  }
}
