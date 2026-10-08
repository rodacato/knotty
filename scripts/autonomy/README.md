# Autonomy

Measures how much of what a person asks in the chat Knotty reads alone, without the expert. It runs a corpus of requests through the interpreter (`parseIntent`, in `src/domain/furniture/intent/`) and lists which ones it read.

The guide, with what each outcome means and how to work from the list: [docs/autonomy.md](../../docs/autonomy.md).

## Use

```bash
npm run autonomy                 # every module that has a corpus
npm run autonomy -- table        # one module
KNOTTY_MODELS=<provider:model> npm run autonomy -- --ask table   # puts the unread requests to the expert
```

Without `--ask` it calls nobody and costs nothing. With `--ask` it is one call per unread request: by hand only.

Exit codes: `0` nothing misread, `1` at least one request read as something else, `2` a module with no corpus.

## Files

| File | What it does |
|---|---|
| `run.mjs` | Entry of `npm run autonomy`: loads `autonomy.ts` through Vite, so it reads the same files the app does |
| `autonomy.ts` | Classifies each request (`read`, `unread`, `misread`, `left`) and prints the report per module |
| `ask.ts` | `--ask`: sends each unread request to the expert and compares the plan it left with the one meant |
| `corpus.ts` | The shape of a corpus and its helpers: `set`, `both`, `asks`, `'expert'` |
| `corpus/<module>.ts` | The requests of one module, each said about one of its bench variants |

## Adding to it

- A phrase: add it to `corpus/<module>.ts` with what it means, written from what the person meant and not from what the interpreter reads today.
- A module: add `corpus/<module>.ts` and register it in `CORPUS`, in `autonomy.ts`.

## What guards it

`autonomy.test.ts` runs in `npm test` and fails on any `misread` request in the corpus, so a rule that reads too much is caught without running the command. `ask.test.ts` checks the comparison with an expert that gives a fixed answer; it never calls a provider.

`ask.ts` finds the expert through `scripts/compare/shared/live.ts`, the same way the compare does.
