// The one way a ficha file is written, so that a change to a ficha moves only the lines it changes. `probe --update` writes it; the tests read every shipped file back through it.

/** The keys of a ficha in the order they are written. */
const ORDER = ['format', 'code', 'id', 'home', 'name', 'kind', 'finish', 'inspiredBy', 'support', 'difficulty', 'features', 'adaptations', 'gaps', 'notes', 'plan', 'expect']

const isValue = (v: unknown) => typeof v !== 'object' || v === null

function write(v: unknown, depth: number): string {
  const pad = '  '.repeat(depth)
  if (Array.isArray(v)) {
    if (v.every(isValue)) return JSON.stringify(v)
    return `[\n${v.map((x) => `${pad}  ${write(x, depth + 1)}`).join(',\n')}\n${pad}]`
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v)
    if (!entries.length) return '{}'
    // An object of plain values is one line: a cell, the dimensions, the sheets.
    if (entries.every(([, x]) => isValue(x))) return `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(', ')} }`
    return `{\n${entries.map(([k, x]) => `${pad}  ${JSON.stringify(k)}: ${write(x, depth + 1)}`).join(',\n')}\n${pad}}`
  }
  return JSON.stringify(v)
}

/** The text of a ficha file: the top-level keys in order, the plan as it comes. */
export function formatFicha(file: Record<string, unknown>): string {
  const known = ORDER.filter((k) => k in file)
  const rest = Object.keys(file).filter((k) => !ORDER.includes(k)).sort()
  return `${write(Object.fromEntries([...known, ...rest].map((k) => [k, file[k]])), 0)}\n`
}
