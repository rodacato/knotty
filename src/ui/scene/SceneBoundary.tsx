import { Component, type ReactNode } from 'react'

/** If the browser cannot draw the 3D (no WebGL, busy GPU), the rest of the studio keeps working. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="flex max-w-xs flex-col gap-2">
          <p className="font-medium">No se pudo dibujar el mueble en 3D</p>
          <p className="text-sm text-graphite-2">Tu navegador no tiene WebGL disponible. El experto, los materiales y la revisión funcionan igual.</p>
          <button type="button" className="text-sm underline" onClick={() => this.setState({ failed: false })}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }
}
