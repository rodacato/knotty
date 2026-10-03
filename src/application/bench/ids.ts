// Ids of a bench run and its jobs. Pure: the clock and the entropy come from the caller.

const pad = (n: number, width: number) => String(n).padStart(width, '0')

/** Hex of random bytes, for the entropy of a run id. */
export const entropyOf = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Millisecond precision plus caller entropy: two runs in the same millisecond differ as long as their entropy does. */
export function newRunId(now: Date, entropy: string): string {
  if (!/^[0-9a-f]{6,}$/.test(entropy)) throw new RangeError('newRunId: entropy must be at least 6 lowercase hex characters')
  const day = `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1, 2)}${pad(now.getUTCDate(), 2)}`
  const time = `${pad(now.getUTCHours(), 2)}${pad(now.getUTCMinutes(), 2)}${pad(now.getUTCSeconds(), 2)}${pad(now.getUTCMilliseconds(), 3)}`
  return `${day}-${time}-${entropy}`
}

/** Lowercase letters, digits and dashes stay; everything else becomes `_<hex codepoint>_`. Injective, and safe on case-insensitive file systems. */
export function slug(s: string): string {
  if (s === '') return '_'
  return [...s].map((ch) => (/[a-z0-9-]/.test(ch) ? ch : `_${ch.codePointAt(0)!.toString(16)}_`)).join('')
}

/** One job is one whole scenario run, so a trial and a job share the id. */
export function jobId(runId: string, caseId: string, trial: number): string {
  if (!Number.isInteger(trial) || trial < 0) throw new RangeError('jobId: trial must be a non-negative integer')
  return `${runId}.${slug(caseId)}.t${trial}`
}

export const trialId = jobId

export const fileNameOf = (id: string) => `${id}.json`
