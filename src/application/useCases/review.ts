import { analyze } from '../../domain/analysis'
import type { Design } from '../../domain/design/schema'
import type { Catalog } from '../../domain/materials/catalog'
import { cutList } from '../../domain/materials/cutList'
import { estimatePurchase } from '../../domain/materials/purchase'
import { checkRequirements } from '../../domain/requirements/requirements'
import { currentDesign, type DesignState, type PurchaseReview } from '../../domain/session/state'
import { findingKey } from '../../domain/structure/finding'
import { reviewViability, worst } from '../../domain/viability/viability'
import { buildContext } from '../context'
import { ExpertError } from './expertCall'
import { reviewText } from './forExpert'
import type { Kit } from './kit'

/** A short, stable fingerprint of a text (FNV-1a plus its length). */
function fingerprint(text: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0
  return `${hash.toString(16)}-${text.length}`
}

/** The design as the review sees it: the finish only adds litres to the list, so choosing one does not ask for a new review. */
const reviewed = (design: Design) => {
  const { finish: _, ...rest } = design
  return rest
}

/** What a purchase review was made with, to know when to redo it; keyed on the design's content, so going back to an identical version keeps it. */
export const reviewSignature = (state: DesignState, effectiveCatalog: Catalog) =>
  JSON.stringify([fingerprint(JSON.stringify(reviewed(currentDesign(state)))), state.requirements.map((r) => r.id), state.accepted.map((a) => a.key), effectiveCatalog.layout, effectiveCatalog.materials.map((m) => [m.id, m.sheet])])

/** The review before buying: the arithmetic of the cuts and the checks, then the carpenter's opinion. */
export function createReview(kit: Kit) {
  const { catalog, now, save } = kit

  /** The arithmetic first, then the carpenter; if it does not answer, the review stands on the arithmetic alone. */
  async function reviewPurchase(state: DesignState, effectiveCatalog: Catalog, signal: AbortSignal): Promise<PurchaseReview> {
    const design = currentDesign(state)
    const analysis = analyze(design, catalog)
    if (!analysis.valid) throw new ExpertError(`El diseño tiene errores y no se puede revisar la compra: ${analysis.errors[0].message}`)
    const purchase = estimatePurchase(design, analysis.geo, effectiveCatalog)
    const unmet = checkRequirements(design, state.requirements).map((e) => e.message)
    const accepted = new Map(state.accepted.map((a) => [a.key, a.title]))
    const viability = reviewViability({
      design: design,
      geo: analysis.geo,
      catalog: effectiveCatalog,
      purchase: purchase,
      findings: analysis.findings.filter((h) => !accepted.has(findingKey(h))),
      unmet: unmet,
      accepted: analysis.findings.flatMap((h) => accepted.get(findingKey(h)) ?? []),
    })
    const base = { signature: reviewSignature(state, effectiveCatalog), checks: viability.checks, date: now() }
    try {
      const r = await kit.llm().reviewPurchase(
        {
          context: buildContext(state, catalog),
          review: reviewText(cutList(design, analysis.geo), viability.checks),
          design: design,
          checks: viability.checks,
          catalog: effectiveCatalog,
        },
        signal,
      )
      return { ...base, verdict: worst(viability.verdict, r.value.verdict), carpenter: { ...r.value, origin: r.origin }, error: null }
    } catch (e) {
      if (signal.aborted) throw e
      return { ...base, verdict: viability.verdict, carpenter: null, error: e instanceof Error ? e.message : 'El carpintero no contestó.' }
    }
  }

  /** Saved over the current state: the design may have changed while the carpenter was reviewing. */
  const saveReview = (state: DesignState, review: PurchaseReview) => save({ ...state, review: review })

  return { reviewPurchase, saveReview }
}
