import { describe, expect, it } from 'vitest'
import { historyStep } from './historyStep'

const press = (key: string, extra: Partial<KeyboardEvent> = {}) => historyStep({ key, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, target: null, ...extra })

describe('the keys of undo and redo', () => {
  it('Ctrl+Z or ⌘Z undoes; with Shift, or Ctrl+Y, it redoes', () => {
    expect(press('z')).toBe('undo')
    expect(press('Z', { ctrlKey: false, metaKey: true })).toBe('undo')
    expect(press('z', { shiftKey: true })).toBe('redo')
    expect(press('y')).toBe('redo')
  })

  it('leaves the keys to the browser while typing, and takes no other key', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) expect(press('z', { target: { tagName } as unknown as EventTarget })).toBeNull()
    expect(press('z', { target: { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget })).toBeNull()
    expect(press('z', { target: { tagName: 'CANVAS' } as unknown as EventTarget })).toBe('undo')
    expect(press('z', { ctrlKey: false })).toBeNull()
    expect(press('z', { altKey: true })).toBeNull()
    expect(press('k')).toBeNull()
  })
})
