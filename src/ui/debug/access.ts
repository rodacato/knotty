import type { DebugLog } from '../../ports/DebugLog'

/** The debug tools are shown by the saved switch (Konami code, Ctrl+Shift+D, settings) or by `?debug` in the address. */
export const debugAccess = (debug: DebugLog) => debug.visible() || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'))

/** The ficha the address asks to open, by its code: `?debug&ficha=kc-mes-01`. */
export const askedFicha = () => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('ficha'))
