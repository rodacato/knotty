import { useEffect, useState } from 'react'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import type { SavingSearch } from '../../domain/furniture/saving/saving'
import { useStore } from '../store'

/** «Ahorrar material» over a plan: the search, run a moment after it is asked for so the button can say so first, and what is done with its options. */
export function useSavingSearch(plan: FurniturePlan | null) {
  const findSavings = useStore((s) => s.findSavings)
  const previewFix = useStore((s) => s.previewFix)
  const lockField = useStore((s) => s.lockField)
  const [search, setSearch] = useState<SavingSearch | null>(null)
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    if (!searching || !plan) return
    const timer = setTimeout(() => {
      setSearch(findSavings(plan))
      setSearching(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [searching, plan, findSavings])
  // An option seen in 3D belongs to the results: leaving them hides it.
  useEffect(() => {
    if (search) return () => previewFix(null)
  }, [search, previewFix])
  const close = () => {
    previewFix(null)
    setSearch(null)
  }
  return {
    search,
    searching,
    start: () => setSearching(true),
    close,
    reset: () => setSearch(null),
    release: (key: string) => {
      lockField(key, false)
      setSearch(null)
      setSearching(true)
    },
  }
}
