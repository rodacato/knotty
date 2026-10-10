import { ArrowUUpLeft, ArrowUUpRight } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { redoTarget, undoTarget } from '../../domain/session/history/history'
import { draftOf, useStore, type Store } from '../store'
import { historyStep } from './historyStep'

type Step = 'undo' | 'redo'

/** One step back or forward, from a key or a button: with a draft open, undo takes back its last step and nothing is redone. What stopped it, if something did. */
function take(step: Step): string | null {
  const s = useStore.getState()
  const draft = draftOf(s)
  if (draft) {
    if (step === 'undo' && draft.steps.length) s.undoPlanEdit()
    return null
  }
  const result = s[step]()
  return result.ok ? null : result.message
}

/** Undo and redo from the keyboard; nothing moves while the expert works or a dialog is open. */
export function HistoryKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = historyStep(e)
      if (!step || useStore.getState().thinking || document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      take(step)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
  return null
}

const available = (s: Store, step: Step): boolean => !!s.state && !s.thinking && (step === 'undo' ? undoTarget : redoTarget)(s.state.versions, s.state.current) !== null

const BUTTON = 'pointer-events-auto grid size-11 place-items-center rounded-full border border-line bg-bone/90 text-graphite shadow-sm backdrop-blur transition hover:bg-kraft disabled:text-graphite-2/40 disabled:hover:bg-bone/90'

/** The same two steps for a hand: a phone has no Ctrl+Z. Each is off when there is nothing to go back or forward to, and says so when the checks refuse the design it would bring back. A draft has its own «Deshacer», so they step aside while one is open. */
export function HistoryButtons() {
  const can = { undo: useStore((s) => available(s, 'undo')), redo: useStore((s) => available(s, 'redo')) }
  const [refused, setRefused] = useState<string | null>(null)
  const drafting = useStore((s) => !!draftOf(s))
  if (drafting) return null
  return (
    <>
      {refused && (
        <p role="status" className="pointer-events-auto max-w-56 rounded-xl border border-line bg-bone/95 px-3 py-2 text-xs text-graphite shadow-sm">
          {refused}
        </p>
      )}
      {/* One over the other: side by side they reach «Terminar de editar» on a phone. */}
      <div className="flex flex-col gap-2">
        <button type="button" aria-label="Deshacer" title="Deshacer" disabled={!can.undo} onClick={() => setRefused(take('undo'))} className={BUTTON}>
          <ArrowUUpLeft weight="bold" />
        </button>
        <button type="button" aria-label="Rehacer" title="Rehacer" disabled={!can.redo} onClick={() => setRefused(take('redo'))} className={BUTTON}>
          <ArrowUUpRight weight="bold" />
        </button>
      </div>
    </>
  )
}
