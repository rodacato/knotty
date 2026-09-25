import { ChatCircleText, Tray as TrayIcon, X } from '@phosphor-icons/react'
import type { TrayItem } from '../../domain/tray/tray'
import { Button } from '../system/components'
import { useStore } from '../store'

// What waits for the expert, next to the chat box: taken out one by one, sent all at once.

const KIND: Record<TrayItem['kind'], string> = { notice: 'Aviso', answer: 'Respuesta', suggestion: 'Pedido' }

export function Tray({ items, typed, onSend }: { items: TrayItem[]; typed: boolean; onSend: () => void }) {
  const toggleTray = useStore((s) => s.toggleTray)
  const thinking = useStore((s) => s.thinking)
  if (!items.length) return null
  return (
    <div className="animate-aparecer mx-3 mb-2 flex flex-col gap-2 rounded-2xl border border-ambar/40 bg-ambar-suave/40 p-2.5" aria-label="Bandeja para el experto">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-grafito-2 uppercase">
          <TrayIcon weight="duotone" className="text-ambar" /> Bandeja · {items.length}
        </p>
        <Button variant="primary" className="min-h-8 px-3 text-xs" disabled={thinking} onClick={onSend}>
          <ChatCircleText weight="fill" /> Consultar al experto
        </Button>
      </div>
      <ul className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
        {items.map((i) => (
          <li key={i.id} className="flex max-w-full items-center gap-1 rounded-full border border-linea bg-hueso py-0.5 pr-1 pl-2.5 text-xs" title={`${KIND[i.kind]}: ${i.text}`}>
            <span className="truncate">{i.label}</span>
            <button type="button" onClick={() => toggleTray(i)} disabled={thinking} aria-label={`Quitar «${i.label}» de la bandeja`} className="shrink-0 rounded-full p-0.5 text-grafito-2 hover:bg-kraft hover:text-grafito">
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      <p className="hidden text-xs text-grafito-2 sm:block">{typed ? 'Lo que escribiste va en el mismo pedido.' : 'Va todo en un solo pedido; si escribes algo abajo, se suma.'}</p>
    </div>
  )
}
