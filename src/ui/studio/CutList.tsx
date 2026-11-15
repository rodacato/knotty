import type { CounterBlock } from '../../domain/estimate/counterList'
import { cm } from '../system/components'
import { useStore } from '../store'

/** The cut list as the lumberyard's message carries it: the same lines under the same numbers. */
export function CutList({ blocks }: { blocks: CounterBlock[] }) {
  const select = useStore((s) => s.select)
  const selection = useStore((s) => s.selection)
  const total = blocks.reduce((n, b) => n + b.lines.reduce((m, r) => m + r.count, 0), 0)
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <p className="text-[15px] text-graphite">
        {total} piezas en {new Set(blocks.map((b) => b.material.thickness)).size} espesores. Toca una para verla.
      </p>
      {blocks.map((b) => (
        <div key={b.material.id} className="flex flex-col gap-1.5">
          <p className="flex items-baseline justify-between gap-3 font-display text-lg font-semibold">
            {b.name}
            <span className="numerals shrink-0 border-2 border-graphite px-2 py-0.5 text-xs font-normal">
              {b.sheets} {b.sheets === 1 ? 'hoja' : 'hojas'}
            </span>
          </p>
          <ol className="flex flex-col divide-y divide-line border-y-2 border-graphite">
            {b.lines.map((r) => {
              const chosen = r.ids.includes(selection ?? '')
              return (
                <li key={r.number}>
                  {/* The chosen line is marked in ink, never by tint alone (UI-93). */}
                  <button
                    type="button"
                    onClick={() => select(r.ids[0])}
                    aria-pressed={chosen}
                    className={`flex min-h-11 w-full items-start gap-3 py-3 pr-1 text-left transition hover:bg-kraft ${chosen ? 'border-l-8 border-graphite bg-select-soft pl-2' : 'pl-4'}`}
                  >
                    <span className="numerals w-6 shrink-0 pt-0.5 text-sm text-graphite-2">{r.number}.</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{r.names}</span>
                      <span className="numerals block text-xs text-graphite-2">
                        {r.length} × {r.width} mm{r.rounded ? ' (redondeado)' : ''} · {cm(r.length)} × {cm(r.width)}
                      </span>
                      {(r.grain || r.banding) && <span className="block text-xs text-graphite-2">{[r.grain, r.banding].filter(Boolean).join(' · ')}</span>}
                      {r.after && <span className="block text-xs text-graphite-2">{r.after}</span>}
                    </span>
                    <span className="numerals grid min-w-9 shrink-0 place-items-center border-2 border-graphite px-1 py-0.5 text-sm font-semibold">{r.count}×</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}
