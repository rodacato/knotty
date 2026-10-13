import { readDesignFile, toDesignFile, type DesignFileResult } from '../../domain/session/file'
import type { DesignFileCodec } from '../../ports/DesignFileCodec'

const MEBIBYTE = 1024 * 1024
/** A session with a full history stays under a few MB of JSON; these leave room without letting a file exhaust memory. */
export const DESIGN_FILE_LIMITS = { fileBytes: 16 * MEBIBYTE, inflatedBytes: 32 * MEBIBYTE }

const isGzip = (bytes: Uint8Array) => bytes[0] === 0x1f && bytes[1] === 0x8b

async function gzip(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Null when it grows past `limit`; a small file must not expand without bound. */
async function gunzip(bytes: Uint8Array<ArrayBuffer>, limit: number): Promise<Uint8Array | null> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const inflated = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    inflated.set(chunk, offset)
    offset += chunk.length
  }
  return inflated
}

export function createGzipDesignFileCodec(app: string, now: () => Date = () => new Date(), limits = DESIGN_FILE_LIMITS): DesignFileCodec {
  return {
    encode: (state) => gzip(JSON.stringify(toDesignFile(state, app, now().toISOString()))),
    async decode(file): Promise<DesignFileResult> {
      if (file.size > limits.fileBytes) return { ok: false, reason: 'too-large' }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const plain = isGzip(bytes) ? await gunzip(bytes, limits.inflatedBytes) : bytes
        if (!plain) return { ok: false, reason: 'too-large' }
        return readDesignFile(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain)))
      } catch {
        return { ok: false, reason: 'not-knotty' }
      }
    },
  }
}
