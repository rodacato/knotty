import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

// Texturas generadas en el navegador: veta de pino para las caras y capas de triplay para los cantos. Nada que descargar.

export type TipoTextura = 'veta-u' | 'veta-v' | 'capas-u' | 'capas-v' | 'boceto'
export type Tono = 'triplay' | 'trasera'

const TAMANO = 512
const TONOS: Record<Tono, { base: string; veta: string; capaClara: string; capaOscura: string }> = {
  triplay: { base: '#dcb680', veta: '#b98752', capaClara: '#ecd6b0', capaOscura: '#c3955d' },
  trasera: { base: '#e3c9a0', veta: '#c49a68', capaClara: '#f0dcbc', capaOscura: '#caa272' },
}

function aleatorio(semilla: number) {
  let s = semilla
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function veta(ctx: CanvasRenderingContext2D, tono: Tono) {
  const t = TONOS[tono]
  const r = aleatorio(tono === 'triplay' ? 7 : 13)
  ctx.fillStyle = t.base
  ctx.fillRect(0, 0, TAMANO, TAMANO)
  for (let i = 0; i < 70; i++) {
    const y0 = r() * TAMANO
    const amplitud = 2 + r() * 10
    const frecuencia = 0.004 + r() * 0.01
    const fase = r() * Math.PI * 2
    ctx.strokeStyle = t.veta
    ctx.globalAlpha = 0.08 + r() * 0.22
    ctx.lineWidth = 0.6 + r() * 2.4
    ctx.beginPath()
    for (let x = 0; x <= TAMANO; x += 8) {
      const y = y0 + Math.sin(x * frecuencia + fase) * amplitud + Math.sin(x * frecuencia * 3.1) * amplitud * 0.25
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 0.05
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = r() > 0.5 ? '#ffffff' : t.veta
    ctx.fillRect(r() * TAMANO, r() * TAMANO, 1 + r() * 3, 1)
  }
  ctx.globalAlpha = 1
}

function capas(ctx: CanvasRenderingContext2D, tono: Tono) {
  const t = TONOS[tono]
  const n = tono === 'triplay' ? 7 : 3
  const alto = TAMANO / n
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? t.capaOscura : t.capaClara
    ctx.fillRect(0, i * alto, TAMANO, alto)
    ctx.fillStyle = 'rgba(80, 55, 30, 0.35)'
    ctx.fillRect(0, i * alto, TAMANO, 2)
  }
}

/** Papel con achurado de lápiz: la pieza que el experto no pudo confirmar. */
function boceto(ctx: CanvasRenderingContext2D) {
  const r = aleatorio(29)
  ctx.fillStyle = '#f4ede1'
  ctx.fillRect(0, 0, TAMANO, TAMANO)
  ctx.strokeStyle = '#5e574f'
  ctx.lineCap = 'round'
  for (let i = -TAMANO; i < TAMANO * 2; i += 22) {
    ctx.globalAlpha = 0.25 + r() * 0.2
    ctx.lineWidth = 1.2 + r() * 1.2
    ctx.beginPath()
    ctx.moveTo(i + r() * 4, TAMANO + r() * 4)
    ctx.lineTo(i + TAMANO + r() * 6, r() * 4)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

const cache = new Map<string, Texture>()

export function textura(tipo: TipoTextura, tono: Tono): Texture {
  const clave = `${tipo}|${tono}`
  const hecha = cache.get(clave)
  if (hecha) return hecha
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = TAMANO
  const ctx = lienzo.getContext('2d')!
  const transpuesta = tipo === 'veta-v' || tipo === 'capas-u'
  if (transpuesta) {
    ctx.translate(TAMANO, 0)
    ctx.rotate(Math.PI / 2)
  }
  if (tipo === 'boceto') boceto(ctx)
  else if (tipo.startsWith('veta')) veta(ctx, tono)
  else capas(ctx, tono)
  const t = new CanvasTexture(lienzo)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 4
  cache.set(clave, t)
  return t
}
