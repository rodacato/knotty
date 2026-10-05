import { Books, Flask, House, TerminalWindow } from '@phosphor-icons/react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useServices } from '../services'
import { useStore } from '../store'
import { BenchDrawer } from './BenchDrawer'
import { Drawer } from './Drawer'
import { FichasDrawer } from './FichasDrawer'
import { RoomDrawer } from '../lab/RoomDrawer'
import { RoomScene } from '../lab/RoomScene'
import { captureGlobalErrors, instrumentStore } from './instrument'
import { KonamiTrail } from './KonamiTrail'
import { LogDrawer } from './LogDrawer'

// The debug tools: hidden until asked for (Konami code, Ctrl+Shift+D, settings or ?debug), they are a bar on the left of the whole app with one drawer per tool.

type Tool = 'bench' | 'fichas' | 'room' | 'log'

const TOOLS: { id: Tool; label: string; icon: ReactNode }[] = [
  { id: 'bench', label: 'Banco de pruebas', icon: <Flask size={20} /> },
  { id: 'fichas', label: 'Fichas', icon: <Books size={20} /> },
  { id: 'room', label: 'Cuarto', icon: <House size={20} /> },
  { id: 'log', label: 'Entrañas de la madera', icon: <TerminalWindow size={20} /> },
]

export function DebugShell({ children }: { children: ReactNode }) {
  const { debug } = useServices()
  const visible = useStore((s) => s.debugVisible)
  const setVisible = useStore((s) => s.setDebugVisible)
  const [open, setOpen] = useState<Tool | null>(null)
  const [seen, setSeen] = useState<Set<Tool>>(new Set())

  const show = useCallback((tool: Tool | null) => {
    setOpen(tool)
    if (tool) setSeen((s) => new Set([...s, tool]))
  }, [])

  useEffect(() => {
    const stopStore = instrumentStore(debug)
    const stopErrors = captureGlobalErrors(debug)
    return () => {
      stopStore()
      stopErrors()
    }
  }, [debug])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setVisible(!useStore.getState().debugVisible)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [setVisible])

  // The Konami code goes straight to the insides: shown, with the log open.
  const openFromKonami = useCallback(() => {
    setVisible(true)
    show('log')
  }, [setVisible, show])

  // The same tree whether the bar shows or not, so toggling it never remounts the screen (a half-written capture survives).
  return (
    <>
      <div className={visible ? 'flex h-dvh' : 'contents'}>
        {visible && (
          <>
            <nav aria-label="Herramientas de depuración" className="fixed bottom-3 left-3 z-40 flex gap-2 md:static md:z-auto md:h-dvh md:w-[52px] md:shrink-0 md:flex-col md:items-center md:gap-1 md:border-r md:border-line md:bg-bone md:py-2">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={t.label}
                  aria-pressed={open === t.id}
                  onClick={() => show(open === t.id ? null : t.id)}
                  className={`grid size-11 place-items-center rounded-full border shadow-lg md:shadow-none ${open === t.id ? 'border-amber bg-amber-soft text-graphite' : 'border-transparent bg-graphite text-bone md:bg-transparent md:text-graphite-2 md:hover:bg-kraft'}`}
                >
                  {t.icon}
                </button>
              ))}
            </nav>
            <Drawer open={open === 'bench'} onClose={() => show(null)} label="el banco de pruebas" width="md:w-[380px]">
              {seen.has('bench') && <BenchDrawer />}
            </Drawer>
            <Drawer open={open === 'fichas'} onClose={() => show(null)} label="las fichas" width="md:w-[420px]">
              {seen.has('fichas') && <FichasDrawer />}
            </Drawer>
            <Drawer open={open === 'room'} onClose={() => show(null)} label="el cuarto" width="md:w-[380px]">
              {seen.has('room') && <RoomDrawer />}
            </Drawer>
            <Drawer open={open === 'log'} onClose={() => show(null)} label="las entrañas de la madera" width="md:w-[480px]">
              {seen.has('log') && <LogDrawer open={open === 'log'} />}
            </Drawer>
          </>
        )}
        <div className={visible ? 'relative h-dvh min-w-0 flex-1 overflow-y-auto' : 'contents'}>
          {children}
          {/* The room covers the screen without unmounting it, so closing the drawer gives the Studio back as it was. */}
          {visible && open === 'room' && (
            <div className="absolute inset-0 z-30 bg-kraft">
              <RoomScene />
            </div>
          )}
        </div>
      </div>
      <KonamiTrail onComplete={openFromKonami} />
    </>
  )
}
