import { ArrowCounterClockwise, Check, Info, PencilSimple, Sliders } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { Design } from '../../domain/diseno/schema'
import type { Geometry } from '../../domain/diseno/resolve'
import type { MaterialLayout } from '../../domain/materiales/layout'
import { applySettings, type LayoutSettings, type Catalog } from '../../domain/materiales/catalog'
import { reviewSignature } from '../../application/useCases'
import { estimatePurchase } from '../../domain/materiales/purchase'
import type { DesignState } from '../../domain/sesion/state'
import { Title } from '../sistema/components'
import { useStore } from '../store'
import { ReviewGate, VerdictCard } from './Verdict'
import { PieceList } from './Panels'

const weights = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const percent = (f: number) => `${Math.round(f * 100)} %`
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
        <input
          autoFocus
          onFocus={(e) => e.target.select()}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Precio en pesos"
          className="cifras w-20 rounded-lg border border-ambar bg-hueso px-2 py-1 text-right text-xs outline-none"
        />
        <button type="submit" aria-label="Guardar precio" className="grid size-7 place-items-center rounded-full bg-grafito text-hueso">
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
        className={`cifras inline-flex items-center gap-1 rounded-md px-1 text-xs transition hover:bg-kraft ${changed ? 'text-grafito' : 'text-grafito-2'}`}
        title="Cambiar por el precio de tu tienda"
      >
        {value === null ? 'sin precio' : `${changed ? '' : '~'}${weights.format(value)} ${unit}`}
        <span className={`rounded px-1 text-[10px] ${changed ? 'bg-grafito text-hueso' : 'bg-kraft'}`}>{changed ? 'tu precio' : 'ref.'}</span>
        <PencilSimple size={11} />
      </button>
      {changed && value !== base && (
        <button type="button" onClick={reset} aria-label="Volver al precio del catálogo" title="Volver al precio del catálogo" className="text-grafito-2 hover:text-grafito">
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
      <figcaption className="flex items-baseline justify-between text-xs text-grafito-2">
        <span>
          Hoja {index + 1} de {total}
        </span>
        <span className="cifras">desperdicio {percent(sheet.waste)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${a.sheet.length} ${a.sheet.width}`} className="w-full rounded-md border border-linea" role="img" aria-label={`Acomodo de la hoja ${index + 1}`}>
        <defs>
          <pattern id={pattern} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="40" stroke="var(--grafito-2)" strokeOpacity="0.25" strokeWidth="6" />
          </pattern>
        </defs>
        <rect width={a.sheet.length} height={a.sheet.width} fill={`url(#${pattern})`} />
        <rect x={trim} y={trim} width={a.usable.length} height={a.usable.width} fill="var(--hueso)" />
        {sheet.placed.map((c) => {
          const active = selection === c.id
          const large = c.w > 360 && c.h > 110
          return (
            <g key={c.id} onClick={() => select(c.id)} className="cursor-pointer">
              <rect x={trim + c.x} y={trim + c.y} width={c.w} height={c.h} fill={active ? '#d98a2b' : '#e2c9a2'} stroke="#2b2825" strokeOpacity="0.6" strokeWidth="5" />
              {large && (
                <text x={trim + c.x + c.w / 2} y={trim + c.y + c.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(64, c.h * 0.32)} fill="#2b2825" style={{ fontFamily: 'var(--font-sans)' }}>
                  {c.name}
                  <tspan x={trim + c.x + c.w / 2} dy="1.2em" fontSize={Math.min(52, c.h * 0.26)} fillOpacity="0.7" style={{ fontFamily: 'var(--font-mono)' }}>
                    {Math.round(c.rotated ? c.h : c.w)} × {Math.round(c.rotated ? c.w : c.h)}
                  </tspan>
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
  const fields: { key: keyof LayoutSettings; name: string; help: string }[] = [
    { key: 'trim', name: 'Refilado', help: 'Canto de fábrica que se recorta por lado' },
    { key: 'kerf', name: 'Corte', help: 'Lo que se come la sierra' },
    { key: 'clearance', name: 'Holgura', help: 'Margen por pieza' },
  ]
  return (
    <details className="rounded-2xl border border-linea bg-hueso p-4 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <Sliders /> Ajustes de corte
      </summary>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {fields.map((c) => (
          <label key={c.key} className="flex flex-col gap-1" title={c.help}>
            <span className="text-xs text-grafito-2">{c.name}</span>
            <span className="flex items-baseline gap-1 rounded-xl border border-linea px-2 focus-within:border-ambar">
              <input
                type="number"
                min={0}
                step={1}
                value={current[c.key]}
                onChange={(e) => save({ ...settings, layout: { ...current, [c.key]: Math.max(0, Number(e.target.value)) } })}
                className="cifras min-h-9 w-full bg-transparent outline-none"
              />
              <span className="cifras text-xs text-grafito-2">mm</span>
            </span>
          </label>
        ))}
      </div>
      {settings.layout && (
        <button type="button" className="mt-2 text-xs text-grafito-2 underline" onClick={() => save({ ...settings, layout: null })}>
          Volver a los valores del catálogo
        </button>
      )}
    </details>
  )
}

export function Materials({ state, design, geo, catalog, onRequest }: { state: DesignState; design: Design; geo: Geometry; catalog: Catalog; onRequest: (text: string) => void }) {
  const settings = useStore((s) => s.catalogSettings)
  const effective = useMemo(() => applySettings(catalog, settings), [catalog, settings])
  const purchase = useMemo(() => estimatePurchase(design, geo, effective), [design, geo, effective])
  const [anyway, setAnyway] = useState<string | null>(null)
  const base = (id: string) => [...catalog.materials, ...catalog.hardware].find((x) => x.id === id)?.price ?? null
  const totalSheets = purchase.sheets.reduce((s, h) => s + h.sheets, 0)
  const own = Object.keys(settings.prices).length
  const verdict = state.review?.signature === reviewSignature(state, effective) ? state.review : null

  // The shopping list appears only after the review; if it is not viable, it has to be asked for on purpose.
  if (!verdict)
    return (
      <div className="flex flex-col gap-4 p-4">
        <ReviewGate stale={state.review !== null} />
        <CutSettings base={catalog.layout} />
      </div>
    )
  if (verdict.verdict === 'not-viable' && anyway !== verdict.signature)
    return (
      <div className="flex flex-col gap-4 p-4">
        <VerdictCard verdict={verdict} design={design} onRequest={onRequest} />
        <p className="text-sm text-grafito-2">
          Con estos problemas, lo que compres probablemente no sirva.{' '}
          <button type="button" className="underline" onClick={() => setAnyway(verdict.signature)}>
            Ver la lista de todos modos
          </button>
        </p>
        <CutSettings base={catalog.layout} />
      </div>
    )

  return (
    <div className="flex flex-col gap-4 p-4">
      <VerdictCard verdict={verdict} design={design} onRequest={onRequest} />
      <section className="flex flex-col gap-2 rounded-2xl border border-linea bg-hueso p-4">
        <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Costo aproximado</p>
        <p className="font-titulo text-4xl font-semibold tracking-tight [font-variation-settings:'opsz'_96]">
          <span className="text-grafito-2">~</span>
          {weights.format(purchase.cost.total)}
        </p>
        <p className="text-sm text-grafito-2">
          {totalSheets} {totalSheets === 1 ? 'hoja' : 'hojas'} de triplay, herrajes y cubrecanto.
        </p>
        <div className="flex items-start gap-2 rounded-xl border border-ambar/40 bg-ambar-suave px-3 py-2 text-xs leading-relaxed">
          <Info className="mt-0.5 shrink-0" weight="bold" />
          <span>
            <span className="font-medium">Precios de referencia, no una cotización.</span> {catalog.priceNote} Toca cualquier precio para poner el de tu tienda
            {own > 0 ? `; ya pusiste ${own === 1 ? 'uno' : own}.` : '.'} Las cantidades son para comprar, no un plano de corte.
            {purchase.cost.missingPrices.length > 0 && ` Sin precio: ${purchase.cost.missingPrices.join(', ')}.`}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Title className="text-lg">Hojas de triplay</Title>
        {purchase.sheets.map((h) => {
          const a = purchase.layout.find((x) => x.material === h.material.id)!
          return (
            <div key={h.material.id} className="flex flex-col gap-3 rounded-2xl border border-linea bg-hueso p-4">
              <div className="flex items-start gap-3">
                <span className="cifras grid size-10 shrink-0 place-items-center rounded-xl bg-grafito text-lg font-medium text-hueso">{h.sheets}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{h.material.name}</p>
                  <p className="cifras text-xs text-grafito-2">
                    {meters(h.material.sheet.width)} × {meters(h.material.sheet.length)} · desperdicio {percent(h.waste)}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="cifras text-sm font-medium">{h.cost === null ? '—' : `${h.material.id in settings.prices ? '' : '~'}${weights.format(h.cost)}`}</span>
                  <Price id={h.material.id} value={h.material.price} base={base(h.material.id)} unit="por hoja" />
                </div>
              </div>
              {a.unplaced.length > 0 && <p className="text-xs text-oxido">No caben en una hoja: {a.unplaced.map((p) => p.name).join(', ')}. Cuentan como hoja aparte.</p>}
              {a.sheets.map((_, i) => (
                <SheetDiagram key={i} a={a} index={i} total={a.sheets.length} />
              ))}
            </div>
          )
        })}
        <CutSettings base={catalog.layout} />
      </section>

      <section className="flex flex-col gap-3">
        <Title className="text-lg">Herrajes y consumibles</Title>
        <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-hueso">
          {purchase.hardware.map((r) => (
            <li key={r.hardware.id} className="flex items-center gap-3 px-4 py-3">
              <span className="cifras min-w-12 shrink-0 text-sm font-medium">
                {r.count}
                {r.hardware.unit === 'meter' ? ' m' : ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{r.hardware.name}</span>
                {r.packs !== null && (
                  <span className="block text-xs text-grafito-2">
                    {r.packs} {r.packs === 1 ? 'paquete' : 'paquetes'} de {r.hardware.perPack}
                  </span>
                )}
              </span>
              <span className="flex flex-col items-end">
                <span className="cifras text-sm">{r.cost === null ? '—' : `${r.hardware.id in settings.prices ? '' : '~'}${weights.format(r.cost)}`}</span>
                <Price id={r.hardware.id} value={r.hardware.price} base={base(r.hardware.id)} unit={r.hardware.perPack ? 'por paquete' : r.hardware.unit === 'meter' ? 'por metro' : 'c/u'} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="-mx-4 flex flex-col">
        <Title className="px-4 text-lg">Lista de corte</Title>
        <PieceList design={design} geo={geo} />
      </section>
    </div>
  )
}
