import { House } from '@phosphor-icons/react'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { useRoom } from './store'
import { materialById } from '../../domain/materials/catalog'
import type { FurnitureSource } from './layout'

export function RoomLauncher({ source, className, disabled = false }: { source: FurnitureSource; className?: string; disabled?: boolean }) {
  const returning = useRoom((s) => !!s.layout && s.layout.items.some((i) => i.kind === 'furniture' && i.source.identity === source.identity))
  const open = useStore((s) => s.setRoomOpen)
  const { catalog } = useServices()
  const available = source.design.pieces.every((p) => !!materialById(catalog, p.material))
  return (
    <Button
      variant="ghost"
      className={className}
      disabled={disabled || !available}
      data-room-launch
      title={!available ? 'Esta ficha necesita materiales que no están disponibles.' : disabled ? 'Vuelve al diseño actual y revisa su geometría para verlo en tu espacio.' : undefined}
      onClick={(e) => {
        useRoom.getState().launch(source, e.currentTarget)
        open(true)
      }}
    >
      <House weight="bold" /> {returning ? 'Volver a mi espacio' : 'Ver en tu espacio'}
    </Button>
  )
}
