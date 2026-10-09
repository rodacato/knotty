import type { DebugAccess } from '../../ports/DebugAccess'

/** The debug tools are shown by the saved switch (Konami code, Ctrl+Shift+D, settings) or by `?debug` in the address. */
export const debugAccess = (debug: DebugAccess) => debug.visible() || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'))
