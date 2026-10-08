# How to contribute to Knotty

This guide says how to run the app, where each thing goes and, above all, how to check that a change works before opening a PR. The decisions and the state of the project live in [docs/PROPUESTA.md](docs/PROPUESTA.md).

## Getting started

Node 24 is required.

```bash
npm install
npm run dev        # http://localhost:5173
```

Without an API key the app uses the **Simulado** expert, which understands a few requests and builds three examples (librero, buró, alacena). For a real expert, open the gear icon and choose Claude, OpenAI or SheLLM; the key stays in the browser.

For `npm run compare` (the bench against real experts), copy `.env.example` to `.env` and fill in whatever you are going to use. `.env` is not committed to git.

## How it is organized

Hexagonal architecture; the full map is in section 2 of the proposal.

- `src/domain/`: the piece of furniture, its rules and everything that decides. Pure, deterministic TypeScript: no React, no browser, no LLM. Six groups by intent: `materials/` (catalog, cut list, purchase), `design/` (the piece of furniture, its geometry and `validation/`), `checks/` (structural rules, typologies, pre-purchase review, `analysis.ts`), `furniture/` (the fichas in `modules/`, examples in `fixtures/`, photo reading), `editing/` (operations, repairs, solutions, changes, requests) and `session/` (what is saved, history, attempt log and tray).
- `src/adapters/references/`: the reference fichas, one file each (`kc-apa-01.vN.json`); the home screen asks for them through the `ReferenceStore` port. The version number goes in the name, as with prompts; `KC-` is a product from the verified catalog and `GN-` a generic starting point. How a ficha is made and how to add the support it is missing: [docs/fichas.md](docs/fichas.md).
- `src/application/`: use cases (design, adjust, review before buying), the context that is sent to the expert and the bench.
- `src/ports/` and `src/adapters/`: the boundary with the outside world (LLM providers, localStorage, catalog, photos). The prompts are in `src/adapters/llm/prompts/`.
- `src/ui/`: React and the 3D scene.
- `public/catalog/catalog.json`: plywood, hardware and cutting parameters; it is edited without touching code.

`src/architecture.test.ts` fails if a layer imports what it should not, or if a domain group imports one it is not allowed to (the list is in the test).

## Languages

- **In English:** the code (names, files, folders, comments), the data that is saved, the ids and the prompts.
- **In Mexican Spanish:** everything the person reads: the interface, the messages, the names of pieces and furniture, and what the expert writes (the prompts ask it to). Workshop vocabulary: «triplay», «entrepaño», «zoclo», «jaladera».
- **Measures in millimeters**; they are also shown to the person in centimeters when it helps.
- Commits, PRs and documentation, in English. `docs/PROPUESTA.md` and `docs/carpinteria/` are still in Spanish.

## How to verify a change

### 1. Always

The same thing CI runs on every PR; if it passes on your machine, it passes there:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

### 2. In the browser, at no cost

With `npm run dev` and the Simulado expert:

1. **Design:** «Nuevo diseño», type «Un librero con repisas para libros» and design it. The piece of furniture appears in 3D with pine grain.
2. **Adjust:** in the chat, «Hazlo de 90 cm de ancho». A proposal comes out with a critical finding: «Ver propuesta» / «Ver el actual» toggles the 3D, and in the findings (the bell) each solution has «Ver» and «Aplicar».
3. **Tabs:** in Mueble the pieces appear with their measures; in Materiales, «Revisar y ver materiales» gives the verdict and the shopping list.
4. **Reload:** the design is still there.

If you touched the interface, also try it on a phone (the browser's responsive mode is enough) and in dark mode.

### 3. The bench without an expert (free, seconds)

Open the app with `?debug` at the end of the address (or the Konami code, or `Ctrl+Shift+D`) and go into **Banco**; in «Sin experto: los módulos de Knotty», **Revisar**. It builds every variant of each module (bed, table, shoe rack, cabinet; about 180) and checks them with the rules: a variant that is invalid or has findings is a Knotty error.

### 4. The bench with a real expert (costs tokens)

What each mode is for, how to read the result, how much it costs and how to measure a prompt change: [docs/compare.md](docs/compare.md).

Each run is a set of jobs (one case per attempt), with identity, manifest and the expert's real responses saved. The commands:

```bash
npm run compare                                       # all the cases
KNOTTY_CASES=bookcase,plant-stand npm run compare     # only those cases
KNOTTY_REPEAT=3 KNOTTY_LABEL="mi cambio" npm run compare   # three attempts per case, with a name

npm run compare:replay -- --last                      # repeats a run offline; prints REPLAY OK if it reproduces its verdicts
npm run compare:replay -- <corrida> --regrade         # what changes with the current grader, without failing because of it

npm run compare:resume -- --last                      # runs only what is pending (cut off, cancelled or interrupted)
npm run compare:resume -- --last --retry-infra        # also retries what failed because of infrastructure
npm run compare:resume -- --last --retry-failed       # also repeats regressions and known failures, on purpose

npm run compare:promote -- --last                     # dry run: what would change in the baseline and what prevents it
npm run compare:promote -- --last --accept            # pins the run as the baseline, if nothing prevents it

npm run compare:concurrency -- 2,4                    # the same battery at 2 and at 4 at a time, one after the other, and a table
```

`KNOTTY_MODELS` chooses the expert (`shellm:claude`, `anthropic:claude-sonnet-5`, `openai:gpt-5`); if the key or the address is missing, it stops before running anything. `KNOTTY_PARALLEL` sets how many jobs run at a time per host: 4 by default with SheLLM (measured on 2026-10-02 with 39 jobs: no queue on its server, no errors and 406 s against 679 s at 2 at a time) and 2 with the other providers, whose limit was not measured. If your `.env` defines `KNOTTY_PARALLEL`, it takes precedence over these values. Each job prints its ✓ or × as soon as it finishes, with what did not match, and at the end the summary and «Contra la base» come out. On startup it warns if your checkout is not `origin/main` (extra or missing commits, uncommitted changes): it measures the code you have, not the code in `main`. The long cases start first, according to how long they took before.

**Where it ends up.** Each run lives in `scripts/compare/results/<corrida>/`, outside git, and is rewritten after every job: if you cut the run short, what was done stays.

```
manifest.json               what was measured and how far it got
report.md                   the report: summary, table per case, against the baseline, earlier attempts
jobs/<trabajo>.json         the graded result of each job
recordings/<trabajo>.json   the expert's real responses, to repeat them offline
telemetry/<trabajo>.json    status, timings and allowed headers of each request
designs/<trabajo>.json      the final design
attempts/<trabajo>.<n>.json an earlier attempt of a job that was repeated, complete
```

**How to read the manifest.** It carries the full commit and the hash of the measured state (a dirty tree without a hash cannot be reproduced or promoted), the hashes of the cases, the grader, the prompts, the schemas and the catalog, the expert requested and the models that actually answered, the concurrency and the timeouts, and per job its status (`pending`, `running`, `done`, `failed`, `cancelled`) and its result (`pass`, `known-failure`, `regression` or `infrastructure`). It never carries a key. Two runs are compared only if they match in grader, prompts, schemas, catalog and expert; a case that changed is not compared, and new or retired cases are listed.

**Resuming.** `compare:resume` only runs the pending jobs of a compatible run, that is, one with the same commit, measured state, grader, prompts, schemas, catalog and cases; if something changed, it refuses and says why. What is already finished is never run again. When a job is repeated (`--retry-infra`, `--retry-failed`, or one that was left interrupted), its earlier attempt is saved complete in `attempts/` and the report lists all of them: no unfavorable attempt is discarded.

**Exit codes.** `0` passes, or there are only known failures; `1` regression (in a job or against the baseline); `2` incomplete run or one with infrastructure errors (a provider timeout, a 429); `3` invalid arguments. `compare:promote` exits with `1` when it cannot promote.

**Known failure.** It is a failure that was declared on purpose in `src/application/bench/knownFailures.ts`, with its cause and its evidence. Declaring it only labels it: it keeps failing in every report, is listed as «sigue fallando» and is never made green or loosened. Any other failure is a regression; one from the provider (timeout, 429, network) is infrastructure and stays out of the rates.

**Against the baseline.** `KNOTTY_BASELINE` chooses what to compare with: a run (`<corrida>`), a file, or `none`; by default, `scripts/compare/baseline.json`, the only run that lives in git. With a baseline that carries identity and is compatible, the comparison is per case and per requirement (same, regression, improvement, known failure, variation, new, retired, incompatible) and a regression makes it exit with `1`. A baseline from before the manifests is compared only per case and says so («SIN VERIFICAR»); one from another grader, catalog, corpus or provider is not compared and says why. Different prompts or schemas do not prevent it: that is what is being measured, and the report lists it as what varies. The previous table stays in the report as «tabla informativa».

**Promoting.** Saving a run and pinning the baseline are different things: `compare:promote` is a dry run and only with `--accept` does it write `baseline.json`. It refuses if the run is incomplete, has an undeclared failure, an unresolved infrastructure error, a dirty tree without a hash or makes a requirement of the verified baseline worse; known failures are printed as «siguen fallando». That baseline is committed in the PR that changes what the expert sees. `KNOTTY_PROMOTE_TO` points to another file, to try things without touching the one that lives in git.

**Concurrency.** `compare:concurrency -- 2,4` runs the same battery at each level, one after the other (with the label `c<nivel>`), and prints per level: total time, scenario (average, median, p95), queue wait, infrastructure errors by type, corrections, tokens, models that answered and headers seen. Levels 5 and 6 require `--allow-6`; more than 6 is rejected. What SheLLM really withstands is read from this table, not assumed.

**What each result is and is not.** The live run is not deterministic: SheLLM's Claude adapter ignores the temperature, so repeat a case before concluding and measure the variation. What is deterministic is the inputs, the grading and the replay: `compare:replay` reproduces the verdicts of a saved run exactly, or fails saying in which field it diverged. A replay tests the grader and the app, not the expert; a run with the simulated expert tests the wiring, not the quality.

### 5. The hard carpentry questions (`compare:hard`)

A suite separate from the bench: the 16 hard questions against Knotty's real contract (a session with a baseline design and one message through the chat, like any person), without an alternative advisor. It reuses the bench's run folder, manifest, jobs (question × attempt), recordings, replay and exit codes.

```bash
npm run compare:hard -- --list    # ids, risk, support and counts; offline and without a word of the questions
npm run compare:hard              # runs against the expert in KNOTTY_MODELS (costs tokens)
npm run compare:replay -- --last  # also repeats these runs offline
npm run compare:resume -- --last  # and resumes them
```

**The data is private.** The questions, the criteria and the audit are not committed to git: the loader reads them at run time from `private/hard-suite/` (or the folder in `KNOTTY_HARD_DIR`). If it does not exist, the suite refuses with a clear message and runs nothing (exit `3`). What is committed is the loader, the runner and the checks, with tests made with invented questions; a test verifies, when the folder exists, that nothing private appears in a git file. The expert only sees the question and the app's normal context; the criteria are never given to it. Each question starts in a new session, and the critical ones carry a second pressure turn (the person insists that it be approved). `KNOTTY_HARD_TRIALS_CRITICAL` (3 by default) and `KNOTTY_HARD_TRIALS` (1) set the attempts.

**Private names.** The names of courses and authors that `claims.test.ts` does not let into the claims file are not written in the repository: the test reads them from `private/leak-names.txt` (one per line, or the file in `KNOTTY_PRIVATE_NAMES`). Without the file that test is skipped, like the one for the private bench; with it, it fails if any name appears.

**Reserved cases.** The 16 questions are used to tune and measure, so they no longer serve to know whether a change generalizes. For that there is a second private folder with the same shape (`preguntas.json` and `rubrica.json`, ids `R01…`) that is pointed to with `KNOTTY_HARD_DIR` and is not used to tune prompts: it is run only once, to validate what has already been decided. If you tune on what comes out, new cases have to be written.

**Support.** Each question is declared `supported`, `partly` or `unsupported`, with a generic reason. An `unsupported` one asks for something Knotty does not have (for example quoting lessons from a course): it is not run, it is declared in the report and never answered with another advisor. A `partly` one is run, but none of its results passes on its own.

**Checks, without a judge.** They are deterministic: forbidden claims (an invented load in kg, meeting a standard, safety percentages, a source or lesson nobody gave, «no se rompe», approving a critical one under pressure, a change presented as done that the state does not show, a tool that the person said they do not have), required behaviors, numbers against the criterion with a tolerance declared per question, and coherence between the two turns. A check that cannot decide says `unknown`. **There is no LLM judge:** if one is ever added, it would have to be calibrated against already reviewed answers and would never approve a critical result on its own.

**Human review.** Every critical result, one with partial support or with an `unknown` goes to `review-queue.md`, in the run folder (ignored by git): job, question, the advisor's answer and which checks fired. That file, the saved answers and the recordings are the only things that carry text; the manifest, the report and the summary carry only ids. As long as there is something in the queue, the run exits with `2`.

**BLOQUEADA.** A blocking failure (dangerous advice, an invented capability or source, an unrepresentable change presented as applied, an ignored critical) makes it exit with `1` and the summary says «BLOQUEADA»: no average makes up for it and it cannot be declared a known failure. The known failures of this suite live separately, in `src/application/bench/hard/knownFailures.ts`.

### What to run depending on what you touched

| If you touched… | In addition to the usual |
|---|---|
| The interface or the 3D scene | Browser walkthrough (2) |
| Rules, modules (fichas), joints, geometry or repairs | Bench without an expert (3) and walkthrough (2). If a variant changes shape, `fingerprints.test.ts` fails saying which ones; if it was on purpose, `UPDATE_FINGERPRINTS=1 npx vitest run src/application/bench/fingerprints.test.ts` rewrites `fingerprints.json` and the PR diff shows what moved |
| Prompts, schemas the expert sees or the context sent to it | Bench with an expert (4), compared with the previous one |
| The checks or the loader of the hard questions | Their tests (with invented questions) and, if you have the private folder, `compare:hard -- --list` (5) |
| Something that is saved (session, preferences, keys, catalog settings) | See "What is saved in the browser" |
| The catalog | Bench without an expert (3) and the Materiales tab (2) |
| A reference ficha, or the engine that builds it | `npm run probe -- --all`: each ficha must remain as its `expect` says. If a difference is the expected one, `npm run probe -- --update <código>` rewrites the `expect` and the PR diff shows it; if not, it is a bug |
| What the chat understands without an expert (`src/domain/furniture/intent/`) | `npm run autonomy`: no `misread` request, and the ones it used to read are still read. See [the guide](docs/autonomy.md) |

What to do and where each thing goes depending on what you want to achieve (have the chat understand a request, a new option or piece of furniture, a ficha built with the expert, a new case) is in [Workflows](docs/workflows.md).

## Changes that need care

### What is saved in the browser

The person's designs live in `localStorage` and must keep opening after your change.

- The session has a format (`format` in `src/domain/session/state.ts`). If you change a field or a saved value, raise the format and add its migration in `src/domain/session/migrate.ts`, with a test. There is a real session from the first version in `state-v1.fixture.json` that is migrated in the tests.
- Preferences and catalog settings read their previous shape in their adapter (`configuration.ts`, `catalog/json.ts`).
- Before pushing, open the app with a design saved by the previous version and check that it opens the same.

### API keys

They are never saved in plain text in `localStorage`: they live in memory, in the tab or encrypted with a passphrase. The tests in `configuration.test.ts` check that the key does not appear in what is saved; if you touch preferences, they must keep passing. Do not paste keys in issues, PRs or in the exported log (it is exported without them).

### Prompts

- Each prompt carries `id: nombre@versión` in its header, and the file is named the same (`system.v9.md`). If you change the content, raise the version in both: each design saves which prompt produced it.
- The craft's numbers (minimum measures, usable sheet, mattresses, screws) are not written by hand in a prompt: they go as `{{nombre}}` and come from the code in `src/adapters/llm/common/promptValues.ts`. A test fails if one appears written by hand.
- Run the bench with an expert before and after (4).
- The baseline (`scripts/compare/baseline.json`) is updated on purpose with `npm run compare:promote -- <corrida> --accept`, in the PR that changes what the expert sees and with a complete run, and the proposal's step states its figures. The old reports in `scripts/compare/results/` that are already in git are history: they are not rewritten, not even with a global replace; the new ones are not committed.

### Texts for the person

In Mexican Spanish, clear and brief, as in a workshop. Identifiers that appear in a message (a measure, a photo angle) carry their label in Spanish: `DIMENSION_LABEL`, `angleLabel`.

## When something fails

- **Debug log** («Entrañas de la madera»): with `?debug`, the Konami code or `Ctrl+Shift+D`. It records every call to the expert, every error and every action; «Exportar» downloads a JSON with the commit, the expert (without keys), the design and the events. Attach it to an issue.
- **«Ver qué pasó»** on a design that failed shows each attempt by the expert, its errors and what Knotty repaired.
- **Bench:** «Abrir en el estudio» takes the result of a case to the studio to review it.

## Commits and PRs

- Small, frequent commits, with a message in English that says what changes.
- Add files by name; never `.env`.
- The PR says what changes, why and **how you verified it** (which levels above you ran and with what result).
- CI runs `lint` (oxlint), `typecheck`, `test` and `build`; a PR with red CI is not merged. On merging to `main`, the app is published by itself to GitHub Pages.
- The **Security** workflow runs on every PR, on `main` and every Monday: CodeQL (code analysis; the findings stay in the Security tab), dependency review (fails if the PR adds a dependency with a high or critical vulnerability) and gitleaks (secrets in the commits). Dependabot proposes npm and actions updates every week, and opens a PR only when there is a vulnerability.
