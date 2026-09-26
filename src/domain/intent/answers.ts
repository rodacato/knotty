import { analyze } from '../analysis'
import type { Design } from '../design/schema'
import type { Catalog } from '../materials/catalog'
import { estimatePurchase } from '../materials/purchase'
import { cm } from '../modules/common'
import { moduleOf, type FurniturePlan } from '../modules/plan'
import type { Topic } from './intent'

// The answers to the questions Knotty reads alone, from the same numbers the Materiales tab shows.

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

const joined = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : (parts[0] ?? ''))

/** The answer in Spanish, or null when the design cannot be measured (the expert answers then). */
export function answerQuestion(topic: Topic, design: Design, catalog: Catalog, plan: FurniturePlan | null): string | null {
  if (topic === 'measures') {
    const { width, height, depth } = design.dimensions
    const note = plan ? moduleOf(plan).measuresNote(plan, design.dimensions) : null
    return note ?? `Mide ${height} × ${width} × ${depth} mm (alto, ancho, fondo): ${cm(height)} de alto, ${cm(width)} de ancho y ${cm(depth)} de fondo.`
  }
  const analysis = analyze(design, catalog)
  if (!analysis.valid) return null
  const purchase = estimatePurchase(design, analysis.geo, catalog)
  const total = purchase.sheets.reduce((s, h) => s + h.sheets, 0)
  if (topic === 'sheets') {
    const lines = purchase.sheets.map((h) => `${h.sheets} de ${h.material.name}`)
    return `${total === 1 ? 'Una hoja' : `${total} hojas`} de triplay: ${joined(lines)}. Son para comprar, no un plano de corte; el acomodo de cada hoja está en Materiales.`
  }
  const sheets = purchase.sheets.reduce((s, h) => s + (h.cost ?? 0), 0)
  const rest = purchase.cost.total - sheets
  const missing = purchase.cost.missingPrices.length ? ` Sin precio: ${purchase.cost.missingPrices.join(', ')}.` : ''
  return `Unos ${pesos.format(purchase.cost.total)}: ${pesos.format(sheets)} de triplay (${total === 1 ? 'una hoja' : `${total} hojas`}) y ${pesos.format(rest)} de herrajes, cubrecanto${purchase.finish ? ' y acabado' : ''}. Son precios de referencia, no una cotización: pon los de tu tienda en Materiales.${missing}`
}
