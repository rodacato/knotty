# Compare

Runs Knotty against a real expert and grades what comes back with Knotty's own checks. Two suites share one runner: the **bench** (the fixed cases of `src/application/bench/cases.ts`) and the **hard** suite (private carpentry questions).

This file is the map of the folder. How to use the commands and read a result is elsewhere:

- [docs/compare.md](../../docs/compare.md): what each mode is for, how to read a result, what it costs, how to measure a prompt change.
- [CONTRIBUTING.md](../../CONTRIBUTING.md), levels 4 and 5: every command, the run directory, the manifest, exit codes, the baseline.
- `npm run compare -- --help`: the commands and the environment variables, from the code.

## Layout

```
cli.mjs            entry of every npm run compare:* command
vitest.config.ts   picks the one file under targets/ that the command means
baseline.json      the baseline: the only run kept in git
results/           one directory per run; ignored, except the old reports already tracked
targets/           one file per command: reads the environment, calls a runner, reports the exit code
bench/             the bench suite: run, resume, replay, promote, concurrency
hard/              the hard suite: load the private data, run, resume, replay
shared/            what both suites stand on
```

### `targets/`: one per command

Thin on purpose: no logic to test lives here, so none of these files has a test.

| File | Command | Offline |
|---|---|---|
| `models.compare.ts` | `npm run compare` | No |
| `resume.compare.ts` | `compare:resume` (bench or hard, by the run's manifest) | No |
| `concurrency.compare.ts` | `compare:concurrency` | No |
| `hard.compare.ts` | `compare:hard` | Only with `--list` |
| `replay.compare.ts` | `compare:replay` (bench or hard) | Yes |
| `promote.compare.ts` | `compare:promote` | Yes |

### `bench/`

| File | What it does |
|---|---|
| `run.ts` | `runCompare` and `resumeCompare`: the cases as jobs, a manifest saved after every job, every answer recorded |
| `replayRun.ts` | Replays a saved run through the app with its recorded answers and says where a verdict diverged |
| `promoteRun.ts` | Decides whether a saved run may become the baseline and, when accepted, writes it |
| `concurrencyRun.ts` | The same battery at each concurrency level, one run after another |
| `baselineFile.ts` | The baseline as a file, as a saved run, or none (`KNOTTY_BASELINE`) |
| `summary.ts` | The progress lines, the final summary and the exit code of a run |
| `runs.test-util.ts` | Simulated and scripted experts for the tests of this folder |

### `hard/`

| File | What it does |
|---|---|
| `loader.ts` | Turns the private files into the candidate's side and the evaluator's key, at run time |
| `run.ts` | `runHard`, `resumeHard`, `replayHard`: one job per question and trial, on the bench's run directory |
| `leak.test.ts` | Fails when anything from the private bank shows up in a file git tracks |

### `shared/`

| File | What it does |
|---|---|
| `store.ts` | The run directory on disk: manifest, jobs, recordings, telemetry, designs, attempts |
| `hashing.ts` | The identity of what a run measured: commit and dirty state, cases, prompts, schemas, catalog |
| `telemetry.ts` | Wraps `fetch` to record status, timings and allowlisted headers per job |
| `live.ts` | Which provider a spec in `KNOTTY_MODELS` means and what it needs from the environment |
| `keys.ts` | Loads `.env`, unless only the simulated expert was named |
| `paths.ts` | Where `baseline.json` and `results/` are |
| `deterministic.ts` | A clock and ids a replay can rebuild exactly |

## How a command runs

1. `cli.mjs` parses the arguments, refuses the ones it does not understand (exit `3`) and turns the rest into environment variables: vitest takes no custom arguments.
2. It starts vitest with `vitest.config.ts`, which includes the single file `targets/<target>.compare.ts`.
3. The target calls a runner from `bench/` or `hard/`. The grading itself is not here: it is `src/application/bench/`, the same code the app's bench drawer runs.
4. The target writes the exit code to a file `cli.mjs` reads back, because vitest only knows passed or failed.

## What the tests cover

Every `*.test.ts` here runs in `npm test`, offline and without tokens, against the simulated expert: a full run and its replay, resuming a cut run, retries, promotion and its refusals, the store, the hashes, telemetry and the CLI's arguments. They prove the wiring, never the quality of an expert.

## Traps

- `shared/live.ts` loads the keys when it is imported. The offline targets (`replay`, `promote`, `hard -- --list`) must not import it; `hard.compare.ts` imports it late for that reason.
- The path `scripts/compare/results/` is written in `.gitignore`, `.oxlintrc.json`, `shared/hashing.ts` (it is left out of the measured state) and `hard/leak.test.ts`. Moving it means changing all of them.
- `scripts/autonomy/ask.ts` imports `shared/live.ts` to find the expert the same way.
- The reports in `results/*.md` that git already tracks are history: they are not rewritten or moved.
