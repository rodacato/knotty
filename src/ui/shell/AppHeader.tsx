import { GearSix } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Emblem } from '../system/Brand'
import { useStore } from '../store'
import { useExpertStatus } from './expertStatus'

/** The masthead the app shares with the site (UI-93): one black band, the brand at left, light links parted by fine rules. */
export function AppHeader({ action }: { action?: { label: ReactNode; onClick: () => void } }) {
  const openSettings = useStore((s) => s.openSettings)
  const openConnect = useStore((s) => s.openConnect)
  const { connected } = useExpertStatus()
  const link = 'inline-flex min-h-11 items-center gap-2 px-3 font-display text-lg font-medium uppercase hover:underline hover:decoration-2 hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-bone md:px-5'
  return (
    <div className="bg-graphite text-bone">
      <header className="mx-auto flex w-full max-w-[1280px] items-center gap-3 px-5 py-2.5 md:px-8">
        <a href="../" aria-label="Knotty: ir al inicio" className="flex min-h-11 items-center gap-3 focus-visible:outline-2 focus-visible:outline-bone">
          <Emblem className="size-8 shrink-0" />
          <span className="font-display text-[34px] leading-none font-semibold">Knotty</span>
        </a>
        <div className="ml-auto flex items-center">
          <button type="button" onClick={() => (connected ? openSettings(true) : openConnect(true))} className={link}>
            <span aria-hidden className={`size-3.5 shrink-0 border-2 border-bone ${connected ? 'bg-bone' : ''}`} />
            <span className="md:hidden">{connected ? 'Con experto' : 'Sin experto'}</span>
            <span className="hidden md:inline">{connected ? 'Experto conectado' : 'Experto sin conectar'}</span>
          </button>
          <button type="button" onClick={() => openSettings(true)} aria-label="Ajustes" className={`${link} border-l-2 border-bone/60`}>
            <GearSix className="size-5 md:hidden" aria-hidden />
            <span className="hidden md:inline">Ajustes</span>
          </button>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="ml-3 hidden min-h-11 items-center border-2 border-bone px-5 font-display text-xl font-semibold uppercase hover:bg-bone/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone md:ml-5 md:inline-flex"
            >
              {action.label}
            </button>
          )}
        </div>
      </header>
    </div>
  )
}
