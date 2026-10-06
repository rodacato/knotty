import { GearSix } from '@phosphor-icons/react'
import { Emblem } from '../system/Brand'
import { Button } from '../system/components'
import { useStore } from '../store'
import { useExpertStatus } from './expertStatus'

export function AppHeader() {
  const openSettings = useStore((s) => s.openSettings)
  const openConnect = useStore((s) => s.openConnect)
  const goHome = useStore((s) => s.goHome)
  const { connected } = useExpertStatus()
  return (
    <header className="mx-auto flex w-full max-w-[1280px] items-center gap-3 px-5 py-3 md:px-8 md:py-4">
      <button type="button" onClick={goHome} aria-label="Knotty: ver todos los muebles" className="flex min-h-11 items-center gap-3 rounded-xl">
        <Emblem className="size-9 shrink-0 md:size-10" />
        <span className="font-display text-2xl font-semibold tracking-tight [font-variation-settings:'opsz'_48]">Knotty</span>
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => (connected ? openSettings(true) : openConnect(true))}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-bone px-4 text-sm font-medium transition hover:bg-kraft"
      >
        <span aria-hidden className={`size-2.5 rounded-full border-[1.5px] border-graphite ${connected ? 'bg-graphite' : ''}`} />
        <span className="md:hidden">{connected ? 'Con experto' : 'Sin experto'}</span>
        <span className="hidden md:inline">{connected ? 'Experto conectado' : 'Experto sin conectar'}</span>
      </button>
      <Button variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => openSettings(true)} aria-label="Ajustes">
        <GearSix className="size-5 md:size-4" />
        <span className="hidden md:inline">Ajustes</span>
      </Button>
    </header>
  )
}
