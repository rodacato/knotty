// Knotty was called Despiece at first, and its saved keys carried that name. This reads a value under its current key and,
// if it is only under the older one, moves it: the older copy goes away only once the new one is written.

export function readStored(storage: Storage, key: string, older: string): string | null {
  const current = storage.getItem(key)
  if (current !== null) return current
  const old = storage.getItem(older)
  if (old === null) return null
  try {
    storage.setItem(key, old)
    storage.removeItem(older)
  } catch {
    /* no room to move it: it stays readable under the older key */
  }
  return old
}

/** Removes a value under both its current and its older key. */
export function removeStored(storage: Storage, key: string, older: string) {
  storage.removeItem(key)
  storage.removeItem(older)
}

export const KEYS = {
  design: ['knotty:design', 'despiece:v1:diseno'],
  catalogSettings: ['knotty:catalog-settings', 'despiece:v1:catalogo'],
  expert: ['knotty:expert', 'despiece:v1:llm'],
  /** In sessionStorage: the keys remembered for this tab. */
  tabKeys: ['knotty:tab-keys', 'despiece:v1:llaves'],
  vault: ['knotty:vault', 'despiece:v1:boveda'],
} as const
