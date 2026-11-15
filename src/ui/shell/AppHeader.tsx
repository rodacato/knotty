import { GearSix } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Emblem } from '../system/Brand'
import { useStore } from '../store'
import { useExpertStatus } from './expertStatus'

/**
 * The masthead the app shares with the site (UI-93): one black band, the brand at left, light links parted by fine rules.
 * The expert is a state when connected and an action when not, so «Ajustes» stays the one way into the settings.
 */
export function AppHeader({ action }: { action?: { label: ReactNode; onClick: () => void } }) {
  const openSettings = useStore((s) => s.openSettings)
  const openConnect = useStore((s) => s.openConnect)
  const { provider } = useExpertStatus()
  const cell = 'inline-flex min-h-11 items-center gap-2 px-3 font-display text-lg font-medium uppercase md:px-5'
  const link = `${cell} hover:underline hover:decoration-2 hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-bone`
  return (
    <div className="bg-graphite text-bone">
      <header className="mx-auto flex w-full max-w-[1280px] items-center gap-3 px-5 py-2.5 md:px-8">
        <a href="../" aria-label="Knotty: ir al inicio" className="flex min-h-11 items-center gap-3 focus-visible:outline-2 focus-visible:outline-bone">
          <Emblem className="size-8 shrink-0" />
          <span className="font-display text-[34px] leading-none font-semibold">Knotty</span>
        </a>
        <div className="ml-auto flex items-center">
          {provider ? (
            <p role="status" className={cell}>
              <span aria-hidden className="size-3.5 shrink-0 bg-bone" />
              <span><span className="max-md:sr-only">Experto: </span>{provider}</span>
            </p>
          ) : (
            <button type="button" onClick={() => openConnect(true)} className={link}>
              <span aria-hidden className="size-3.5 shrink-0 border-2 border-bone" />
              <span>Conectar<span className="max-md:hidden"> experto</span></span>
            </button>
          )}
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
