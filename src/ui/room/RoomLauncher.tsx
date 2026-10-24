import { House } from '@phosphor-icons/react'
import type { MouseEvent } from 'react'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { useRoom } from './store'
import { materialById } from '../../domain/materials/catalog'
import type { FurnitureSource } from './layout'

/** `round`: an icon only, for the Studio's scene, where the pill would take the slot of the next step (UI-90). */
export function RoomLauncher({ source, className, disabled = false, round = false }: { source: FurnitureSource; className?: string; disabled?: boolean; round?: boolean }) {
  const returning = useRoom((s) => !!s.layout && s.layout.items.some((i) => i.kind === 'furniture' && i.source.identity === source.identity))
  const open = useStore((s) => s.setRoomOpen)
  const { catalog } = useServices()
  const available = source.design.pieces.every((p) => !!materialById(catalog, p.material))
  const label = returning ? 'Volver a mi espacio' : 'Ver en tu espacio'
  const reason = !available ? 'Esta ficha necesita materiales que no están disponibles.' : disabled ? 'Vuelve al diseño actual y revisa su geometría para verlo en tu espacio.' : undefined
  const launch = (e: MouseEvent<HTMLButtonElement>) => {
    useRoom.getState().launch(source, e.currentTarget)
    open(true)
  }
  if (round)
    return (
      <button type="button" className={className} disabled={disabled || !available} data-room-launch aria-label={label} title={reason ?? label} onClick={launch}>
        <House weight={returning ? 'fill' : 'bold'} />
      </button>
    )
  return (
    <Button variant="ghost" className={className} disabled={disabled || !available} data-room-launch title={reason} onClick={launch}>
      <House weight="bold" /> {label}
    </Button>
  )
}
