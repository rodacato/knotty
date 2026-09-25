import { ArrowCounterClockwise, Eye, EyeSlash } from '@phosphor-icons/react'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { ChangeList } from '../chat/ChangeList'
import { Button } from '../system/components'
import { useStore } from '../store'
import { TraceLog } from './TraceLog'

// Every version, newest first, with what changed in each and how to go back: seen from the header, not a tab.

const relative = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })

function ago(date: string) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000
  if (Number.isNaN(seconds)) return ''
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  return 'hace un momento'
}

const PROVIDER: Record<string, string> = { simulated: 'Simulado', anthropic: 'Claude', openai: 'OpenAI', shellm: 'SheLLM' }

export function HistoryPanel({ state }: { state: DesignState }) {
  const viewedVersion = useStore((s) => s.viewedVersion)
  const viewVersion = useStore((s) => s.viewVersion)
  const backToVersion = useStore((s) => s.backToVersion)
  const thinking = useStore((s) => s.thinking)
  const versions = [...state.versions].sort((a, b) => b.n - a.n)

  return (
    <div className="flex flex-col gap-4 p-4">
      <ol className="relative flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-line">
        {versions.map((v) => {
          const current = v.n === state.current
          const viewing = v.n === viewedVersion
          return (
            <li key={v.n} className="animate-appear relative flex gap-3">
              <span className={`z-10 mt-1 grid size-6 shrink-0 place-items-center rounded-full border-2 ${current ? 'border-amber bg-amber' : viewing ? 'border-amber bg-bone' : 'border-line bg-bone'}`}>
                {current && <span className="size-2 rounded-full bg-bone" />}
              </span>
              <div className={`flex min-w-0 flex-1 flex-col gap-1.5 rounded-2xl border p-3 transition ${viewing ? 'border-amber bg-amber-soft' : 'border-line bg-bone'}`}>
                <div className="flex items-baseline gap-2">
                  <span className="numerals text-xs text-graphite-2">v{v.n}</span>
                  <span className="min-w-0 flex-1 leading-snug font-medium">{v.summary}</span>
                  {current && <span className="rounded-full bg-graphite px-2 py-px text-[10px] font-medium text-bone">Actual</span>}
                </div>
                {v.reason && v.reason !== v.summary && !v.reason.startsWith('Volver a v') && <p className="line-clamp-3 text-sm whitespace-pre-line text-graphite-2" title={v.reason}>«{v.reason}»</p>}
                <p className="text-[11px] text-graphite-2">
                  {ago(v.date)}
                  {v.origin && ` · ${PROVIDER[v.origin.provider] ?? v.origin.provider}`}
                  {v.operations.length > 0 && ` · ${v.operations.length} ${v.operations.length === 1 ? 'operación' : 'operaciones'}`}
                </p>
                <ChangeList state={state} version={v.n} />
                {!current && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => viewVersion(viewing ? null : v.n)}>
                      {viewing ? <EyeSlash /> : <Eye />} {viewing ? 'Dejar de ver' : 'Ver'}
                    </Button>
                    <Button variant="ghost" className="min-h-8 px-3 text-xs" disabled={thinking} onClick={() => backToVersion(v.n)}>
                      <ArrowCounterClockwise /> Volver a esta
                    </Button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <details className="rounded-2xl border border-line bg-bone/60 p-3">
        <summary className="cursor-pointer text-sm font-medium">Bitácora: qué hizo el experto</summary>
        <div className="mt-3">
          <TraceLog trace={state.trace} pieces={currentDesign(state).pieces} />
        </div>
      </details>
    </div>
  )
}
