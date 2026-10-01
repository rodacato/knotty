import { ArrowCounterClockwise, Check, PencilSimple, Sliders } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { Design } from '../../domain/design/schema'
import type { Geometry } from '../../domain/design/resolve'
import type { MaterialLayout } from '../../domain/materials/layout'
import { applySettings, type LayoutSettings, type Catalog } from '../../domain/materials/catalog'
import { reviewSignature } from '../../application/useCases'
import { estimatePurchase } from '../../domain/materials/purchase'
import { COVERAGE_EFFICIENCY, type FinishPurchase } from '../../domain/materials/finishPurchase'
import { FINISH_IDS, FINISH_PRODUCTS, FINISHES, finishOf, type FinishLayer } from '../../domain/materials/finishes'
import type { DesignState } from '../../domain/session/state'
import { EDGE_LABEL, profiledEdges } from '../../domain/design/edges'
import { EDGE_PROFILES } from '../../domain/materials/edgeProfiles'
import { hasRouter } from '../../domain/materials/tools'
import { Title } from '../system/components'
import { RadioCard, RadioGroup } from '../system/RadioCard'
import { Field, Input } from '../system/Field'
import { HelpButton, HelpPanel, useHelp } from '../system/Help'
import { TERMS } from '../glossary'
import { useStore } from '../store'
import { ReviewGate, VerdictCard } from './Verdict'
import { PieceList } from './Panels'
import { sheetLabels } from './sheetLabels'

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
        <button type="submit" aria-label="Guardar precio" className="grid size-7 place-items-center rounded-full bg-graphite text-bone">
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
        className={`numerals inline-flex items-center gap-1 rounded-md px-1 text-xs transition hover:bg-kraft ${changed ? 'text-graphite' : 'text-graphite-2'}`}
        title="Cambiar por el precio de tu tienda"
      >
        {value === null ? 'sin precio' : `${changed ? '' : '~'}${weights.format(value)} ${unit}`}
        <span className={`rounded px-1 text-xs ${changed ? 'bg-graphite text-bone' : 'bg-kraft'}`}>{changed ? 'tu precio' : 'ref.'}</span>
        <PencilSimple size={11} />
      </button>
      {changed && value !== base && (
        <button type="button" onClick={reset} aria-label="Volver al precio del catálogo" title="Volver al precio del catálogo" className="text-graphite-2 hover:text-graphite">
          <ArrowCounterClockwise size={11} />
        </button>
      )}
    </span>
  )
}

/** A sheet's layout as in a drawing: hatched trim, pieces in wood, offcut in white. */
function SheetDiagram({ a, index, total }: { a: MaterialLayout; index: number; total: number }) {
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const sheet = a.sheets[index]
  const trim = (a.sheet.length - a.usable.length) / 2
  const pattern = `rayado-${a.material}-${index}`
  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="flex items-baseline justify-between text-xs text-graphite-2">
        <span>
          Hoja {index + 1} de {total}
        </span>
        <span className="numerals">desperdicio {percent(sheet.waste)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${a.sheet.length} ${a.sheet.width}`} className="w-full rounded-md border border-line" role="img" aria-label={`Acomodo de la hoja ${index + 1}`}>
        <defs>
          <pattern id={pattern} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="40" stroke="var(--graphite-2)" strokeOpacity="0.25" strokeWidth="6" />
          </pattern>
        </defs>
        <rect width={a.sheet.length} height={a.sheet.width} fill={`url(#${pattern})`} />
        <rect x={trim} y={trim} width={a.usable.length} height={a.usable.width} fill="var(--bone)" />
        {sheet.placed.map((c) => {
          const active = selection === c.id
          const size = `${Math.round(c.rotated ? c.h : c.w)} × ${Math.round(c.rotated ? c.w : c.h)}`
          const labels = sheetLabels(c.w, c.h, c.name, size)
          const cx = trim + c.x + c.w / 2
          return (
            <g key={c.id} onClick={() => select(c.id)} className="cursor-pointer">
              <title>{`${c.name} · ${size}`}</title>
              <rect x={trim + c.x} y={trim + c.y} width={c.w} height={c.h} fill={active ? '#d98a2b' : '#e2c9a2'} stroke="#2b2825" strokeOpacity="0.6" strokeWidth="5" />
              {(labels.name || labels.size) && (
                <text x={cx} y={trim + c.y + c.h / 2} textAnchor="middle" dominantBaseline="middle" fill="#2b2825">
                  {labels.name && (
                    <tspan fontSize={labels.name} style={{ fontFamily: 'var(--font-sans)' }}>
                      {c.name}
                    </tspan>
                  )}
                  {labels.size && (
                    <tspan x={cx} dy={labels.name ? '1.2em' : undefined} fontSize={labels.size} fillOpacity="0.7" style={{ fontFamily: 'var(--font-mono)' }}>
                      {size}
                    </tspan>
                  )}
                </text>
              )}
            </g>
          )
        })}
      </svg>
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
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg font-medium">
        <Sliders /> Ajustes de corte
      </summary>
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

/** The finish the person picks and what it takes: litres, containers and sandpaper. */
function FinishSection({ design, geo, finish, base }: { design: Design; geo: Geometry; finish: FinishPurchase | null; base: (id: string) => number | null }) {
  const choose = useStore((s) => s.chooseFinish)
  const settings = useStore((s) => s.catalogSettings)
  const chosen = FINISHES[finishOf(design)]
  return (
    <section className="flex flex-col gap-3">
      <Title className="text-lg">Acabado</Title>
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
            <span className="numerals font-medium text-graphite">{decimal(finish.area)} m²</span> por acabar: las dos caras de cada pieza (la de la trasera que va al muro no) y los cantos con cubrecanto. Litros = área × manos ÷ (rendimiento de la ficha × {COVERAGE_EFFICIENCY}).
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
    </section>
  )
}

export function Materials({ state, design, geo, catalog, onRequest }: { state: DesignState; design: Design; geo: Geometry; catalog: Catalog; onRequest: (text: string) => void }) {
  const settings = useStore((s) => s.catalogSettings)
  const effective = useMemo(() => applySettings(catalog, settings), [catalog, settings])
  const purchase = useMemo(() => estimatePurchase(design, geo, effective), [design, geo, effective])
  const [anyway, setAnyway] = useState<string | null>(null)
  const base = (id: string) => [...catalog.materials, ...catalog.hardware, ...catalog.finishes].find((x) => x.id === id)?.price ?? null
  const totalSheets = purchase.sheets.reduce((s, h) => s + h.sheets, 0)
  const own = Object.keys(settings.prices).length
  const verdict = state.review?.signature === reviewSignature(state, effective) ? state.review : null

  const cost = (
    <section className="flex flex-col gap-1 border-b border-line pb-4">
      <p className="text-sm text-graphite-2">Costo aproximado</p>
      <p className="font-display text-4xl font-semibold tracking-tight [font-variation-settings:'opsz'_96]">
        <span className="text-graphite-2">~</span>
        {weights.format(purchase.cost.total)}
      </p>
      {verdict && (
        <p className="text-sm text-graphite-2">
          {totalSheets} {totalSheets === 1 ? 'hoja' : 'hojas'} de triplay, herrajes{purchase.finish ? ', cubrecanto y acabado' : ' y cubrecanto'}.
        </p>
      )}
      <p className="text-sm text-graphite">Precios de referencia, no una cotización.</p>
    </section>
  )

  // The total shows before the review (UI-16); the shopping list only after it, and if it is not viable it has to be asked for on purpose.
  if (!verdict)
    return (
      <div className="flex flex-col gap-4 p-4">
        {cost}
        <ReviewGate stale={state.review !== null} />
        <CutSettings base={catalog.layout} />
      </div>
    )
  if (verdict.verdict === 'not-viable' && anyway !== verdict.signature)
    return (
      <div className="flex flex-col gap-4 p-4">
        {cost}
        <VerdictCard verdict={verdict} design={design} onRequest={onRequest} />
        <p className="text-sm text-graphite">
          Con estos problemas, lo que compres probablemente no sirva.{' '}
          <button type="button" className="underline" onClick={() => setAnyway(verdict.signature)}>
            Ver la lista de todos modos
          </button>
        </p>
        <CutSettings base={catalog.layout} />
      </div>
    )

  return (
    <div className="flex flex-col gap-6 p-4">
      {cost}
      <VerdictCard verdict={verdict} design={design} onRequest={onRequest} />

      <section className="flex flex-col gap-3">
        <Title className="text-lg">Hojas de triplay</Title>
        <div className="flex flex-col divide-y divide-line border-b border-line">
        {purchase.sheets.map((h) => {
          const a = purchase.layout.find((x) => x.material === h.material.id)!
          return (
            <div key={h.material.id} className="@container flex flex-col gap-3 py-3">
              <div className="flex flex-wrap items-start gap-3 @sm:flex-nowrap">
                <span className="numerals grid size-10 shrink-0 place-items-center rounded-xl bg-graphite text-lg font-medium text-bone">{h.sheets}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{h.material.name}</p>
                  <p className="numerals text-xs text-graphite-2">
                    {meters(h.material.sheet.width)} × {meters(h.material.sheet.length)} · desperdicio {percent(h.waste)}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-13 @sm:w-auto @sm:flex-col @sm:items-end @sm:gap-0 @sm:pl-0">
                  <span className="numerals text-sm font-medium">{h.cost === null ? '—' : `${h.material.id in settings.prices ? '' : '~'}${weights.format(h.cost)}`}</span>
                  <Price id={h.material.id} value={h.material.price} base={base(h.material.id)} unit="por hoja" />
                </div>
              </div>
              {a.unplaced.length > 0 && <p className="text-xs text-rust">No caben en una hoja: {a.unplaced.map((p) => p.name).join(', ')}. Cuentan como hoja aparte.</p>}
              {a.sheets.map((_, i) => (
                <SheetDiagram key={i} a={a} index={i} total={a.sheets.length} />
              ))}
            </div>
          )
        })}
        </div>
        <p className="text-xs leading-relaxed text-graphite">
          {catalog.priceNote} Toca cualquier precio para poner el de tu tienda
          {own > 0 ? `; ya pusiste ${own === 1 ? 'uno' : own}.` : '.'} Las cantidades son para comprar, no un plano de corte.
          {purchase.cost.missingPrices.length > 0 && ` Sin precio: ${purchase.cost.missingPrices.join(', ')}.`}
        </p>
        <CutSettings base={catalog.layout} />
      </section>

      <section className="flex flex-col gap-3">
        <Title className="text-lg">Herrajes y consumibles</Title>
        <ul className="flex flex-col divide-y divide-line border-b border-line">
          {purchase.hardware.map((r) => (
            <li key={r.hardware.id} className="flex items-center gap-3 py-3">
              <span className="numerals min-w-12 shrink-0 text-sm font-medium">
                {r.count}
                {r.hardware.unit === 'meter' ? ' m' : ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{r.hardware.name}</span>
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
      </section>

      <FinishSection design={design} geo={geo} finish={purchase.finish} base={base} />

      <section className="-mx-4 flex flex-col">
        <Title className="px-4 text-lg">Lista de corte</Title>
        <PieceList design={design} geo={geo} />
      </section>
    </div>
  )
}
