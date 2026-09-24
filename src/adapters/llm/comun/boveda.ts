// Tomado de ai-town: las llaves recordadas se cifran con una frase (PBKDF2 + AES-GCM); otras páginas del mismo origen solo ven texto cifrado.

const CLAVE = 'despiece:v1:boveda'
/** Recomendación vigente de OWASP para PBKDF2-SHA256; cada bóveda guarda la suya. */
const ITERACIONES = 600_000

export type Llavero = Record<string, string>

interface Sellada {
  v: 1
  iter: number
  sal: string
  iv: string
  datos: string
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (texto: string) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))

async function derivar(frase: string, sal: Uint8Array<ArrayBuffer>, iteraciones: number) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(frase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: iteraciones, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export function crearBoveda(almacen: Storage = localStorage, iteraciones = ITERACIONES) {
  return {
    existe() {
      try {
        return !!almacen.getItem(CLAVE)
      } catch {
        return false
      }
    },
    async sellar(llaves: Llavero, frase: string) {
      const sal = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const clave = await derivar(frase, sal, iteraciones)
      const datos = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, new TextEncoder().encode(JSON.stringify(llaves))))
      const sellada: Sellada = { v: 1, iter: iteraciones, sal: b64(sal), iv: b64(iv), datos: b64(datos) }
      almacen.setItem(CLAVE, JSON.stringify(sellada))
    },
    /** Falla si la frase no es la correcta. */
    async abrir(frase: string): Promise<Llavero> {
      const sellada = JSON.parse(almacen.getItem(CLAVE) ?? 'null') as Sellada | null
      if (!sellada) return {}
      if (sellada.v !== 1) throw new Error('Las llaves guardadas son de otra versión; olvídalas y vuelve a ponerlas.')
      const clave = await derivar(frase, unb64(sellada.sal), sellada.iter)
      try {
        const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sellada.iv) }, clave, unb64(sellada.datos))
        return JSON.parse(new TextDecoder().decode(plano)) as Llavero
      } catch {
        throw new Error('La frase no es correcta.')
      }
    },
    olvidar() {
      try {
        almacen.removeItem(CLAVE)
      } catch {
        /* no había nada guardado */
      }
    },
  }
}
