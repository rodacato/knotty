import { flushSync } from 'react-dom'

export type PageDirection = 'forward' | 'back'

/** Moving between the Studio and a page of its own slides like going forward or back; without View Transitions, or with reduced motion, it just swaps. */
export function withPageTransition(direction: PageDirection, change: () => void) {
  const root = typeof document === 'undefined' ? null : document.documentElement
  if (!root || !('startViewTransition' in document) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    change()
    return
  }
  root.dataset.page = direction
  const transition = document.startViewTransition(() => flushSync(change))
  void transition.finished.finally(() => delete root.dataset.page)
}
