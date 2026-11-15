import { fichaOrigin } from '../../application/useCases'
import type { DesignState } from '../../domain/session/state'

/** Where the design comes from, quietly: the ficha it was opened from and whether it changed, or that it is a design of its own. */
export function FichaOrigin({ state, className = 'text-[11px] text-graphite-2/80' }: { state: DesignState; className?: string }) {
  const origin = fichaOrigin(state)
  const text = origin ? `${origin.code} v${origin.version}${origin.changed ? ' · con cambios' : ''}` : 'Personalizado'
  const title = origin ? `Sale de la ficha ${origin.code}, versión ${origin.version}${origin.changed ? ', y cambió desde entonces' : ''}` : 'No sale de ninguna ficha: lo diseñaste tú o el experto'
  return (
    <span title={title} className={`font-mono whitespace-nowrap ${className}`}>
      {' · '}
      {text}
    </span>
  )
}
