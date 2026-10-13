import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { toDesignFile } from '../../domain/session/file'
import { savedState } from '../../domain/session/state.fixture'
import { createGzipDesignFileCodec, DESIGN_FILE_LIMITS } from './gzip'

const codec = createGzipDesignFileCodec('1.2.3', () => new Date('2026-10-13T00:00:00.000Z'))
const text = (s: string) => new Blob([s])
const blob = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes)])
const plainFile = JSON.stringify(toDesignFile(savedState(), '1.2.3', '2026-10-13T00:00:00.000Z'))

describe('gzip design file codec', () => {
  it('reads back the session it wrote, from a file smaller than its JSON', async () => {
    const bytes = await codec.encode(savedState(4))
    expect(bytes.length).toBeLessThan(JSON.stringify(savedState(4)).length)
    expect(await codec.decode(blob(bytes))).toEqual({ ok: true, state: savedState(4) })
  })

  it('writes gzip over the JSON envelope, with the app version and the date', async () => {
    const written = JSON.parse(await new Response(new Blob([await codec.encode(savedState())]).stream().pipeThrough(new DecompressionStream('gzip'))).text())
    expect(written).toMatchObject({ knotty: 1, kind: 'design', app: '1.2.3', exportedAt: '2026-10-13T00:00:00.000Z' })
  })

  it('reads a file edited by hand and left as plain JSON', async () => {
    expect(await codec.decode(text(plainFile))).toEqual({ ok: true, state: savedState() })
  })

  it('rejects what is not a Knotty file without throwing', async () => {
    const truncated = (await codec.encode(savedState())).slice(0, 40)
    for (const file of [new Blob(), text('hola'), blob(new Uint8Array([0x1f, 0x8b, 1, 2, 3])), blob(truncated), blob(gzipSync('not json')), blob(new Uint8Array([0xff, 0xfe, 0xfd])), text('{"a":1}')]) {
      expect(await codec.decode(file)).toEqual({ ok: false, reason: 'not-knotty' })
    }
  })

  it('passes on why the domain rejected the content', async () => {
    const newer = JSON.stringify({ ...JSON.parse(plainFile), knotty: 2 })
    expect(await codec.decode(blob(gzipSync(newer)))).toEqual({ ok: false, reason: 'newer' })
  })

  it('stops a small file that expands past the limit', async () => {
    const bomb = blob(gzipSync(Buffer.alloc(4 * 1024 * 1024)))
    expect(bomb.size).toBeLessThan(DESIGN_FILE_LIMITS.fileBytes)
    const strict = createGzipDesignFileCodec('1.2.3', undefined, { fileBytes: DESIGN_FILE_LIMITS.fileBytes, inflatedBytes: 1024 * 1024 })
    expect(await strict.decode(bomb)).toEqual({ ok: false, reason: 'too-large' })
  })

  it('rejects a file over the size limit before reading it', async () => {
    const strict = createGzipDesignFileCodec('1.2.3', undefined, { fileBytes: 100, inflatedBytes: DESIGN_FILE_LIMITS.inflatedBytes })
    expect(await strict.decode(text(plainFile))).toEqual({ ok: false, reason: 'too-large' })
  })
})
