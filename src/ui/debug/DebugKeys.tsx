import { useCallback, useEffect } from 'react'
import { useStore } from '../store'
import { KonamiTrail } from './KonamiTrail'

/** The keys that show the debug tools: Ctrl+Shift+D switches them, the Konami code turns them on. */
export function DebugKeys() {
  const setVisible = useStore((s) => s.setDebugVisible)

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

  return <KonamiTrail onComplete={useCallback(() => setVisible(true), [setVisible])} />
}
