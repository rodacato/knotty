/** A clock and ids that depend only on how many times they were asked, so a replay builds the same session as the run it replays. */
export function deterministicSeeds() {
  let ids = 0
  let ticks = 0
  return {
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, ticks++)).toISOString(),
    newId: () => `id-${++ids}`,
  }
}
