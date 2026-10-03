import { z } from 'zod'
import { jobId } from './ids'

// The identity of one bench run: what was measured, with what, and how far it got. Hashes arrive as opaque strings.

export const CLASSIFICATIONS = ['pass', 'known-failure', 'infrastructure', 'regression'] as const
export type Classification = (typeof CLASSIFICATIONS)[number]

export const JOB_STATUSES = ['pending', 'running', 'done', 'failed', 'cancelled'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

const FORBIDDEN_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-api-key', 'api-key'])
const ALLOWED_HEADER = /^(x-request-id|request-id|retry-after|x-ratelimit-[a-z-]+|x-queue-[a-z-]+|x-shellm-[a-z-]+|openai-model|anthropic-ratelimit-[a-z-]+)$/

/** Only headers that say how the call went, never one that can carry a credential. */
export const allowlistHeaders = (headers: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v] as const).filter(([k]) => !FORBIDDEN_HEADERS.has(k) && ALLOWED_HEADER.test(k)))

const SECRET_KEY = /api[-_]?key|authorization|cookie|password|passwd|secret|credential|bearer|access[-_]?token|auth[-_]?token|^token$|private[-_]?key/i
const SECRET_VALUE: [RegExp, string][] = [
  [/\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/i, 'a bearer token'],
  [/\bsk-[A-Za-z0-9_-]{12,}/, 'an sk- key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
]
// Hex is excluded because commits and hashes are legitimate long values.
const looksLikeLongKey = (s: string) => /^[A-Za-z0-9+/]{40,}={0,2}$/.test(s) && !/^[0-9a-f]+$/i.test(s)

/** Throws when a key or a value anywhere in the object looks like a credential. */
export function assertNoSecrets(value: unknown, path = '$'): void {
  if (typeof value === 'string') {
    for (const [pattern, what] of SECRET_VALUE) if (pattern.test(value)) throw new Error(`Secret refused at ${path}: ${what}`)
    if (looksLikeLongKey(value)) throw new Error(`Secret refused at ${path}: a long key-like value`)
    return
  }
  if (Array.isArray(value)) return value.forEach((v, i) => assertNoSecrets(v, `${path}[${i}]`))
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k)) throw new Error(`Secret refused at ${path}.${k}: credential-looking key`)
      assertNoSecrets(v, `${path}.${k}`)
    }
  }
}

const CallTelemetry = z.object({
  status: z.number().int(),
  ttfbMs: z.number().nonnegative().nullable(),
  totalMs: z.number().nonnegative(),
  responseModel: z.string().nullable(),
  requestId: z.string().nullable(),
  queuedMs: z.number().nonnegative().optional(),
  headersAllowlisted: z.record(z.string(), z.string()).refine((h) => Object.keys(h).every((k) => ALLOWED_HEADER.test(k) && !FORBIDDEN_HEADERS.has(k)), 'header outside the allowlist'),
})
export type CallTelemetry = z.infer<typeof CallTelemetry>

const JobRecord = z.object({
  jobId: z.string().min(1),
  caseId: z.string().min(1),
  trial: z.number().int().nonnegative(),
  status: z.enum(JOB_STATUSES),
  outcome: z.enum(CLASSIFICATIONS).optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  file: z.string().optional(),
  queuedMs: z.number().nonnegative().optional(),
  telemetry: z.array(CallTelemetry).optional(),
})
export type JobRecord = z.infer<typeof JobRecord>

const hash = z.string().min(1)
const hashes = z.union([hash, z.record(z.string(), hash)])
const positive = z.number().int().min(1)

const Concurrency = z.object({ default: positive, perHost: z.record(z.string(), positive), global: positive.optional() })
export type Concurrency = z.infer<typeof Concurrency>

const Host = z.string().min(1).refine((h) => !/[@?#\s]/.test(h), 'host with credentials, query or spaces')

export const Manifest = z.object({
  version: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.string().min(1),
  label: z.string(),
  /** Which suite the run belongs to; absent in the bench's own runs. */
  suite: z.enum(['bench', 'hard']).optional(),
  commit: z.string().regex(/^[0-9a-f]{40}$/, 'full 40-character commit'),
  state: z.object({ dirty: z.boolean(), stateHash: hash.nullable() }),
  hashes: z.object({
    cases: z.record(z.string(), hash),
    graderVersion: hash,
    prompts: hashes,
    schemas: hashes,
    catalog: hash,
    corpus: hash.nullable(),
  }),
  provider: z.object({ spec: z.string().min(1), host: Host, requestedModel: z.string().nullable(), effectiveModels: z.array(z.string()) }),
  config: z.object({
    repeat: positive,
    concurrency: Concurrency,
    casesFilter: z.array(z.string()).nullable(),
    timeouts: z.object({ requestMs: z.number().int().positive(), jobMs: z.number().int().positive().nullable() }),
  }),
  regradedFrom: z.object({ runId: z.string().min(1), graderVersion: z.string().min(1) }).optional(),
  jobs: z.array(JobRecord),
})
export type Manifest = z.infer<typeof Manifest>

export const ManifestIdentity = Manifest.omit({ jobs: true })
export type ManifestIdentity = z.infer<typeof ManifestIdentity>

/** Validates and refuses anything that looks like a credential. */
export function parseManifest(input: unknown): Manifest {
  const manifest = Manifest.parse(input)
  assertNoSecrets(manifest)
  return manifest
}

export const buildManifest = parseManifest

/** One pending job per case and trial, in case order. */
export const newJobs = (runId: string, caseIds: string[], repeat: number): JobRecord[] =>
  caseIds.flatMap((caseId) => Array.from({ length: repeat }, (_, trial) => ({ jobId: jobId(runId, caseId, trial), caseId, trial, status: 'pending' as const })))

export const updateJob = (manifest: Manifest, id: string, patch: Partial<Omit<JobRecord, 'jobId' | 'caseId' | 'trial'>>): Manifest => {
  if (!manifest.jobs.some((j) => j.jobId === id)) throw new Error(`updateJob: no job ${id}`)
  return parseManifest({ ...manifest, jobs: manifest.jobs.map((j) => (j.jobId === id ? { ...j, ...patch } : j)) })
}

export interface JobSummary {
  planned: number
  pending: number
  running: number
  finished: number
  failed: number
  cancelled: number
}

export function summarizeJobs(manifest: Pick<Manifest, 'jobs'>): JobSummary {
  const count = (s: JobStatus) => manifest.jobs.filter((j) => j.status === s).length
  return { planned: manifest.jobs.length, pending: count('pending'), running: count('running'), finished: count('done'), failed: count('failed'), cancelled: count('cancelled') }
}

export interface Compatibility {
  compatible: boolean
  /** Why the runs cannot be compared at all. */
  reasons: string[]
  /** What differs between two runs that are still comparable (prompts, schemas): what the comparison is measuring. */
  varies: string[]
  /** Per-case differences: a changed case is incomparable on its own, an added or retired one is only listed. */
  cases: { added: string[]; retired: string[]; changed: string[] }
}

const sameText = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function differingKeys(a: string | Record<string, string>, b: string | Record<string, string>): string[] {
  if (typeof a === 'string' || typeof b === 'string') return sameText(a, b) ? [] : ['*']
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort()
}

// Comparing two runs measures a prompt or schema change, so it lands in `varies`; resuming one needs them unchanged.
export function compatibility(a: ManifestIdentity, b: ManifestIdentity, mode: 'resume' | 'compare' = 'resume'): Compatibility {
  const reasons: string[] = []
  const varies: string[] = []
  if (a.hashes.graderVersion !== b.hashes.graderVersion) reasons.push(`grader version ${a.hashes.graderVersion} vs ${b.hashes.graderVersion}`)
  for (const part of ['prompts', 'schemas'] as const) {
    const keys = differingKeys(a.hashes[part], b.hashes[part])
    if (!keys.length) continue
    const text = `${part} differ${keys[0] === '*' ? '' : `: ${keys.join(', ')}`}`
    if (mode === 'compare') varies.push(text)
    else reasons.push(text)
  }
  if (a.hashes.catalog !== b.hashes.catalog) reasons.push('catalog differs')
  if (a.hashes.corpus !== b.hashes.corpus) reasons.push('corpus differs')
  if (a.provider.spec !== b.provider.spec) reasons.push(`provider ${a.provider.spec} vs ${b.provider.spec}`)

  const left = a.hashes.cases
  const right = b.hashes.cases
  const added = Object.keys(right).filter((k) => !(k in left)).sort()
  const retired = Object.keys(left).filter((k) => !(k in right)).sort()
  const changed = Object.keys(left).filter((k) => k in right && left[k] !== right[k]).sort()
  return { compatible: reasons.length === 0, reasons, varies, cases: { added, retired, changed } }
}
