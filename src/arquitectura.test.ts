import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Las fronteras de la arquitectura hexagonal, verificadas leyendo los imports de cada archivo.

const SRC = join(import.meta.dirname)

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta)
    return /\.tsx?$/.test(nombre) && !/\.test(-util)?\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

function imports(ruta: string) {
  const codigo = readFileSync(ruta, 'utf8')
  return [...codigo.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
}

const capa = (ruta: string) => relative(SRC, ruta).split('/')[0]

/** Qué puede importar cada capa, además de sí misma. */
const PERMITIDO: Record<string, { capas: string[]; paquetes: RegExp }> = {
  domain: { capas: [], paquetes: /^zod$/ },
  application: { capas: ['domain', 'ports'], paquetes: /^zod$/ },
  ports: { capas: ['domain'], paquetes: /^$/ },
  adapters: { capas: ['domain', 'ports'], paquetes: /./ },
  ui: { capas: ['domain', 'application', 'ports'], paquetes: /./ },
}

describe('arquitectura', () => {
  for (const [nombre, regla] of Object.entries(PERMITIDO)) {
    it(`${nombre}/ solo importa lo permitido`, () => {
      const violaciones: string[] = []
      for (const archivo of archivos(join(SRC, nombre))) {
        for (const destino of imports(archivo)) {
          if (destino.startsWith('.')) {
            const otra = capa(join(archivo, '..', destino))
            if (otra !== nombre && !regla.capas.includes(otra)) violaciones.push(`${relative(SRC, archivo)} → ${destino}`)
          } else if (!regla.paquetes.test(destino)) {
            violaciones.push(`${relative(SRC, archivo)} → ${destino}`)
          }
        }
      }
      expect(violaciones).toEqual([])
    })
  }

  it('domain/ no toca el navegador', () => {
    const usos = archivos(join(SRC, 'domain')).filter((a) => /\b(window|document|localStorage|fetch)\b/.test(readFileSync(a, 'utf8')))
    expect(usos.map((a) => relative(SRC, a))).toEqual([])
  })
})
