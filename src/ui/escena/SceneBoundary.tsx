import { Component, type ReactNode } from 'react'

/** Si el navegador no puede dibujar el 3D (sin WebGL, GPU saturada), el resto del estudio sigue sirviendo. */
export class BordeEscena extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }

  static getDerivedStateFromError() {
    return { fallo: true }
  }

  render() {
    if (!this.state.fallo) return this.props.children
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="flex max-w-xs flex-col gap-2">
          <p className="font-medium">No se pudo dibujar el mueble en 3D</p>
          <p className="text-sm text-grafito-2">Tu navegador no tiene WebGL disponible. El experto, los materiales y la revisión funcionan igual.</p>
          <button type="button" className="text-sm underline" onClick={() => this.setState({ fallo: false })}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }
}
