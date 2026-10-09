function consecutiveRuns(numbers: number[]): number[][] {
  const runs: number[][] = []
  for (const n of [...numbers].sort((a, b) => a - b)) {
    const run = runs.at(-1)
    if (run && n === run.at(-1)! + 1) run.push(n)
    else runs.push([n])
  }
  return runs
}

type NameToken = string | number

/** A name with its loose whole numbers apart, so names that differ in one of them can be said together; "1.2" and "1-3" stay text. */
const nameTokens = (name: string): NameToken[] => name.split(/(?<![\d.-])([1-9]\d*)(?![\d.-])/).map((part, i) => (i % 2 ? Number(part) : part))

const runText = (run: number[]) => (run.length === 1 ? run[0] : `${run[0]} ${run.length === 2 ? 'y' : 'a'} ${run.at(-1)}`)

/** The names that are equal but for the number at `slot`, said once for each run of that number. */
function mergedAt(names: NameToken[][], slot: number): NameToken[][] {
  const alike = new Map<string, NameToken[][]>()
  for (const name of names) {
    const key = JSON.stringify(typeof name[slot] === 'number' ? name.map((token, i) => (i === slot ? null : token)) : name)
    alike.set(key, [...(alike.get(key) ?? []), name])
  }
  return [...alike.values()].flatMap((group) =>
    group.length === 1 ? group : consecutiveRuns(group.map((name) => name[slot] as number)).map((run) => group[0].map((token, i) => (i === slot ? runText(run) : token))),
  )
}

/** "Repisa 1", "Repisa 2", "Repisa 3", "Zoclo" → "Repisa 1 a 3, Zoclo": every piece still named, a run of numbers said once. */
export function namesText(names: string[]): string {
  let merged = [...new Set(names)].map(nameTokens)
  for (let before = Infinity; merged.length < before; ) {
    before = merged.length
    for (let slot = 1; slot < Math.max(...merged.map((name) => name.length)); slot += 2) merged = mergedAt(merged, slot)
  }
  return merged.map((name) => name.join('')).join(', ')
}
