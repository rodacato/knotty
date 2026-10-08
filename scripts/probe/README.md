# Probe

Checks a reference ficha (`src/adapters/references/*.json`) against what the engine makes of it today, and turns a candidate into the next version of a ficha. It never calls a provider.

What a ficha file is and the whole path from an idea to an adopted ficha: [docs/fichas.md](../../docs/fichas.md).

## Use

```bash
npm run probe -- kc-apa-01                          # one ficha, in detail
npm run probe -- --all                              # every ficha, one line each
npm run probe -- --explain kc-apa-01                # the ficha in words
npm run probe -- --explain kc-apa-01 candidate.json # a candidate, as it would be once adopted
npm run probe -- --diff kc-apa-01 candidate.json    # what a candidate would change
npm run probe -- --update kc-apa-01                 # rewrites its `expect` to what the engine makes
npm run probe -- --adopt kc-apa-01 candidate.json   # makes the candidate the next version
```

Only `--update` and `--adopt` write. `--update` touches the `expect` of one file and nothing else; `--adopt` writes the new version and renames the old file to it, so git shows a rename with the changes.

Exit codes: `0` as expected, `1` a ficha differs from its `expect` or a candidate was not adopted, `2` wrong usage or an error.

## Files

| File | What it does |
|---|---|
| `run.mjs` | Entry of `npm run probe`: loads `probe.ts` through Vite, so the fichas are read the way the app bundles them |
| `probe.ts` | The commands. The logic is in the domain (`src/domain/furniture/probe.ts`, `adopt.ts`, `explain.ts`); this file reads and writes the files |

## What it covers

A ficha is right when the engine still gives what its `expect` says (valid, pieces, findings, sheets, hardware) and its file is written the canonical way. It says nothing about whether the furniture is good carpentry: the checks judge that, and their findings are part of `expect`.

A changed `expect` is a decision, not a fix: `--update` it only when the difference is the one you meant, and let the PR diff show it.
