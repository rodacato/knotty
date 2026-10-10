// Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y) in the Studio: which step a key press asks for, if any.

export type HistoryStep = 'undo' | 'redo'

/** Where typing has its own undo: the browser keeps those keys. */
const typing = (target: EventTarget | null) => {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null
  return !!element && (!!element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName ?? ''))
}

export function historyStep(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'target'>): HistoryStep | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || typing(e.target)) return null
  const key = e.key.toLowerCase()
  if (key === 'z') return e.shiftKey ? 'redo' : 'undo'
  return key === 'y' && !e.shiftKey ? 'redo' : null
}
