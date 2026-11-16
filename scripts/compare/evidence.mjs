// A pull request that changes a prompt says how it was measured: a compare run id, or why none was needed.
// Run in CI with BASE_SHA and PR_BODY in the environment; exits 1 when a prompt changed and the body says neither.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const PROMPTS = 'src/adapters/llm/prompts/'
/** As compare names a run: date, time with milliseconds, and a short hash. */
export const RUN_ID = /\b\d{8}-\d{9}-[0-9a-f]{8}\b/
export const WAIVER = /^No compare run: \S.*$/m

/** What is missing from the pull request, or null when nothing is. */
export function missingEvidence(changed, body) {
  const prompts = changed.filter((path) => path.startsWith(PROMPTS))
  if (!prompts.length || RUN_ID.test(body ?? '') || WAIVER.test(body ?? '')) return null
  return `This pull request changes ${prompts.join(', ')}. Cite the npm run compare run that measured it (its id, like 20261116-150849440-0208d13a) in the description, or add a line «No compare run: <why>».`
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const changed = execFileSync('git', ['diff', '--name-only', `${process.env.BASE_SHA}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean)
  const missing = missingEvidence(changed, process.env.PR_BODY)
  if (missing) {
    console.error(missing)
    process.exit(1)
  }
  console.log(changed.some((path) => path.startsWith(PROMPTS)) ? 'A prompt changed, and the description says how it was measured.' : 'No prompt changed.')
}
