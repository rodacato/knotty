import { createContext, useContext } from 'react'
import type { CasosDeUso } from '../application/casosDeUso'
import type { Catalogo } from '../domain/materiales/catalogo'
import type { Preferencias } from '../ports/Preferencias'
import type { ProcesadorImagen } from '../ports/ProcesadorImagen'

export interface Servicios {
  casos: CasosDeUso
  catalogo: Catalogo
  imagenes: ProcesadorImagen
  preferencias: Preferencias
}

export const ContextoServicios = createContext<Servicios | null>(null)

export function useServicios() {
  const s = useContext(ContextoServicios)
  if (!s) throw new Error('Faltan los servicios: envuelve la app en ContextoServicios.')
  return s
}
