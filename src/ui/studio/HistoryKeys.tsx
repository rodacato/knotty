import { useEffect } from 'react'
import { draftOf, useStore } from '../store'
import { historyStep } from './historyStep'

/** Undo and redo from the keyboard. With a draft open, undo takes back its last step and nothing is redone; nothing moves while the expert works or a dialog is open. */
export function HistoryKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = historyStep(e)
      const s = useStore.getState()
      if (!step || s.thinking || document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      const draft = draftOf(s)
      if (draft) return step === 'undo' && draft.steps.length ? s.undoPlanEdit() : undefined
      s[step]()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
  return null
}
