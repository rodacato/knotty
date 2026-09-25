import { Camera, Images } from '@phosphor-icons/react'
import { useRef, type ReactNode } from 'react'
import { Boton } from './componentes'

/** Cámara o galería: en el celular `capture` abre la cámara directo; en escritorio ambos abren el selector de archivos. */
export function TomarFoto({ alElegir, deshabilitado = false, compacto = false, etiqueta }: { alElegir: (archivo: File) => void; deshabilitado?: boolean; compacto?: boolean; etiqueta?: ReactNode }) {
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const elegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (archivo) alElegir(archivo)
    e.target.value = ''
  }
  const tamano = compacto ? 'min-h-9 flex-1 px-2 text-xs' : 'min-h-9 text-xs'
  return (
    <>
      <Boton variante="primario" className={tamano} onClick={() => camara.current?.click()} disabled={deshabilitado} aria-label="Tomar foto">
        <Camera weight="bold" /> {!compacto && (etiqueta ?? 'Tomar foto')}
      </Boton>
      <Boton variante="secundario" className={tamano} onClick={() => galeria.current?.click()} disabled={deshabilitado} aria-label="Elegir de la galería">
        <Images weight="bold" /> {!compacto && 'Galería'}
      </Boton>
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={elegir} />
      <input ref={galeria} type="file" accept="image/*" hidden onChange={elegir} />
    </>
  )
}
