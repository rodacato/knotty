import { lazy, Suspense, useEffect, useState } from 'react'
import { Ajustes } from './ajustes/Ajustes'
import { PuertaLlaves } from './ajustes/Llaves'
import { Analizando } from './captura/Analizando'
import { Captura } from './captura/Captura'
import { Inicio } from './captura/Inicio'
import { ContextoServicios, type Servicios } from './servicios'
import { Lapiz } from './sistema/componentes'
import { Nudo } from './sistema/Marca'
import { useTienda } from './tienda'

// El 3D pesa: se carga hasta que hay un mueble que mostrar.
const Estudio = lazy(() => import('./estudio/Estudio').then((m) => ({ default: m.Estudio })))

const Cargando = () => (
  <div className="grid h-full place-items-center">
    <div className="flex flex-col items-center gap-3 text-ambar">
      <Nudo className="size-12 animate-pulse" />
      <Lapiz className="h-6 w-16" />
    </div>
  </div>
)

function Pantalla() {
  const fase = useTienda((s) => s.fase)
  const estado = useTienda((s) => s.estado)
  if (fase === 'estudio' && estado)
    return (
      <Suspense fallback={<Cargando />}>
        <Estudio estado={estado} />
      </Suspense>
    )
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
  if (!servicios) return <Cargando />
  return (
    <ContextoServicios.Provider value={servicios}>
      <Pantalla />
      <Ajustes />
      <PuertaLlaves />
    </ContextoServicios.Provider>
  )
}
