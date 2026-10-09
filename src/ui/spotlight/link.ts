const PARAM = 'ficha'

/** The address that opens a ficha by its code, on whatever address the app is served from. */
export function fichaLink(code: string, at: Pick<Location, 'origin' | 'pathname'> = location): string {
  return `${at.origin}${at.pathname}?${PARAM}=${encodeURIComponent(code)}`
}

/** The ficha an address asks for, and the same address without asking for it. */
export function linkedFicha(search: string): { code: string; rest: string } | null {
  const params = new URLSearchParams(search)
  const code = params.get(PARAM)?.trim().toUpperCase()
  if (!code) return null
  params.delete(PARAM)
  const rest = params.toString().replace(/=(?=&|$)/g, '')
  return { code, rest: rest ? `?${rest}` : '' }
}
