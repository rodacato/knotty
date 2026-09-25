// Taken from ai-town: remembered keys are encrypted with a passphrase (PBKDF2 + AES-GCM); other pages of the same origin only see ciphertext.

import { KEYS, readStored, removeStored } from '../../storedKey'

const [STORAGE_KEY, OLDER_KEY] = KEYS.vault
/** OWASP's current recommendation for PBKDF2-SHA256; each vault keeps its own. */
const ITERATIONS = 600_000

export type Keyring = Record<string, string>

interface Sealed {
  v: 2
  iterations: number
  salt: string
  iv: string
  data: string
}
/** How the first version sealed it: the same, with its fields in Spanish. */
interface SealedV1 {
  v: 1
  iter: number
  sal: string
  iv: string
  datos: string
}
const current = (s: Sealed | SealedV1): Sealed => (s.v === 1 ? { v: 2, iterations: s.iter, salt: s.sal, iv: s.iv, data: s.datos } : s)

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export function createVault(storage: Storage = localStorage, iterations = ITERATIONS) {
  return {
    exists() {
      try {
        return !!readStored(storage, STORAGE_KEY, OLDER_KEY)
      } catch {
        return false
      }
    },
    async seal(keys: Keyring, passphrase: string) {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const key = await derive(passphrase, salt, iterations)
      const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(keys))))
      const sealed: Sealed = { v: 2, iterations, salt: b64(salt), iv: b64(iv), data: b64(data) }
      storage.setItem(STORAGE_KEY, JSON.stringify(sealed))
    },
    /** Fails if the passphrase is not the right one. */
    async open(passphrase: string): Promise<Keyring> {
      const saved = JSON.parse(readStored(storage, STORAGE_KEY, OLDER_KEY) ?? 'null') as Sealed | SealedV1 | null
      if (!saved) return {}
      if (saved.v !== 1 && saved.v !== 2) throw new Error('Las llaves guardadas son de otra versión; olvídalas y vuelve a ponerlas.')
      const sealed = current(saved)
      const key = await derive(passphrase, unb64(sealed.salt), sealed.iterations)
      try {
        const flat = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.data))
        return JSON.parse(new TextDecoder().decode(flat)) as Keyring
      } catch {
        throw new Error('La frase no es correcta.')
      }
    },
    forget() {
      try {
        removeStored(storage, STORAGE_KEY, OLDER_KEY)
      } catch {
        /* nothing was stored */
      }
    },
  }
}
