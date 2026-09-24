import { useEffect, useState } from 'react'
import { Ajustes } from './ajustes/Ajustes'
import { Analizando } from './captura/Analizando'
import { Captura } from './captura/Captura'
import { Inicio } from './captura/Inicio'
import { Estudio } from './estudio/Estudio'
import { ContextoServicios, type Servicios } from './servicios'
import { Lapiz } from './sistema/componentes'
import { useTienda } from './tienda'

function Pantalla() {
  const fase = useTienda((s) => s.fase)
  const estado = useTienda((s) => s.estado)
  if (fase === 'estudio' && estado) return <Estudio estado={estado} />
  if (fase === 'analizando') return <Analizando />
  if (fase === 'captura') return <Captura />
  return <Inicio />
}

export function App({ componer }: { componer: () => Promise<Servicios> }) {
  const [servicios, setServicios] = useState<Servicios | null>(null)
  const [error, setError] = useState<string | null>(null)
  const iniciar = useTienda((s) => s.iniciar)

  useEffect(() => {
    componer()
      .then((s) => {
        iniciar(s)
        setServicios(s)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo iniciar.'))
  }, [componer, iniciar])

  if (error) return <p className="grid h-full place-items-center p-6 text-oxido">{error}</p>
  if (!servicios)
    return (
      <div className="grid h-full place-items-center text-ambar">
        <Lapiz className="h-8 w-20" />
      </div>
    )
  return (
    <ContextoServicios.Provider value={servicios}>
      <Pantalla />
      <Ajustes />
    </ContextoServicios.Provider>
  )
}
