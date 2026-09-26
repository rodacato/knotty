import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// The boundaries of the hexagonal architecture, checked by reading each file's imports.

const SRC = join(import.meta.dirname)

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/.test(name) && !/\.test(-util)?\.tsx?$/.test(name) ? [path] : []
  })
}

function imports(path: string) {
  const code = readFileSync(path, 'utf8')
  return [...code.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
}

const layer = (path: string) => relative(SRC, path).split('/')[0]

/** What each layer may import, besides itself. */
const ALLOWED: Record<string, { layers: string[]; packages: RegExp }> = {
  domain: { layers: [], packages: /^zod$/ },
  application: { layers: ['domain', 'ports'], packages: /^zod$/ },
  ports: { layers: ['domain'], packages: /^zod$/ },
  adapters: { layers: ['domain', 'ports'], packages: /./ },
  ui: { layers: ['domain', 'application', 'ports'], packages: /./ },
}

describe('architecture', () => {
  for (const [name, rule] of Object.entries(ALLOWED)) {
    it(`${name}/ only imports what is allowed`, () => {
      const violations: string[] = []
      for (const file of files(join(SRC, name))) {
        for (const target of imports(file)) {
          if (target.startsWith('.')) {
            const other = layer(join(file, '..', target))
            if (other !== name && !rule.layers.includes(other)) violations.push(`${relative(SRC, file)} → ${target}`)
          } else if (!rule.packages.test(target)) {
            violations.push(`${relative(SRC, file)} → ${target}`)
          }
        }
      }
      expect(violations).toEqual([])
    })
  }

  // Inside the domain, six groups by intent. materials and design are the base; checks, furniture and editing build on them;
  // session sits on top and nothing imports it. These are the edges that exist today: design ↔ materials, design and materials →
  // checks (structure/assumptions), checks → furniture (the mattresses of the bed) and furniture ↔ editing are cycles to cut
  // (docs/PROPUESTA.md, paso 28). A new edge between groups has to be added here on purpose. Loose files at the root
  // (sources.ts) are shared by every group and import none.
  const GROUPS: Record<string, string[]> = {
    materials: ['design', 'checks'],
    design: ['materials', 'checks'],
    checks: ['design', 'materials', 'furniture'],
    furniture: ['design', 'materials', 'checks', 'editing'],
    editing: ['design', 'materials', 'checks', 'furniture'],
    session: ['design', 'materials', 'checks', 'furniture', 'editing'],
  }
  const DOMAIN = join(SRC, 'domain')
  const group = (path: string) => {
    const [first, ...rest] = relative(DOMAIN, path).split('/')
    return rest.length ? first : '(root)'
  }

  it('domain/ holds only its groups and sources', () => {
    const entries = readdirSync(DOMAIN).filter((name) => !/^sources(\.test(-util)?)?\.ts$/.test(name))
    expect(entries.sort()).toEqual(Object.keys(GROUPS).sort())
  })

  it('each domain group only imports the groups allowed', () => {
    const violations: string[] = []
    for (const file of files(DOMAIN)) {
      const from = group(file)
      for (const target of imports(file).filter((t) => t.startsWith('.'))) {
        const to = group(join(file, '..', target))
        const allowed = from === '(root)' ? [] : [...GROUPS[from], '(root)']
        if (to !== from && !allowed.includes(to)) violations.push(`${relative(SRC, file)} → ${target}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('domain/ does not touch the browser', () => {
    const uses = files(join(SRC, 'domain')).filter((f) => /\b(window|document|localStorage|fetch)\b/.test(readFileSync(f, 'utf8')))
    expect(uses.map((f) => relative(SRC, f))).toEqual([])
  })
})
