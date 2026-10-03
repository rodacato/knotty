// Two-sided Fisher exact test on two pass counts: whether a difference in rates is more than the variation two identical runs would show.

export const ALPHA = 0.05

const logFactorials = (n: number): number[] => {
  const table = [0]
  for (let i = 1; i <= n; i++) table.push(table[i - 1] + Math.log(i))
  return table
}

/** The probability of seeing a split at least as lopsided as the observed one, when both runs share one failure rate. */
export function fisherP(base: { failed: number; counted: number }, candidate: { failed: number; counted: number }): number {
  const total = base.counted + candidate.counted
  const failed = base.failed + candidate.failed
  if (!base.counted || !candidate.counted || !failed || failed === total) return 1
  const f = logFactorials(total)
  const choose = (n: number, k: number) => f[n] - f[k] - f[n - k]
  const probability = (x: number) => Math.exp(choose(failed, x) + choose(total - failed, base.counted - x) - choose(total, base.counted))
  const observed = probability(base.failed)
  let p = 0
  for (let x = Math.max(0, base.counted - (total - failed)); x <= Math.min(base.counted, failed); x++) {
    const px = probability(x)
    if (px <= observed * (1 + 1e-9)) p += px
  }
  return Math.min(1, p)
}

/** The least repetitions per side at which an all-passing base against an all-failing candidate would stand out, for telling how many a doubtful case needs. */
export function repeatsToTell(): number {
  for (let n = 1; n <= 50; n++) if (fisherP({ failed: 0, counted: n }, { failed: n, counted: n }) < ALPHA) return n
  return 50
}
