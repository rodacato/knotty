import { named } from '../../application/named'
import { ArrowLeft, ArrowRight, GearSix, Minus, Plus } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { resolveGeometry } from '../../domain/design/resolve'
import { exampleDesign, type Base } from '../../domain/furniture/examples'
import { moduleOf, type FurniturePlan } from '../../domain/furniture/modules/plan'
import type { CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { countLimits, quickCounts, setCount } from '../../domain/furniture/modules/cabinetCounts'
import type { QuickCountKind } from '../../domain/furniture/modules/module'
import { dimensionsOf, fitToSpace, summarizePlan } from '../../domain/furniture/quick'
import type { FinishId } from '../../domain/materials/finishes'
import { Scene } from '../scene/Scene'
import { SceneBoundary } from '../scene/SceneBoundary'
import { AppHeader } from '../shell/AppHeader'
import { useServices } from '../services'
import { useStore } from '../store'
import { FinishSelect } from '../studio/FinishSelect'
import { Button } from '../system/components'
import { axisNote, blocking, chosenExample, COUNT_LABELS, isUnreadable, SPACE_AXES, spaceOf, summaryLines, type SpaceAxis } from './adjust'

const NO_GHOSTS: string[] = []
const TYPING_PAUSE = 350

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

const heading = 'font-display text-xl font-semibold md:text-2xl'

function Counter({ kind, value, min, max, onChange }: { kind: QuickCountKind; value: number; min: number; max: number; onChange: (next: number) => void }) {
  const { label, noun } = COUNT_LABELS[kind]
  const round = 'grid size-11 place-items-center rounded-full border border-line bg-bone transition hover:bg-kraft active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35'
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-base">{label}</span>
      <span className="flex items-center gap-4">
        <button type="button" aria-label={`Menos ${noun}`} disabled={value <= min} onClick={() => onChange(value - 1)} className={round}>
          <Minus className="size-4" />
        </button>
        <span className="numerals w-5 text-center text-base" aria-live="polite">
          {value}
        </span>
        <button type="button" aria-label={`Más ${noun}`} disabled={value >= max} onClick={() => onChange(value + 1)} className={round}>
          <Plus className="size-4" />
        </button>
      </span>
    </div>
  )
}

export function AdjustBase({ base }: { base: Base }) {
  const { catalog } = useServices()
  const closeAdjust = useStore((s) => s.closeAdjust)
  const openSettings = useStore((s) => s.openSettings)
  const fromExample = useStore((s) => s.fromExample)
  const quick = moduleOf(base.plan).quick
  const baseMeasures = useMemo(() => dimensionsOf(base.plan, catalog), [base, catalog])

  const [typed, setTyped] = useState<Record<SpaceAxis, string>>({ width: '', depth: '', height: '' })
  const [counted, setCounted] = useState<FurniturePlan>(base.plan)
  const [finish, setFinish] = useState<FinishId>(base.finish ?? 'none')
  const [countMessage, setCountMessage] = useState<string | null>(null)
  const space = useDebounced(useMemo(() => spaceOf(typed), [typed]), TYPING_PAUSE)

  const fit = useMemo(() => fitToSpace(counted, space, catalog), [counted, space, catalog])
  const summary = useMemo(() => summarizePlan(fit.plan, catalog, finish), [fit.plan, catalog, finish])
  const lines = summaryLines(summary)
  const stopper = blocking(fit)
  const shown = useMemo(() => {
    const { design } = exampleDesign({ ...base, plan: fit.plan, finish }, catalog)
    const geo = resolveGeometry(design, catalog)
    return { design, geo: geo.ok ? geo.value : null, error: geo.ok ? null : named(design, geo.errors[0]?.message) }
  }, [base, fit.plan, finish, catalog])

  const cabinet = fit.plan.kind === 'cabinet' ? (fit.plan as CabinetPlan) : null
  const counters = quick && cabinet ? quick.counts : []
  const limits = useMemo(() => (cabinet && counters.length ? countLimits(cabinet, catalog) : null), [cabinet, counters.length, catalog])
  const counts = cabinet ? quickCounts(cabinet) : null
  const asksSpace = quick?.measures === true

  const change = (kind: QuickCountKind, target: number) => {
    if (!cabinet) return
    const result = setCount(cabinet, kind, target, catalog)
    setCountMessage(result.ok ? null : result.message)
    setCounted(moduleOf(result.plan).withMeasures(result.plan, baseMeasures))
  }

  const notes = SPACE_AXES.flatMap(([axis, label]) => {
    const note = axisNote(fit.axes[axis])
    return note ? [`${label}: ${note}`] : []
  })
  const { height, width, depth } = fit.measures
  const open = () => fromExample(chosenExample(base, fit.plan, finish))

  return (
    <div className="flex h-dvh flex-col bg-bone">
      <div className="hidden md:block">
        <AppHeader />
      </div>
      <header className="flex items-center justify-between px-3 py-1 md:hidden">
        <button type="button" onClick={closeAdjust} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-base text-graphite-2">
          <ArrowLeft className="size-5" /> Bases
        </button>
        <Button variant="ghost" className="min-h-11 px-3" aria-label="Ajustes" onClick={() => openSettings(true)}>
          <GearSix className="size-5" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_420px]">
        <div className="relative h-[34dvh] shrink-0 bg-[var(--scene-bg)] md:h-auto md:min-h-0">
          {shown.geo ? (
            <div className="h-full" role="img" aria-label={`${base.name} en 3D: ${Math.round(height)} × ${Math.round(width)} × ${Math.round(depth)} mm, ${shown.design.pieces.length} piezas.`}>
              <SceneBoundary>
                <Scene design={shown.design} geo={shown.geo} catalog={catalog} ghosts={NO_GHOSTS} marked={NO_GHOSTS} />
              </SceneBoundary>
            </div>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-rust">Este diseño tiene errores: {shown.error}</div>
          )}
        </div>
        <section aria-labelledby="adjust-title" className="flex min-h-0 flex-1 flex-col border-line md:border-l">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-6 pb-4 md:px-9 md:pt-5">
            <button type="button" onClick={closeAdjust} className="-ml-2 hidden min-h-11 w-fit items-center gap-2 rounded-xl px-2 text-base text-graphite-2 hover:text-graphite md:inline-flex">
              <ArrowLeft className="size-4" /> Ver bases
            </button>
            <div className="flex flex-col gap-1">
              <h1 id="adjust-title" className="font-display text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                {base.name}
              </h1>
              <p className="numerals text-sm text-graphite-2" aria-label={`${height} de alto, ${width} de ancho, ${depth} de fondo, en milímetros`}>
                {Math.round(height)} × {Math.round(width)} × {Math.round(depth)} mm
              </p>
            </div>

            {asksSpace && (
              <section className="flex flex-col gap-3" aria-labelledby="where-title">
                <h2 id="where-title" className={heading}>
                  ¿Dónde lo vas a poner?
                </h2>
                <p className="text-base text-graphite-2">Aproximado, en cm, está bien. Sin esto queda con las medidas de la base.</p>
                <div className="grid grid-cols-3 gap-3">
                  {SPACE_AXES.map(([axis, label]) => {
                    const unreadable = isUnreadable(typed[axis])
                    return (
                      <label key={axis} className="flex flex-col gap-1 text-base text-graphite-2">
                        {label}
                        <span className={`flex min-h-12 items-center gap-1 rounded-2xl border bg-bone px-3 focus-within:outline-2 focus-within:outline-focus ${unreadable ? 'border-rust' : 'border-line'}`}>
                          <input
                            inputMode="decimal"
                            value={typed[axis]}
                            placeholder={String(Math.round(baseMeasures[axis] / 10))}
                            aria-invalid={unreadable}
                            onChange={(e) => setTyped((t) => ({ ...t, [axis]: e.target.value }))}
                            className="numerals min-w-0 flex-1 bg-transparent text-lg text-graphite outline-none placeholder:text-graphite-2/70"
                          />
                          <span className="numerals text-xs text-graphite-2">cm</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                <div aria-live="polite" className="flex flex-col gap-1 text-sm">
                  {SPACE_AXES.some(([axis]) => isUnreadable(typed[axis])) && <p className="text-rust">Escribe solo números, por ejemplo 90 o 37.5.</p>}
                  {notes.map((n) => (
                    <p key={n} className="text-graphite-2">
                      {n}
                    </p>
                  ))}
                  {!fit.fitsSpace && <p className="font-medium text-rust">Con esas medidas no cabe en tu espacio.</p>}
                </div>
              </section>
            )}

            {counts && limits && (
              <section className="flex flex-col gap-3" aria-labelledby="holds-title">
                <h2 id="holds-title" className={heading}>
                  ¿Qué lleva?
                </h2>
                {counters.map((kind) => (
                  <Counter key={kind} kind={kind} value={counts[kind]} min={limits[kind].min} max={limits[kind].max} onChange={(next) => change(kind, next)} />
                ))}
                <p className="text-sm text-graphite-2" aria-live="polite">
                  {countMessage ?? 'Lo que se puede cambiar lo dice la ficha de este mueble.'}
                </p>
              </section>
            )}

            <section className="flex flex-col gap-3" aria-labelledby="how-title">
              <h2 id="how-title" className={heading}>
                ¿Cómo lo quieres?
              </h2>
              <FinishSelect value={finish} onChange={setFinish} />
            </section>

            {stopper && <p className="text-sm text-rust">{stopper}</p>}
            {fit.critical.length > 0 && !stopper && <p className="text-sm text-graphite-2">Con estas medidas la revisión marcaría: {fit.critical[0]}</p>}
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-line px-5 pt-3 pb-3 md:gap-3 md:border-t-0 md:px-9 md:pb-6">
            {lines && (
              <div className="flex items-baseline justify-between gap-3 md:items-center md:rounded-2xl md:bg-kraft md:px-5 md:py-4" aria-live="polite">
                <p className="flex flex-col text-base md:text-lg">
                  <span>
                    {lines.sheets}
                    <span className="text-graphite-2 md:hidden"> · aproximado</span>
                  </span>
                  <span className="hidden text-sm text-graphite-2 md:inline">Aproximado</span>
                </p>
                <p className="font-display text-2xl font-semibold md:text-3xl">{lines.cost}</p>
              </div>
            )}
            <Button variant="primary" className="min-h-14 w-full rounded-2xl text-base!" disabled={stopper !== null} onClick={open}>
              Abrir en el Studio <ArrowRight weight="bold" />
            </Button>
            <Button variant="ghost" className="min-h-11 w-full text-base!" onClick={() => fromExample(base)}>
              Saltar y usar la base tal cual
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
