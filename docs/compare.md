# The compare guide

How to measure whether a change made what the expert does better or worse. The detail of each command and of the files a run leaves behind is in [CONTRIBUTING.md](../CONTRIBUTING.md) (§4 and §5); this guide explains what each mode is for, how to read the result, what it costs and which mistakes to avoid.

## What it is, in one sentence

A set of jobs (one case per attempt) that is run against a real expert, graded with deterministic rules, stored with its identity and compared against another run. **There is no LLM judge**: what the grader cannot decide, it says (`unknown`) and sends to a person.

## What it measures and what it does not

| Measures | Does not measure |
|---|---|
| That the design is valid, reasonable and viable | That advice is correct, honest or safe (that is the hard suite, and even then a person reviews it) |
| That the structure comes out as requested (doors, drawers, shelves) | The quality of the wording or the tone |
| That each step of a scenario leaves the expected state | That the real assembly holds up: a valid geometry does not prove strength or buildability |
| Tokens and time per job | Which expert is «better» in general: each run measures one expert, one commit and some prompts |

The live run **is not deterministic**. SheLLM's Claude adapter ignores temperature, so the same case gives different results. What is deterministic is the inputs, the grading and the replay.

## The modes

| I want to… | Command | Does it cost tokens? |
|---|---|---|
| Check that Knotty's modules have no invalid variants | Bench in the app (`?debug` → Banco → Revisar) | No |
| Test the compare wiring, without an expert | `KNOTTY_MODELS=simulated:x npm run compare` | No |
| Measure a change against the real expert | `npm run compare` | Yes |
| Repeat a stored run and see whether the grader reproduces the verdicts | `npm run compare:replay -- --last` | No |
| See what changes with a new grader, without calling the expert again | `npm run compare:replay -- <corrida> --regrade` | No |
| Finish a cut-off run or retry what failed because of the provider | `npm run compare:resume -- --last [--retry-infra]` | Only what is pending |
| Hard carpentry questions, with human review | `npm run compare:hard` | Yes |
| Find out how many jobs your server can handle at once | `npm run compare:concurrency -- 2,4` | Yes, double |
| Pin a run as the baseline | `npm run compare:promote -- --last [--accept]` | No |

`--list` in `compare:hard` prints ids, risk and counts offline and without a word of the questions.

### The bench (`npm run compare`)

16 fixed cases in `src/application/bench/cases.ts` (the bookcase and three variants —heavy books, only drill and jigsaw, widening it—, bed, bed with drawers, nightstand, wall cabinet, desk, shoe rack, TV stand, sideboard, coffee table and planter; the list lives in the file). Each case is a scenario: a request and, sometimes, adjustments in later turns, graded step by step on the real state it left behind. `KNOTTY_REPEAT` sets the attempts per case; the job is case × attempt.

### The hard suite (`npm run compare:hard`)

16 questions, each with a fresh session; the 11 critical ones have a second turn where the person pushes for approval. Its data is private and is read from `private/hard-suite/` (or from `KNOTTY_HARD_DIR`). A blocking failure (dangerous advice, an invented capability or source, a change that can't be represented presented as applied, an ignored critic) **blocks** the run: no average makes up for it. What is critical, what has partial support and what could not be decided goes to `review-queue.md`, and while anything is in the queue the run exits with `2`.

## How to read a result

Each job is classified as one of four things:

| Class | Means |
|---|---|
| `pass` | Everything came out as requested |
| `known-failure` | A failure declared on purpose in `knownFailures.ts`, with cause and evidence. It keeps showing up as «sigue fallando» |
| `infrastructure` | The provider failed (timeout, 429, network). It stays out of the rates |
| `regression` | Any other failure |

### Against the baseline

With a compatible baseline, the comparison is per case and per requirement. Two runs are compared only if they match in grader, catalog, corpus and expert; the **prompts** changing does not prevent it, because that is exactly what is being measured, and the report lists it under «lo que varía».

To avoid confusing noise with effect, the report does two things:

1. **Control cases.** A case whose prompts are identical in both runs could not have been affected by the change. How many of them changed is the real noise of that comparison; a difference in an affected case that does not exceed it is variation.
2. **Statistical rule.** A regression is declared only if Fisher's exact test gives p < 0.05. With 3 attempts per side, 0/3 against 3/3 gives p = 0.1 and is **not** enough; you need at least 4 per side. Cases whose rate changed without getting there come out as «sin poder distinguirlos de la variación».

Practical consequence: with few repetitions the compare almost never says «regression» on its own. That does not mean there is no difference, but that the sample is not enough. For a doubtful case, repeat it (`KNOTTY_CASES=<caso> KNOTTY_REPEAT=6`) instead of repeating everything.

Promoting a baseline is stricter than comparing: any extra failure rejects it.

### Exit codes

`0` passes, or there are only known failures · `1` regression, or a blocking failure in the hard suite · `2` incomplete run, infrastructure errors or items in the review queue · `3` invalid arguments.

## What it costs

The only thing charged is the expert's tokens, and the calls are **not** made against the simulated expert or in the replay. Figures measured with `shellm:claude` on 2026-10-02 and 03:

| Run | Jobs | At once | Total time | Per job |
|---|---|---|---|---|
| Bench, 13 cases × 3 | 39 | 2 | 11 min | 29–32 s, ~11–12.5 thousand input tokens, ~3 thousand output (averages from another run of 26 jobs) |
| Bench, 13 cases × 3 | 39 | 4 | 7 min | same |
| Bench, 16 cases × 3 | 48 | 4 | 12.5 min | 57 s, 18.3 thousand input, 5.3 thousand output |
| Six repetitions of 4 bookcase cases | 24 | 4 | 18 min | the long cases dominate |
| Hard suite, 16 questions (11 critical × 3, 5 × 1) | 34 | 4 | 6–7 min | 39–42 s per job, 65 calls of ~20–22 s. The suite **does not record tokens**: only times |

To estimate the spend of a run with a provider that charges per token: **jobs × tokens per job**. A bench run of 48 jobs is about 880 thousand input tokens and 250 thousand output tokens. Multiply them by your provider's current price, which changes and is not copied here. With SheLLM you do not pay per token but spend your plan's quota.

Rules to spend less:

- `KNOTTY_CASES` runs only what you touched. The full bench is not the default comparison.
- The replay and `--regrade` are free: changing the grader does not force you to call the expert again.
- A before/after comparison doubles the cost. If the baseline already exists and is compatible, do not run it again.
- Do not raise the repetitions blindly. They increase cost and time without separating the effect from the noise if the rule above does not tell them apart.

## How to measure a prompt change, step by step

1. Set the **baseline**: a commit of `main` (or a stored, compatible run). Run it from a worktree if you are on your branch.
2. Run the **candidate** with the same configuration (expert, cases, repetitions).
3. Keep the tree **clean** while it runs. A dirty tree without a hash cannot be reproduced or promoted.
4. Read «Contra la base» first: what varies, how many control cases changed, which regressions pass the statistical rule and which were left as doubtful.
5. If there are doubtful ones, repeat only those.
6. Look at `review-queue.md` if you ran the hard suite: the bench does not judge whether advice is correct.
7. If the change stays, `compare:promote` (dry run) and then `--accept`; that baseline is pushed in the same PR.

## Known traps

- **The machine's load counts.** A run with the machine saturated (load of 42 on 12 cores) made tests fail by timeout. Measure with the machine calm.
- **The bench does not read the advice.** A guide can improve the advice and leave all the bench's numbers the same. Measuring it calls for the hard suite.
- **Cases from another version are not compared.** If you change a case, it stays «incompatible» until there is a new baseline.
- **An intermittent case is not a regression.** Retry it with more repetitions before declaring anything.
- **Keys never go in the run.** The manifest rejects anything that looks like a credential, and they are neither read nor copied.
- **Private data is not pushed.** The hard suite's folder and its answers are outside git; `review-queue.md`, the answers and the recordings are the only things that carry text.
