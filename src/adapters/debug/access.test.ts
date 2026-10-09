import { describe, expect, it } from 'vitest'
import { createLocalDebugAccess } from './access'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k), clear: () => data.clear(), key: () => null, length: 0 }
}

describe('createLocalDebugAccess', () => {
  it('stays hidden until asked for, and remembers it across reloads', () => {
    const storage = memoryStorage()
    expect(createLocalDebugAccess(storage).visible()).toBe(false)
    createLocalDebugAccess(storage).setVisible(true)
    expect(createLocalDebugAccess(storage).visible()).toBe(true)
    createLocalDebugAccess(storage).setVisible(false)
    expect(createLocalDebugAccess(storage).visible()).toBe(false)
  })

  it('a storage that throws leaves it hidden instead of breaking the app', () => {
    const denied = () => {
      throw new Error('denied')
    }
    const access = createLocalDebugAccess({ ...memoryStorage(), getItem: denied, setItem: denied })
    expect(() => access.setVisible(true)).not.toThrow()
    expect(access.visible()).toBe(false)
  })
})
