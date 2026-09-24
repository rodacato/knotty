import { useEffect, useState } from 'react'

function useConsulta(consulta: string) {
  const [si, setSi] = useState(() => matchMedia(consulta).matches)
  useEffect(() => {
    const m = matchMedia(consulta)
    const cambio = () => setSi(m.matches)
    m.addEventListener('change', cambio)
    return () => m.removeEventListener('change', cambio)
  }, [consulta])
  return si
}

export const useOscuro = () => useConsulta('(prefers-color-scheme: dark)')
export const useMovimientoReducido = () => useConsulta('(prefers-reduced-motion: reduce)')
/** Pantalla táctil sin mouse: casi siempre un celular, con menos GPU y batería. */
export const useTactil = () => useConsulta('(pointer: coarse)')
