import { ChatCircleText, Tray as TrayIcon, X } from '@phosphor-icons/react'
import type { TrayItem } from '../../domain/session/tray/tray'
import { Button } from '../system/components'
import { useStore } from '../store'

// What waits for the expert, next to the chat box: taken out one by one, sent all at once.

const KIND: Record<TrayItem['kind'], string> = { notice: 'Aviso', answer: 'Respuesta', suggestion: 'Pedido' }

export function Tray({ items, typed, onSend }: { items: TrayItem[]; typed: boolean; onSend: () => void }) {
  const toggleTray = useStore((s) => s.toggleTray)
  const thinking = useStore((s) => s.thinking)
  if (!items.length) return null
  return (
    <div className="animate-appear mx-4 mb-2 flex flex-col gap-1.5" aria-label="Bandeja para el experto">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <TrayIcon weight="duotone" className="text-graphite" /> Bandeja · {items.length}
        </p>
        <Button variant="secondary" className="px-3 text-xs" disabled={thinking} onClick={onSend}>
          <ChatCircleText weight="fill" /> Consultar al experto
        </Button>
      </div>
      <ul className="-my-2 flex gap-1.5 overflow-x-auto py-2 [scrollbar-width:none]">
        {items.map((i) => (
          <li key={i.id} className="flex max-w-full shrink-0 items-center gap-1 rounded-full border border-line bg-bone py-1 pr-1.5 pl-3 text-[13px]" title={`${KIND[i.kind]}: ${i.text}`}>
            <span className="truncate">{i.label}</span>
            <button type="button" onClick={() => toggleTray(i)} disabled={thinking} aria-label={`Quitar «${i.label}» de la bandeja`} className="-my-3 -mr-3 -ml-1.5 grid size-11 shrink-0 place-items-center rounded-full text-graphite-2 hover:text-graphite">
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      <p className="hidden text-xs text-graphite sm:block">{typed ? 'Lo que escribiste va en el mismo pedido.' : 'Va todo en un solo pedido; si escribes algo abajo, se suma.'}</p>
    </div>
  )
}
