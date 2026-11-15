import { manufacturingProblems } from '../../domain/design/manufacturing'
import { RepairConstruction } from '../takeaway/RepairConstruction'
import { ArrowCounterClockwise, ArrowDown, Check, PencilSimple, Printer, Sliders, Warning } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { isDrawerPart, wallOf, WALLS, type Design } from '../../domain/design/schema'
import type { Geometry } from '../../domain/design/resolve'
import type { MaterialLayout } from '../../domain/estimate/layout'
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
import { Field, Input } from '../system/Field'
import { HelpButton, HelpPanel, useHelp } from '../system/Help'
import { TERMS } from '../glossary'
import { useStore } from '../store'
import { pendingId, ReviewGate, VerdictCard, VerdictSummary } from './Verdict'
import { purchaseReviewItems } from '../../domain/session/purchaseReview'
import { BeforeLeaving, CopyList } from './CopyList'
import { lineNumbers } from './copyListLabels'
import { CutList } from './CutList'
import { Section } from './Section'
import { sheetLabels } from './sheetLabels'
import { finishCounted, leftOut, sheetsHeading, totalCovers } from './totalSummary'
import { reviewNotes } from '../takeaway/reviewNotes'
import { assemblyPhases } from '../takeaway/assemblyPhases'

const weights = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const percent = (f: number) => `${Math.round(f * 100)} %`
const decimal = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 2 })
const meters = (mm: number) => `${(mm / 1000).toLocaleString('es-MX', { maximumFractionDigits: 2 })} m`

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

/** A dimension line in ink with an arrowhead at each end and its figure in the middle, as on a drawing. */
function Cota({ label, vertical = false }: { label: string; vertical?: boolean }) {
  const line = vertical ? 'w-0.5 flex-1 bg-graphite' : 'h-0.5 flex-1 bg-graphite'
  const start = vertical ? 'border-x-[5px] border-b-[8px] border-x-transparent border-b-graphite' : 'border-y-[5px] border-r-[8px] border-y-transparent border-r-graphite'
  const end = vertical ? 'border-x-[5px] border-t-[8px] border-x-transparent border-t-graphite' : 'border-y-[5px] border-l-[8px] border-y-transparent border-l-graphite'
  return (
    <div aria-hidden className={`flex items-center ${vertical ? 'h-full flex-col' : 'w-full'}`}>
      <span className={start} />
      <span className={line} />
      <span className={`numerals shrink-0 font-semibold text-graphite ${vertical ? 'py-1 text-sm md:text-base' : 'px-2 text-base md:text-lg'}`}>{label}</span>
      <span className={line} />
      <span className={end} />
    </div>
  )
}

/** A sheet's layout as in a drawing (UI-93): its two dimensions, pieces in wood, everything else hatched in ink, and the chosen piece hatched black. */
function SheetDiagram({ a, index, total, numbers }: { a: MaterialLayout; index: number; total: number; numbers: Map<string, number> }) {
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const sheet = a.sheets[index]
  const trim = (a.sheet.length - a.usable.length) / 2
  const pattern = `rayado-${a.material}-${index}`
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-col gap-0.5">
        <span className="font-display text-2xl leading-tight font-semibold md:text-3xl">
          Hoja {index + 1} de {total} · desperdicio {percent(sheet.waste)}
        </span>
        {sheet.leftover && (
          <span className="numerals text-base text-graphite">
            Sobra al menos {sheet.leftover.length} × {sheet.leftover.width} mm
          </span>
        )}
      </figcaption>
      <div className="grid grid-cols-[auto_1fr] grid-rows-[auto_1fr] gap-x-2 gap-y-1">
        <span />
        <Cota label={meters(a.sheet.length)} />
        <Cota label={meters(a.sheet.width)} vertical />
      <svg viewBox={`0 0 ${a.sheet.length} ${a.sheet.width}`} className="drawing-sheet w-full border-2 border-graphite" role="group" aria-label={`Acomodo de la hoja ${index + 1}`}>
        <defs>
          <pattern id={pattern} width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="48" height="48" fill="var(--color-drawing-paper)" />
            <line x1="0" y1="0" x2="0" y2="48" stroke="var(--color-brand-ink)" strokeWidth="9" />
          </pattern>
          {/* The chosen piece is hatched in ink, as the edited part is marked (UI-93). */}
          <pattern id={`${pattern}-chosen`} width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="36" height="36" fill="#e2c9a2" />
            <line x1="0" y1="0" x2="0" y2="36" stroke="var(--color-brand-ink)" strokeWidth="12" />
          </pattern>
        </defs>
        <rect width={a.sheet.length} height={a.sheet.width} fill={`url(#${pattern})`} />
        {sheet.placed.map((c) => {
          const active = selection === c.id
          const size = `${Math.round(c.rotated ? c.h : c.w)} × ${Math.round(c.rotated ? c.w : c.h)}`
          const number = numbers.get(c.id)
          const named = number ? `${number}. ${c.name}` : c.name
          const full = sheetLabels(c.w, c.h, named, size)
          // A number alone stays no larger than a name would be beside its size, so it does not outshout the named pieces.
          const alone = number && !full.name ? sheetLabels(c.w, c.h, `${number}.`, size).name : null
          const short = alone && Math.min(alone, full.size ? full.size * 1.1 : 60)
          const labels = { name: full.name ?? short, size: full.size }
          const cx = trim + c.x + c.w / 2
          return (
            <g
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`Ver ${named} en 3D · ${size} mm`}
              aria-pressed={active}
              onClick={() => select(c.id)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                select(c.id)
              }}
              className="cursor-pointer focus-visible:outline-2 focus-visible:outline-focus"
            >
              <title>{`${named} · ${size}`}</title>
              <rect x={trim + c.x} y={trim + c.y} width={c.w} height={c.h} fill={active ? `url(#${pattern}-chosen)` : '#e2c9a2'} stroke="var(--color-brand-ink)" strokeWidth={active ? 14 : 6} />
              {(labels.name || labels.size) && (
                // Over the hatching the label prints on a wood halo, so it stays readable.
                <text x={cx} y={trim + c.y + c.h / 2} textAnchor="middle" dominantBaseline="middle" fill="var(--color-brand-ink)" stroke={active ? '#e2c9a2' : 'none'} strokeWidth={active ? 18 : 0} style={{ paintOrder: 'stroke' }}>
                  {labels.name && (
                    <tspan fontSize={labels.name} fontWeight={600} style={{ fontFamily: 'var(--font-display)' }}>
                      {full.name ? named : `${number}.`}
                    </tspan>
                  )}
                  {labels.size && (
                    <tspan x={cx} dy={labels.name ? '1.2em' : undefined} fontSize={labels.size} style={{ fontFamily: 'var(--font-mono)' }}>
                      {size}
                    </tspan>
                  )}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      </div>
    </figure>
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
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Warning weight="bold" aria-hidden /> Dato pendiente: anclajes al muro
        </p>
      )}
      <p className="font-display text-lg font-semibold uppercase">¿De qué es el muro donde va?</p>
      <RadioGroup label="Tipo de muro" className="flex flex-wrap gap-1.5">
        {WALLS.map((wall) => (
          <RadioCard key={wall} variant="pill" checked={wallOf(design) === wall} onChange={() => choose(wall)} className="px-3 py-1.5 text-xs">
            {WALL_LABELS[wall]}
          </RadioCard>
        ))}
      </RadioGroup>
      <p role="note" className="text-[15px] leading-snug text-graphite">
        {anchoringAdvice(anchoring)}
      </p>
      {wallOf(design) === 'unknown' && <p className="text-sm text-graphite-2">Si no lo sabes, puedes consultar la guía. La lista aún no incluye los taquetes para ese muro; confirma cuáles corresponden antes de comprarlos.</p>}
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
      <Section title="Acabado" aside={`${chosen.name} · Cambiar y ver insumos`}>
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
                        {l.litres === null && <span className="block text-xs text-rust">La referencia no da su rendimiento en m² por litro: pregunta en la tienda cuánto llevar.</span>}
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

export function Materials({ state, design, geo, catalog, instead, onRequest }: { state: DesignState; design: Design; geo: Geometry; catalog: Catalog; instead: string | null; onRequest: (text: string) => void }) {
  const settings = useStore((s) => s.catalogSettings)
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

  const cost = (
    <section className="flex flex-col gap-1.5">
      <p className="font-display text-lg leading-none font-semibold uppercase">Costo aproximado</p>
      <p className="numerals text-5xl leading-none font-semibold">
        <span className="text-graphite-2">~</span>
        {weights.format(purchase.cost.total)}
      </p>
      {verdict && <p className="text-[15px] text-graphite">{totalCovers({ sheets: totalSheets, onlyPlywood, withBanding: purchase.edgeBanding > 0, withFinish })}</p>}
      {unpriced && <p className="max-w-2xl text-[15px] text-graphite">{unpriced}</p>}
      <p className="text-sm leading-relaxed text-graphite-2">Precios de referencia en MXN, no una cotización.</p>
    </section>
  )

  // The total shows before the review (UI-16); the shopping list only after it, and if it is not viable it has to be asked for on purpose.
  if (!verdict || reviewing)
    return (
      <div className="relative flex flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        {whose}
        {cost}
        {construction}
        <ReviewGate stale={state.review !== null} />
        <CutSettings base={catalog.layout} />
      </div>
    )
  if (verdict.verdict === 'not-viable' && anyway !== verdict.signature)
    return (
      <div className="relative flex flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        {whose}
        {cost}
        {construction}
        <VerdictSummary verdict={verdict} />
        <VerdictCard key={`${verdict.signature}:${verdict.date}`} verdict={verdict} design={design} onRequest={onRequest} />
        <p className="text-sm text-graphite">
          Con estos problemas, lo que compres probablemente no sirva.{' '}
          <button type="button" className="underline" onClick={() => setAnyway(verdict.signature)}>
            Ver la lista de todos modos
          </button>
        </p>
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
      {cost}
      {construction}
      {reviewNotice && <p role="status" className="text-sm">{reviewNotice}</p>}
      {verdictError && <p role="alert" className="text-sm text-rust">{verdictError}</p>}
      <VerdictSummary verdict={verdict} />
      <VerdictCard
        key={`${verdict.signature}:${verdict.date}`}
        verdict={verdict}
        design={design}
        onRequest={onRequest}
        wall={wallPending && <WallQuestion design={design} anchoring={purchase.anchoring} />}
      />
      <section className="flex flex-col" aria-label="Lo que vas a comprar">
        {design.wallAnchored && !wallPending && (
          <Section title="Muro" aside={`${WALL_LABELS[wallOf(design)]} · Cambiar`}>
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
                  <SheetDiagram key={i} a={a} index={i} total={a.sheets.length} numbers={numbers} />
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

      <Section title="Herrajes y consumibles">
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
      <Section title="Qué revisar al recoger tus cortes">
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
      <NextStep pending={pending} guide={guide} onGuide={() => openTakeAway(true)} />
    </div>
  )
}

/** The checkout's one filled action (UI-91): the next pending decision while any is left, then the guide. */
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
    <div className="sticky bottom-0 -mx-4 border-t-[6px] border-graphite bg-bone px-4 md:-mx-8 md:px-8 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <Button variant="action" className="min-h-12 w-full px-5" onClick={go}>
        {next ? <><span className="min-w-0 truncate">Siguiente: {next.title}</span> <ArrowDown weight="bold" className="shrink-0" /></> : <><Printer weight="bold" /> {guide}</>}
      </Button>
    </div>
  )
}
