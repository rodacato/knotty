import { manufacturingProblems } from '../../domain/design/manufacturing'
import { RepairConstruction } from '../takeaway/RepairConstruction'
import { ArrowCounterClockwise, ArrowDown, Check, PencilSimple, Printer, Sliders, Warning } from '@phosphor-icons/react'
import { useMemo, useState, type ReactNode } from 'react'
import { isDrawerPart, wallOf, WALLS, type Design } from '../../domain/design/schema'
import type { Geometry } from '../../domain/design/resolve'
import { anchoringAdvice, WALL_LABELS, type Anchoring } from '../../domain/estimate/anchoring'
import { applySettings, type LayoutSettings, type Catalog } from '../../domain/materials/catalog'
import { reviewSignature } from '../../application/useCases'
import { heldByAnchor } from '../../domain/checks/structure/rules/usage'
import { counterLines, counterList } from '../../domain/estimate/counterList'
import { estimatePurchase } from '../../domain/estimate/purchase'
import { HOW_TO_ANCHOR } from '../../domain/furniture/modules/common'
import { COVERAGE_EFFICIENCY, type FinishPurchase } from '../../domain/estimate/finishPurchase'
import { FINISH_IDS, FINISH_PRODUCTS, FINISHES, finishCare, finishOf, type FinishLayer } from '../../domain/materials/finishes'
import type { DesignState } from '../../domain/session/state'
import { EDGE_LABEL, profiledEdges } from '../../domain/design/edges'
import { EDGE_PROFILES } from '../../domain/materials/edgeProfiles'
import { hasRouter } from '../../domain/materials/tools'
import { Button } from '../system/components'
import { RadioCard, RadioGroup } from '../system/RadioCard'
import { ErrorText, Field, Input } from '../system/Field'
import { HelpButton, HelpPanel, useHelp } from '../system/Help'
import { TERMS } from '../glossary'
import { useStore } from '../store'
import { pendingId, ReviewChecks, ReviewGate, VerdictCard, VerdictSummary } from './Verdict'
import type { MaterialLayout } from '../../domain/estimate/layout'
import { Thumbnail } from '../capture/Thumbnail'
import { purchaseReviewItems } from '../../domain/session/purchaseReview'
import { BeforeLeaving, CopyList } from './CopyList'
import { lineNumbers } from './copyListLabels'
import { CutList } from './CutList'
import { Section } from './Section'
import { meters, percent, SheetDiagram } from './SheetDiagram'
import { finishCounted, leftOut, sheetsHeading, totalCovers } from './totalSummary'
import { reviewNotes } from '../takeaway/reviewNotes'
import { assemblyPhases } from '../takeaway/assemblyPhases'

const weights = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const decimal = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 2 })

/** A price the person can correct with their store's; the change lives on their device. */
function Price({ id, value, base, unit }: { id: string; value: number | null; base: number | null; unit: string }) {
  const settings = useStore((s) => s.catalogSettings)
  const save = useStore((s) => s.saveCatalogSettings)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const changed = id in settings.prices

  const confirm = () => {
    const n = Number(text.replace(/[$,\s]/g, ''))
    save({ ...settings, prices: { ...settings.prices, [id]: text.trim() === '' || !Number.isFinite(n) ? null : n } })
    setEditing(false)
  }
  const reset = () => {
    const { [id]: _, ...rest } = settings.prices
    save({ ...settings, prices: rest })
  }

  if (editing)
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          confirm()
        }}
      >
        <Input
          size="sm"
          autoFocus
          onFocus={(e) => e.target.select()}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Precio en pesos"
          className="w-24 text-right"
        />
        <button type="submit" aria-label="Guardar precio" className="relative grid size-7 place-items-center bg-graphite text-bone before:absolute before:-inset-2 before:content-['']">
          <Check size={12} weight="bold" />
        </button>
      </form>
    )
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setText(value === null ? '' : String(value))
          setEditing(true)
        }}
        className={`numerals relative inline-flex items-center gap-1 px-1 text-[0.9em] before:absolute before:-inset-x-1 before:-inset-y-3.5 before:content-['']  transition hover:bg-kraft ${changed ? 'text-graphite' : 'text-graphite'}`}
        title="Cambiar por el precio de tu tienda"
      >
        {value === null ? 'sin precio' : `${changed ? '' : '~'}${weights.format(value)} ${unit}`}
        <span className={`px-1 text-[0.85em] font-semibold ${changed ? 'bg-graphite text-bone' : 'text-graphite'}`}>{changed ? 'tu precio' : 'ref.'}</span>
        <PencilSimple size={11} />
      </button>
      {changed && value !== base && (
        <button type="button" onClick={reset} aria-label="Volver al precio del catálogo" title="Volver al precio del catálogo" className="relative text-graphite-2 before:absolute before:-inset-[18px] before:content-[''] hover:text-graphite">
          <ArrowCounterClockwise size={11} />
        </button>
      )}
    </span>
  )
}

function CutSettings({ base }: { base: LayoutSettings }) {
  const settings = useStore((s) => s.catalogSettings)
  const save = useStore((s) => s.saveCatalogSettings)
  const current = settings.layout ?? base
  const help = useHelp<keyof LayoutSettings>()
  const keys: (keyof LayoutSettings)[] = ['trim', 'kerf', 'clearance']
  return (
    <details className="text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
        <Sliders /> Opciones de la maderería
      </summary>
      <p className="mb-2 text-xs leading-relaxed text-graphite-2">Usa los valores del catálogo, salvo que tu maderería indique otros. Cambiarlos recalcula las hojas y requiere otra revisión.</p>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <Field
            key={key}
            label={
              <span className="flex items-center gap-0.5">
                {TERMS[key].name} <HelpButton term={TERMS[key]} open={help.open === key} onToggle={() => help.toggle(key)} />
              </span>
            }
          >
            <Input
              type="number"
              min={0}
              step={1}
              unit="mm"
              value={current[key]}
              onChange={(e) => save({ ...settings, layout: { ...current, [key]: Math.max(0, Number(e.target.value)) } })}
            />
          </Field>
        ))}
      </div>
      {help.open && (
        <div className="mt-2">
          <HelpPanel term={TERMS[help.open]} onClose={help.close} />
        </div>
      )}
      {settings.layout && (
        <button type="button" className="mt-2 text-xs text-graphite-2 underline" onClick={() => save({ ...settings, layout: null })}>
          Volver a los valores del catálogo
        </button>
      )}
    </details>
  )
}

const LAYER_NAME: Record<FinishLayer['role'], string> = { sealer: 'de sellador', primer: 'de primario', finish: '' }
const coatsOf = (layers: FinishLayer[]) =>
  layers.map((l) => (l.coats === null ? `la referencia no dice cuántas manos ${LAYER_NAME[l.role]}`.trim() : `${l.coats} ${l.coats === 1 ? 'mano' : 'manos'} ${LAYER_NAME[l.role]}`.trim())).join(' y ')

/** The edges the person profiled in the piece sheet, with their length: what to do by hand and what to ask the lumberyard for. */
function ProfiledEdges({ design, geo }: { design: Design; geo: Geometry }) {
  const level = useStore((s) => s.catalogSettings.toolLevel)
  const lines = profiledEdges(design, geo)
  if (!lines.length) return null
  const name = (id: string) => design.pieces.find((p) => p.id === id)?.name ?? id
  const toOrder = lines.some((l) => EDGE_PROFILES[l.profile].router) && !hasRouter(level)
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">Perfil de los cantos</p>
      <ul className="flex flex-col gap-1 text-xs text-graphite">
        {lines.map((l) => (
          <li key={`${l.piece}-${l.profile}`}>
            <span className="font-medium text-graphite">{name(l.piece)}</span>: {l.edges.map((e) => EDGE_LABEL[e].toLowerCase()).join(', ')} · {EDGE_PROFILES[l.profile].name.toLowerCase()} ·{' '}
            <span className="numerals">{meters(l.length)}</span>
            {EDGE_PROFILES[l.profile].router && !hasRouter(level) && ' · pídelo en la maderería'}
          </li>
        ))}
      </ul>
      {toOrder && <p className="text-xs text-graphite-2">Sin router, la maderería puede rutear los cantos; lleva esta lista con las piezas.</p>}
    </div>
  )
}

/** The wall an anchored piece goes on: it decides the plugs in the list, so it is asked where they are bought. */
function WallQuestion({ design, anchoring }: { design: Design; anchoring: Anchoring | null }) {
  const choose = useStore((s) => s.chooseWall)
  return (
    <div className={`flex flex-col gap-2 py-2 pl-4 ${wallOf(design) === 'unknown' ? 'border-l-8 border-graphite' : ''}`}>
      {wallOf(design) === 'unknown' && (
        <p className="flex items-center gap-1.5 text-base font-semibold">
          <Warning weight="bold" aria-hidden /> Dato pendiente: anclajes al muro
        </p>
      )}
      <p className="font-display text-xl font-semibold uppercase md:text-2xl">¿De qué es el muro donde va?</p>
      <RadioGroup label="Tipo de muro" className="flex flex-wrap gap-1.5">
        {WALLS.map((wall) => (
          <RadioCard key={wall} variant="pill" checked={wallOf(design) === wall} onChange={() => choose(wall)} className="min-h-11 px-4 py-2 text-sm md:text-base">
            {WALL_LABELS[wall]}
          </RadioCard>
        ))}
      </RadioGroup>
      <p role="note" className="text-base leading-snug text-graphite md:text-lg">
        {anchoringAdvice(anchoring)}
      </p>
      {wallOf(design) === 'unknown' && <p className="text-base text-graphite">Si no lo sabes, puedes consultar la guía. La lista aún no incluye los taquetes para ese muro; confirma cuáles corresponden antes de comprarlos.</p>}
    </div>
  )
}

/** The finish the person picks and what it takes: litres, containers and sandpaper. */
function FinishSection({ design, geo, finish, base }: { design: Design; geo: Geometry; finish: FinishPurchase | null; base: (id: string) => number | null }) {
  const choose = useStore((s) => s.chooseFinish)
  const settings = useStore((s) => s.catalogSettings)
  const chosen = FINISHES[finishOf(design)]
  const care = finishCare(finishOf(design))
  return (
    <>
      <Section minor title="Acabado" aside={`${chosen.name} · Cambiar y ver insumos`}>
        <div className="flex flex-col gap-3">
          <RadioGroup label="Acabado" className="flex flex-wrap gap-1.5">
            {FINISH_IDS.map((id) => (
              <RadioCard key={id} variant="pill" checked={finishOf(design) === id} onChange={() => choose(id)} className="px-3 py-1.5 text-xs">
                {FINISHES[id].name}
              </RadioCard>
            ))}
          </RadioGroup>
          <p className="text-sm leading-relaxed text-graphite">{chosen.advice}</p>
          <ProfiledEdges design={design} geo={geo} />
          {finish && (
            <ul className="flex flex-col divide-y divide-line border-b border-line">
              <li className="py-3 text-xs leading-relaxed text-graphite">
                <span className="numerals font-medium text-graphite">{decimal(finish.area)} m²</span> por acabar: las dos caras de cada pieza (la de la trasera que va al muro no){design.pieces.some((p) => p.edges.length) ? ' y los cantos con cubrecanto' : ''}. Litros = área × manos ÷ (rendimiento de la ficha × {COVERAGE_EFFICIENCY}).
              </li>
              {finish.lines.map((l) => {
                const product = FINISH_PRODUCTS[l.product]
                const { touch, recoat, use } = product.drying
                const drying = [touch && `tacto ${touch}`, recoat && `entre manos ${recoat}`, use && `uso ${use}`].filter(Boolean).join(' · ')
                return (
                  <li key={l.product} className="flex flex-col gap-2 py-3">
                    <div className="flex items-start gap-3">
                      <span className="numerals min-w-12 shrink-0 text-sm font-medium">{l.litres === null ? '¿?' : `${decimal(l.litres)} L`}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">
                          {product.name} <span className="text-graphite-2">({product.example})</span>
                        </span>
                        <span className="block text-xs text-graphite-2">{coatsOf(FINISHES[finish.finish].layers.filter((x) => x.product === l.product))}</span>
                        {drying && <span className="block text-xs text-graphite-2">Secado: {drying}</span>}
                        {l.litres === null && <span className="block text-xs font-medium text-graphite">La referencia no da su rendimiento en m² por litro: pregunta en la tienda cuánto llevar.</span>}
                      </span>
                    </div>
                    {l.containers.map((c) => (
                      <div key={c.sku.id} className="flex items-center gap-3 pl-15">
                        <span className="min-w-0 flex-1 text-xs">
                          {c.count} × {c.sku.name}
                        </span>
                        <span className="flex flex-col items-end">
                          <span className="numerals text-sm">{c.sku.price === null ? '—' : `${c.sku.id in settings.prices ? '' : '~'}${weights.format(c.sku.price * c.count)}`}</span>
                          <Price id={c.sku.id} value={c.sku.price} base={base(c.sku.id)} unit="c/u" />
                        </span>
                      </div>
                    ))}
                  </li>
                )
              })}
              {finish.sandpaper.length > 0 && (
                <li className="py-3 text-sm">
                  Lija grano {finish.sandpaper.join(', ').replace(/, (\d+)$/, ' y $1')}
                  <span className="block text-xs text-graphite">La referencia no dice cuántos pliegos por m²: calcula al comprar.</span>
                </li>
              )}
            </ul>
          )}
        </div>
      </Section>
      {care.length > 0 && (
        <div role="note" aria-label="Cuidados del acabado" className="mb-4 flex flex-col gap-1.5 border-l-8 border-graphite py-1 pl-4 text-[15px] leading-snug">
          {care.map((line) => <p key={line.text}>{line.text}</p>)}
        </div>
      )}
    </>
  )
}

/**
 * The furniture being bought for, beside its verdict on a desktop (UI-93). The piece chosen on a sheet is hatched here too,
 * labelled as the sheet labels it; the phone has no room for it and keeps its column.
 */
function Furniture({ geo, layout, numbers, chosen, onChoose }: { geo: Geometry; layout: MaterialLayout[]; numbers: Map<string, number>; chosen: string | null; onChoose: (id: string) => void }) {
  const cut = chosen ? layout.flatMap((a) => a.sheets.flatMap((s) => s.placed)).find((c) => c.id === chosen) : undefined
  const number = cut && numbers.get(cut.id)
  return (
    <figure className="relative max-lg:hidden">
      <div className="mx-auto aspect-[16/9] max-h-[340px] w-full px-6 pt-12">
        <Thumbnail boxes={geo.boxes} ink chosen={cut ? cut.id : null} onChoose={onChoose} />
      </div>
      {cut && (
        <figcaption className="absolute top-0 left-0 border-2 border-graphite bg-bone">
          <span className="block bg-graphite px-3 py-1 font-display text-xl leading-tight font-semibold text-bone">{number ? `${number}. ${cut.name}` : cut.name}</span>
          <span className="numerals block px-3 py-1 text-base">{Math.round(cut.rotated ? cut.h : cut.w)} × {Math.round(cut.rotated ? cut.w : cut.h)} mm</span>
        </figcaption>
      )}
    </figure>
  )
}

export function Materials({ state, design, geo, catalog, instead, onRequest }: { state: DesignState; design: Design; geo: Geometry; catalog: Catalog; instead: string | null; onRequest: (text: string) => void }) {
  const settings = useStore((s) => s.catalogSettings)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const openTakeAway = useStore((s) => s.openTakeAway)
  const reviewing = useStore((s) => s.reviewing)
  const reviewNotice = useStore((s) => s.reviewNotice)
  const verdictError = useStore((s) => s.verdictError)
  const effective = useMemo(() => applySettings(catalog, settings), [catalog, settings])
  const purchase = useMemo(() => estimatePurchase(design, geo, effective), [design, geo, effective])
  const blocks = useMemo(() => counterLines(design, geo, purchase), [design, geo, purchase])
  const numbers = useMemo(() => lineNumbers(blocks), [blocks])
  const message = useMemo(() => {
    const notes = reviewNotes(state, effective)
    const list = counterList(design, geo, purchase, effective.layout)
    return notes.length ? `${notes.join('\n')}\n\n${list}` : list
  }, [state, design, geo, purchase, effective])
  const anchor = useMemo(() => heldByAnchor(design, geo, catalog), [design, geo, catalog])
  const [anyway, setAnyway] = useState<string | null>(null)
  const base = (id: string) => [...catalog.materials, ...catalog.hardware, ...catalog.finishes].find((x) => x.id === id)?.price ?? null
  const totalSheets = purchase.sheets.reduce((s, h) => s + h.sheets, 0)
  const own = Object.keys(settings.prices).length
  const onlyPlywood = purchase.sheets.every((h) => h.material.grade === 'pine-plywood')
  const withFinish = finishCounted(purchase.finish?.lines.flatMap((l) => l.containers.map((c) => c.sku.price)) ?? [])
  const unpriced = leftOut(purchase.cost.missingPrices)
  const verdict = state.review?.signature === reviewSignature(state, effective) ? state.review : null

  const constructionProblems = manufacturingProblems(design, geo)
  const construction = constructionProblems.length > 0 && (
    <div role="note" className="flex flex-col gap-1 border-l-8 border-graphite py-1 pl-4">
      <p className="flex items-center gap-1.5 text-base font-semibold">
        <Warning weight="bold" aria-hidden /> Corrige los ajustes antes de cortar
      </p>
      {constructionProblems.map((p) => <p key={p.detail} className="text-[15px]">{p.detail}</p>)}
      <RepairConstruction state={state} />
    </div>
  )

  const whose = instead && (
    <p role="note" className="border-l-8 border-graphite py-1 pl-4 text-[15px] leading-snug">
      En el Estudio estás viendo {instead}. El costo, la revisión y la lista de aquí son de tu diseño actual.
    </p>
  )

  const phaseCount = assemblyPhases(state).length
  const guideLabel = phaseCount ? 'Ver guía para construir' : 'Ver guía de cortes'

  // The head of the ticket: the cost and what it covers, as one ruled row (UI-93).
  const head = (
    <section className="flex flex-col gap-2" aria-label="Costo aproximado">
      {/* Only the figure is boxed, like the total on a ticket; what it covers reads beside it, past a rule. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1 border-[3px] border-graphite px-4 py-3">
          <p className="font-display text-lg leading-none font-semibold uppercase">Costo aproximado</p>
          <p className="numerals text-5xl leading-none font-semibold">
            <span className="text-graphite-2">~</span>
            {weights.format(purchase.cost.total)}
          </p>
        </div>
        {verdict && <p className="min-w-48 flex-1 border-l-[3px] border-graphite pl-6 text-lg text-graphite md:text-xl">{totalCovers({ sheets: totalSheets, onlyPlywood, withBanding: purchase.edgeBanding > 0, withFinish })}</p>}
      </div>
      {unpriced && <p className="max-w-3xl text-base text-graphite md:text-lg">{unpriced}</p>}
      <p className="text-base leading-relaxed text-graphite">Precios de referencia en MXN, no una cotización.</p>
    </section>
  )

  // On a desktop the page opens on two halves (UI-93): what is being built and what it costs, beside the verdict and what is left to decide. The phone stacks them.
  // `tall`: the left half also runs beside the next step, which sits in the grid's second row.
  const left = (tall: boolean) => (
    <div className={`flex flex-col gap-4 lg:border-y-[3px] lg:border-r-[3px] lg:border-graphite lg:py-6 lg:pr-8 ${tall ? 'lg:row-span-2' : ''}`}>
      <Furniture geo={geo} layout={purchase.layout} numbers={numbers} chosen={selection} onChoose={select} />
      {head}
    </div>
  )
  const band = (right: ReactNode) => (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-0">
      {left(false)}
      <div className="flex min-w-0 flex-col gap-6 lg:border-y-[3px] lg:border-graphite lg:py-6 lg:pl-8">{right}</div>
    </div>
  )

  // The total shows before the review (UI-16); the shopping list only after it, and if it is not viable it has to be asked for on purpose.
  if (!verdict || reviewing)
    return (
      <div className="relative flex flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        {whose}
        {band(<>
          {construction}
          <ReviewGate stale={state.review !== null} />
        </>)}
        <CutSettings base={catalog.layout} />
      </div>
    )
  if (verdict.verdict === 'not-viable' && anyway !== verdict.signature)
    return (
      <div className="relative flex flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        {whose}
        {band(<>
          <VerdictSummary verdict={verdict} />
          {construction}
          <VerdictCard key={`${verdict.signature}:${verdict.date}`} verdict={verdict} design={design} onRequest={onRequest} />
          <p className="text-sm text-graphite">
            Con estos problemas, lo que compres probablemente no sirva.{' '}
            <button type="button" className="underline" onClick={() => setAnyway(verdict.signature)}>
              Ver la lista de todos modos
            </button>
          </p>
        </>)}
        <ReviewChecks verdict={verdict} />
        <CutSettings base={catalog.layout} />
      </div>
    )

  const wallPending = !!design.wallAnchored && wallOf(design) === 'unknown'
  const pending = [
    ...(wallPending ? [{ id: 'wall', title: 'Anclajes al muro' }] : []),
    ...purchaseReviewItems(verdict).filter((item) => !verdict.choices?.some((choice) => choice.id === item.id)),
  ]
  const guide = verdict.verdict === 'viable' ? guideLabel : 'Ver guía con pendientes'

  return (
    <div className="relative flex flex-col gap-6 px-4 pt-6 md:px-8">
      {whose}
      {/* One grid on a desktop, so the next step is a single element: under the decisions there, and at the foot of the phone's column. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-0">
      {left(true)}
      <div className="flex min-w-0 flex-col gap-6 lg:border-t-[3px] lg:border-graphite lg:pt-6 lg:pb-6 lg:pl-8">
        <VerdictSummary verdict={verdict} />
        {construction}
        {reviewNotice && <p role="status" className="text-sm">{reviewNotice}</p>}
        {verdictError && <ErrorText>{verdictError}</ErrorText>}
        <VerdictCard
          key={`${verdict.signature}:${verdict.date}`}
          verdict={verdict}
          design={design}
          onRequest={onRequest}
          wall={wallPending && <WallQuestion design={design} anchoring={purchase.anchoring} />}
        />
      </div>
      <div className="flex flex-col gap-6 lg:col-span-2 lg:pt-6">
      <ReviewChecks verdict={verdict} />
      <section className="flex flex-col" aria-label="Lo que vas a comprar">
        {design.wallAnchored && !wallPending && (
          <Section minor title="Muro" aside={`${WALL_LABELS[wallOf(design)]} · Cambiar`}>
            <WallQuestion design={design} anchoring={purchase.anchoring} />
          </Section>
        )}
        <Section title={sheetsHeading(onlyPlywood)} aside={`${totalSheets} ${totalSheets === 1 ? 'hoja' : 'hojas'}`} open>
        <div className="flex flex-col gap-4">
        {purchase.sheets.map((h, row) => {
          const a = purchase.layout.find((x) => x.material === h.material.id)!
          return (
            <div key={h.material.id} className={`flex flex-col gap-5 ${row > 0 ? 'mt-2 border-t-[6px] border-graphite pt-6' : ''}`}>
              {/* One ruled row per material, like the head of the cut ticket. */}
              <div className="flex flex-wrap border-t-[3px] border-l-[3px] border-graphite font-mono text-base md:text-xl *:flex *:min-h-12 *:grow *:items-center *:border-r-[3px] *:border-b-[3px] *:border-graphite *:px-4 *:py-2">
                <span className="font-semibold">{h.material.name}</span>
                <span className="numerals">{h.sheets} {h.sheets === 1 ? 'hoja' : 'hojas'}</span>
                <span className="numerals font-semibold">{h.cost === null ? '—' : `${h.material.id in settings.prices ? '' : '~'}${weights.format(h.cost)}`}</span>
                <span><Price id={h.material.id} value={h.material.price} base={base(h.material.id)} unit="por hoja" /></span>
                <span className="numerals">{meters(h.material.sheet.width)} × {meters(h.material.sheet.length)}</span>
                <span className="numerals">desperdicio {percent(h.waste)}</span>
              </div>
              {a.unplaced.length > 0 && <p className="flex items-center gap-1.5 border-l-8 border-graphite pl-4 text-sm font-semibold"><Warning weight="bold" aria-hidden /> No caben en una hoja: {a.unplaced.map((p) => p.name).join(', ')}. Cuentan como hoja aparte.</p>}
              <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
                {a.sheets.map((_, i) => (
                  <SheetDiagram key={i} a={a} index={i} total={a.sheets.length} numbers={numbers} chosen={selection} onChoose={select} />
                ))}
              </div>
            </div>
          )
        })}
        <p className="max-w-2xl text-sm leading-relaxed text-graphite">
          {catalog.priceNote} Toca cualquier precio para poner el de tu tienda
          {own > 0 ? `; ya pusiste ${own === 1 ? 'uno' : own}.` : '.'} Las cantidades son para comprar, no un plano de corte.        </p>
        <CutSettings base={catalog.layout} />
        </div>
        </Section>

      <Section minor title="Herrajes y consumibles">
        <ul className="flex max-w-3xl flex-col divide-y divide-line border-y-2 border-graphite">
          {purchase.hardware.map((r) => (
            <li key={r.hardware.id} className="flex items-center gap-3 py-3">
              <span className="numerals min-w-12 shrink-0 text-sm font-medium">
                {r.count}
                {r.hardware.unit === 'meter' ? ' m' : ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{r.hardware.name}</span>
                {r.hardware.role === 'anti-tip' && anchor && (
                  <span role="note" className="mt-1 block text-[13px] leading-snug text-graphite">
                    El ancla no es opcional en este mueble. {anchor.message} {HOW_TO_ANCHOR}
                  </span>
                )}
                {r.packs !== null && (
                  <span className="block text-xs text-graphite-2">
                    {r.packs} {r.packs === 1 ? 'paquete' : 'paquetes'} de {r.hardware.perPack}
                  </span>
                )}
              </span>
              <span className="flex flex-col items-end">
                <span className="numerals text-sm">{r.cost === null ? '—' : `${r.hardware.id in settings.prices ? '' : '~'}${weights.format(r.cost)}`}</span>
                <Price id={r.hardware.id} value={r.hardware.price} base={base(r.hardware.id)} unit={r.hardware.perPack ? 'por paquete' : r.hardware.unit === 'meter' ? 'por metro' : 'c/u'} />
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <FinishSection design={design} geo={geo} finish={purchase.finish} base={base} />

      <Section title="Lista de corte" aside={`${design.pieces.length} piezas`}>
        <div className="min-w-0">
          <CutList blocks={blocks} />
        </div>
      </Section>
      <Section minor title="Qué revisar al recoger tus cortes">
        <BeforeLeaving hasDrawer={design.pieces.some(isDrawerPart)} />
      </Section>
      </section>
      <section className="flex flex-col gap-3 border-t-4 border-graphite pt-4" aria-label="Guía y lista para llevar">
        {verdict.verdict !== 'viable' && <p role="note" className="text-sm">La guía y la lista conservan los pendientes de este diseño. Resuélvelos antes de comprar o cortar.</p>}
        {pending.length > 0 && (
          <Button className="self-start border-2 border-graphite bg-transparent px-4 text-sm hover:bg-kraft" onClick={() => openTakeAway(true)}>
            <Printer weight="bold" /> {guide}
          </Button>
        )}
        <p className="text-xs leading-relaxed text-graphite-2">{phaseCount ? `Incluye ${phaseCount} pasos de armado, piezas numeradas y diagramas.` : 'Incluye cortes y diagramas de las piezas. Este diseño no tiene fases de armado.'} Imprime o guarda como PDF desde la guía.</p>
        <CopyList text={message} />
        <p className="text-xs text-graphite-2">Copia la lista para pegarla en WhatsApp o enviarla a la maderería.</p>
      </section>
      </div>
      <NextStep pending={pending} guide={guide} onGuide={() => openTakeAway(true)} />
      </div>
    </div>
  )
}

/**
 * The checkout's one filled action (UI-91): the next pending decision while any is left, then the guide.
 * On a phone it sticks to the foot of the column; on a desktop the grid places it under the decisions, in the right half.
 */
function NextStep({ pending, guide, onGuide }: { pending: { id: string; title: string }[]; guide: string; onGuide: () => void }) {
  const next = pending[0]
  const go = () => {
    if (!next) return onGuide()
    const target = document.getElementById(pendingId(next.id))
    if (!target) return
    const details = target.querySelector('details')
    if (details && !details.open) details.open = true
    target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    target.querySelector<HTMLElement>('summary, input')?.focus({ preventScroll: true })
  }
  return (
    <div className="sticky bottom-0 -mx-4 border-t-[6px] border-graphite bg-bone px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-8 md:px-8 lg:static lg:col-start-2 lg:row-start-2 lg:mx-0 lg:border-t-0 lg:border-b-[3px] lg:pt-0 lg:pr-0 lg:pb-6 lg:pl-8">
      <Button variant="action" className="min-h-12 w-full px-5 lg:min-h-16 lg:text-2xl" onClick={go}>
        {next ? <><span className="min-w-0 truncate">Siguiente: {next.title}</span> <ArrowDown weight="bold" className="shrink-0" /></> : <><Printer weight="bold" /> {guide}</>}
      </Button>
    </div>
  )
}
