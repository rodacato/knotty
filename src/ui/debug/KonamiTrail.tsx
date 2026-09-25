import { useEffect, useState } from 'react'

// Shows the Konami code as it is typed: what is done in ink, what is left faint. It appears from the second right key, so a stray arrow does not flash it.

export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
const GLYPH: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', b: 'B', a: 'A' }
const SHOW_FROM = 2
const FADE_MS = 1_200

/** How many keys of the code were typed right, allowing a new attempt to start at any moment. */
export function progress(typed: string[]) {
  for (let length = Math.min(typed.length, KONAMI.length); length > 0; length--) {
    const tail = typed.slice(-length)
    if (tail.every((k, i) => k === KONAMI[i])) return length
  }
  return 0
}

export function KonamiTrail({ onComplete }: { onComplete: () => void }) {
  const [done, setDone] = useState(0)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    let typed: string[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    const onKey = (e: KeyboardEvent) => {
      // Typing in a field is not playing.
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')) return
      typed = [...typed, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length)
      const n = progress(typed)
      clearTimeout(timer)
      if (n === KONAMI.length) {
        typed = []
        setDone(n)
        setComplete(true)
        onComplete()
        timer = setTimeout(() => {
          setComplete(false)
          setDone(0)
        }, FADE_MS)
        return
      }
      setDone(n)
      timer = setTimeout(() => setDone(0), FADE_MS * 2)
    }
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('keydown', onKey)
      clearTimeout(timer)
    }
  }, [onComplete])

  if (done < SHOW_FROM && !complete) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center" aria-hidden>
      <div className={`animate-aparecer flex items-center gap-1.5 rounded-full px-4 py-2 font-mono text-sm shadow-xl transition-colors duration-300 ${complete ? 'bg-ambar text-grafito' : 'bg-grafito text-hueso'}`}>
        {KONAMI.map((k, i) => (
          <span key={i} className={`w-3 text-center transition-opacity ${i < done ? 'opacity-100' : 'opacity-25'}`}>
            {GLYPH[k]}
          </span>
        ))}
        {complete && <span className="ml-2 font-sans text-xs font-medium">Entrañas de la madera</span>}
      </div>
    </div>
  )
}
