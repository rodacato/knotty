import type { Analysis } from '../../domain/checks/analysis'
import type { Design } from '../../domain/design/schema'
import { estimatePurchase } from '../../domain/estimate/purchase'
import type { Catalog } from '../../domain/materials/catalog'

// What a built variant comes to, small enough to keep in git: a change to the rules or the builders that moves a piece, a joint or what there is to buy shows as a changed line.

export interface Fingerprint {
  pieces: number
  /** Outside measures of everything the variant is made of, in mm. */
  size: [number, number, number]
  /** Every piece by id, role, material, position and cuts: any piece that moves changes it. */
  hash: string
  joints: Record<string, number>
  sheets: Record<string, number>
  hardware: Record<string, number>
  /** Findings and warnings the review raises. */
  notes: number
}

/** FNV-1a over the text: not a security hash, only a cheap one that does not depend on the platform. */
function fnv(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(16).padStart(8, '0')
}

const round = (mm: number) => Math.round(mm * 10) / 10
const counted = <T>(items: T[], key: (item: T) => string, count: (item: T) => number = () => 1) =>
  Object.fromEntries([...items.reduce((m, i) => m.set(key(i), (m.get(key(i)) ?? 0) + count(i)), new Map<string, number>())].sort(([a], [b]) => a.localeCompare(b)))

export function fingerprint(design: Design, analysis: Extract<Analysis, { valid: true }>, catalog: Catalog): Fingerprint {
  const { boxes } = analysis.geo
  const pieces = [...design.pieces].sort((a, b) => a.id.localeCompare(b.id))
  const all = [...boxes.values()]
  const extent = (lo: 'x0' | 'y0' | 'z0', hi: 'x1' | 'y1' | 'z1'): number => round(Math.max(...all.map((b) => b[hi])) - Math.min(...all.map((b) => b[lo])))
  const purchase = estimatePurchase(design, analysis.geo, catalog)
  return {
    pieces: pieces.length,
    size: [extent('x0', 'x1'), extent('y0', 'y1'), extent('z0', 'z1')],
    hash: fnv(pieces.map((p) => { const b = boxes.get(p.id); return [p.id, p.role, p.material, b ? [b.x0, b.x1, b.y0, b.y1, b.z0, b.z1].map(round).join(',') : '-', p.cuts?.length ?? 0, ...(p.slants?.length ? [JSON.stringify(p.slants)] : []), ...(p.rounds?.length ? [JSON.stringify(p.rounds)] : [])].join('|') }).join('\n')),
    joints: counted(design.joints, (u) => u.type),
    sheets: counted(purchase.sheets, (s) => s.material.id, (s) => s.sheets),
    hardware: counted(purchase.hardware, (h) => h.hardware.id, (h) => h.count),
    notes: analysis.findings.length + analysis.warnings.length,
  }
}
