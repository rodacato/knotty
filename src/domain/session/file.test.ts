import { describe, expect, it } from 'vitest'
import { designFileName, readDesignFile, toDesignFile } from './file'
import { savedState } from './state.fixture'
import oldSave from './state-v1.fixture.json'

const file = (state: unknown = savedState(), over: Record<string, unknown> = {}) => ({ ...toDesignFile(savedState(), '1.2.3', '2026-10-13T00:00:00.000Z'), state, ...over })

describe('design file', () => {
  it('names the file after the open design and reads the same session back', () => {
    const written = toDesignFile(savedState(3), '1.2.3', '2026-10-13T00:00:00.000Z')
    expect(written.name).toBe(savedState().versions[0].design.name)
    expect(readDesignFile(JSON.parse(JSON.stringify(written)))).toEqual({ ok: true, state: savedState(3) })
  })

  it('brings a session saved by an old Knotty up to the current format', () => {
    const read = readDesignFile(file(oldSave))
    expect(read.ok && read.state.format).toBe(9)
  })

  it('says a newer Knotty wrote it, by the envelope or by the session', () => {
    expect(readDesignFile(file(savedState(), { knotty: 2 }))).toEqual({ ok: false, reason: 'newer' })
    expect(readDesignFile(file({ ...savedState(), format: 10 }))).toEqual({ ok: false, reason: 'newer' })
  })

  it('does not take for a design what is not one', () => {
    for (const raw of [null, 'knotty', [], {}, savedState(), file(savedState(), { kind: 'room' }), file(savedState(), { knotty: '1' })]) {
      expect(readDesignFile(raw)).toEqual({ ok: false, reason: 'not-knotty' })
    }
  })

  it('rejects a session the schema does not accept', () => {
    expect(readDesignFile(file({ ...savedState(), versions: [] }))).toEqual({ ok: false, reason: 'invalid' })
    expect(readDesignFile(file(undefined, { state: undefined }))).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects a thumbnail that is not an image', () => {
    const link = 'https://example.com/a.png'
    expect(readDesignFile(file({ ...savedState(), thumbnails: [{ view: null, dataUrl: link }] }))).toEqual({ ok: false, reason: 'invalid' })
    const message = { id: 'm1', author: 'user', text: '', date: '', questions: [], answered: false, version: null, proposal: null, error: false, thumbnail: 'javascript:alert(1)' }
    expect(readDesignFile(file({ ...savedState(), chat: [message] }))).toEqual({ ok: false, reason: 'invalid' })
    expect(readDesignFile(file({ ...savedState(), chat: [{ ...message, thumbnail: 'data:image/png;base64,AA' }] })).ok).toBe(true)
  })

  it('builds a file name any system accepts', () => {
    expect(designFileName('Librero de Niño 2.0')).toBe('librero-de-nino-2-0.knotty')
    expect(designFileName('../../etc/passwd')).toBe('etc-passwd.knotty')
    expect(designFileName('¿?')).toBe('mueble.knotty')
    expect(designFileName('a'.repeat(200))).toBe(`${'a'.repeat(60)}.knotty`)
  })
})
