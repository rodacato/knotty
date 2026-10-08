import type { Design } from '../../domain/design/schema'
import type { Geometry } from '../../domain/design/resolve'
import { afterCut, afterCutText, cutList, type CutLine } from '../../domain/estimate/cutList'
import { cm } from '../system/components'
import { useStore } from '../store'

export function PieceList({ design, geo }: { design: Design; geo: Geometry }) {
  const select = useStore((s) => s.select)
  const selection = useStore((s) => s.selection)
  const list = cutList(design, geo)
  const total = list.reduce((n, r) => n + r.count, 0)
  const after = (r: CutLine) => afterCutText(afterCut(design, r), r.count)
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm text-graphite">
        {total} piezas en {new Set(list.map((r) => r.thickness)).size} espesores. Toca una para verla.
      </p>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-bone">
        {list.map((r) => (
          <li key={r.ids.join()}>
            <button
              type="button"
              onClick={() => select(r.ids[0])}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-kraft ${r.ids.includes(selection ?? '') ? 'bg-amber-soft' : ''}`}
            >
              <span className="numerals grid size-8 shrink-0 place-items-center rounded-lg bg-kraft text-sm font-medium">{r.count}×</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="numerals block text-xs text-graphite-2">
                  {r.length} × {r.width} mm · {cm(r.length)} × {cm(r.width)}
                </span>
                {after(r) && <span className="block text-xs text-graphite-2">{after(r)}</span>}
              </span>
              <span className="numerals shrink-0 rounded-full border border-line px-2 py-0.5 text-xs">{r.thickness} mm</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
