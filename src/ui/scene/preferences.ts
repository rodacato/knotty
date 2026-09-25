import { useEffect, useState } from 'react'

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const change = () => setMatches(m.matches)
    m.addEventListener('change', change)
    return () => m.removeEventListener('change', change)
  }, [query])
  return matches
}

export const useDark = () => useMediaQuery('(prefers-color-scheme: dark)')
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
/** A touch screen without a mouse: almost always a phone, with less GPU and battery. */
export const useTouch = () => useMediaQuery('(pointer: coarse)')
