// Turns the recordings of e2e/demo/demos.ts into the README's GIFs, in design/brand/demo/. Run by `npm run brand:demo`.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RUN = 'e2e/demo-results/run.json'
const OUT = 'design/brand/demo'
const WIDTH = { main: 800 }
const SMALL_WIDTH = 640
// 8 fps and 96 colors keep the main clip under the budget and still readable (measured: 12 fps and 192 colors gave 12.6 MB).
const FPS = 8
const MAIN_BUDGET = 5 * 1024 * 1024

const run = JSON.parse(readFileSync(RUN, 'utf8'))
const results = run.suites.flatMap(function specs(s) { return [...(s.specs ?? []), ...(s.suites ?? []).flatMap(specs)] })

mkdirSync(OUT, { recursive: true })
let failed = false
for (const spec of results) {
  const result = spec.tests[0]?.results.at(-1)
  if (!result || result.status !== 'passed') {
    console.error(`× ${spec.title}: the recording did not pass (${result?.status ?? 'no result'}); no GIF made.`)
    failed = true
    continue
  }
  const video = result.attachments.find((a) => a.name === 'video')?.path
  const start = Number(result.annotations?.find((a) => a.type === 'clip-start')?.description ?? 0)
  if (!video) throw new Error(`${spec.title}: no video was recorded.`)
  const width = WIDTH[spec.title] ?? SMALL_WIDTH
  const gif = join(OUT, `${spec.title}.gif`)
  // One palette per clip, made from the frames themselves; bayer dithering keeps the wood grain without noise.
  const filter = `fps=${FPS},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-i', video, '-vf', filter, '-loop', '0', gif], { stdio: 'inherit' })
  const size = statSync(gif).size
  const over = spec.title === 'main' && size > MAIN_BUDGET
  console.log(`${over ? '!' : '✓'} ${gif}  ${(size / 1024 / 1024).toFixed(1)} MB${over ? ' — over the 5 MB budget for the README' : ''}`)
}
if (failed) process.exit(1)
