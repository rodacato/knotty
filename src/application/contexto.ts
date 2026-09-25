import { analizar } from '../domain/analisis'
import { roundTo } from '../domain/diseno/resolve'
import { bitacoraCompacta } from '../domain/historial/historial'
import type { Catalogo } from '../domain/materiales/catalogo'
import { versionActual, type EstadoDiseno } from '../domain/sesion/estado'

// Se manda en cada ajuste: más contexto cuesta más y distrae al experto.
const PRESUPUESTO_TOKENS = 12_000
const MENSAJES_RECIENTES = 6
const tokens = (texto: string) => Math.ceil(texto.length / 3.5)

const SEVERIDAD = { critico: 'crítico', recomendacion: 'recomendación', detalle: 'detalle' }

/** Lo que el experto necesita para un ajuste, del más estable al más volátil; si no cabe, se recorta lo más prescindible. */
export function construirContexto(estado: EstadoDiseno, catalogo: Catalogo): string {
  const version = versionActual(estado)
  const diseno = version.diseno
  const analisis = analizar(diseno, catalogo, estado.requisitos)

  const fijo: string[] = [`## Diseño actual (v${version.n})`, '```json', JSON.stringify(diseno), '```']
  if (analisis.valido) {
    fijo.push(
      '',
      '## Geometría resuelta (solo lectura, mm): id: x0–x1 · y0–y1 · z0–z1 · espesor',
      ...[...analisis.geo.boxes].map(([id, c]) => `${id}: ${roundTo(c.x0)}–${roundTo(c.x1)} · ${roundTo(c.y0)}–${roundTo(c.y1)} · ${roundTo(c.z0)}–${roundTo(c.z1)} · ${analisis.geo.thicknesses.get(id)}`),
      '',
      '## Revisión estructural',
      ...(analisis.hallazgos.length
        ? analisis.hallazgos.map((h) => `- [${SEVERIDAD[h.severidad]}] ${h.codigo} ${h.piezas.join(', ')}: ${h.mensaje} Alternativas: ${h.alternativas.map((a) => `${a.descripcion} ${JSON.stringify(a.datos)}`).join('; ')}`)
        : ['Sin observaciones.']),
    )
  } else fijo.push('', '## Errores del diseño actual', ...analisis.errores.map((e) => `- ${e.codigo}: ${e.mensaje}`))

  fijo.push('', '## Requisitos del usuario', ...(estado.requisitos.length ? estado.requisitos.map((r) => `- [${r.id}] ${r.texto}`) : ['Ninguno todavía.']))
  if (estado.propuesta)
    fijo.push(
      '',
      '## Propuesta pendiente (no aplicada)',
      `"${estado.propuesta.resumen}" por el pedido "${estado.propuesta.motivo}". Operaciones: ${JSON.stringify(estado.propuesta.operaciones)}`,
      ...estado.propuesta.criticos.map((c) => `- Crítico ${c.codigo} ${c.piezas.join(', ')}: ${c.mensaje}`),
      'Si el usuario elige una opción, responde con las operaciones completas sobre el diseño actual: las de la propuesta más la solución.',
    )

  let decisiones = estado.decisiones.map((d) => `- ${d.tema}: ${d.texto}`)
  let bitacora = bitacoraCompacta(estado.versiones)
  let chat = estado.chat.slice(-MENSAJES_RECIENTES).map((m) => `${m.autor === 'usuario' ? 'Usuario' : 'Experto'}: ${m.texto}`)

  const armar = () =>
    [...fijo, '', '## Decisiones de diseño', ...(decisiones.length ? decisiones : ['Ninguna todavía.']), '', '## Bitácora de cambios', ...bitacora, '', '## Conversación reciente', ...chat].join('\n')

  while (tokens(armar()) > PRESUPUESTO_TOKENS) {
    if (chat.length > 2) chat = chat.slice(1)
    else if (bitacora.some((l) => !l.includes('pedido:'))) bitacora = bitacora.filter((l, i) => l.includes('pedido:') || i !== bitacora.findIndex((x) => !x.includes('pedido:')))
    else if (decisiones.length) decisiones = decisiones.slice(1)
    else break
  }
  return armar()
}
