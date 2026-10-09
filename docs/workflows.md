# Workflows

What to do, in what order, and where each thing goes, by what you want to achieve. Each workflow points to the guide that has the detail; here there is only the route.

## Two modes

| Mode | Command | When |
|---|---|---|
| Without the expert | `npm test` | Always. It checks the engine, what the chat understands alone and how Knotty reacts to an answer of the expert |
| With the expert | `npm run compare` | By hand, when what the expert sees changes. It costs tokens ([guide](compare.md)) |

`npm run probe` and `npm run autonomy` are not another mode: they are tools to work on a ficha or on the interpreter, and what they guard already runs in `npm test`.

## 1. A request the chat understands without the expert

1. Add the phrases to `scripts/autonomy/corpus/<module>.ts`, with what they mean and about a bench variant.
2. `npm run autonomy` lists them as `unread`.
3. Teach them to the interpreter (`src/domain/furniture/intent/`), with their case in `intent.test.ts`.
4. `npm run autonomy` again: they move to `read` and nothing is `misread`.

It only works for what the plan can already say. If the request needs a field that does not exist, workflow 3 comes first. Detail: [autonomy](autonomy.md).

## 2. Using the expert to know what to teach the chat

1. `KNOTTY_MODELS=<provider:model> npm run autonomy -- --ask <module>` sends the expert each `unread` request of the corpus, about its variant, and compares the plan it leaves with the one the request means. It is one call per request and costs tokens: by hand only.
2. The ones that come out `as meant` it solved with a change the form already knows how to make: those are the ones the interpreter can learn, with workflow 1.
3. The `otherwise` ones say where the expert went another way. If it changed something nobody asked for, it is a case for `reactions.test-util.ts`; if the phrase in the corpus meant something else, the phrase is corrected.


## 3. A new action, material or cut

First the engine builds it; then the chat learns to ask for it.

| What | Where | Detail |
|---|---|---|
| An option the plan could not say, or a cut | The module's schema and builder (`src/domain/furniture/modules/`), its variants and its tests | [Fichas, section 2](fichas.md#2-when-knotty-cannot-build-it-add-support) |
| A material | The catalog (`public/catalog/catalog.json`) | Bench without the expert and the Materiales tab |
| How it is asked for in the chat | Workflow 1 | |

To choose what comes next, count in how many fichas the feature appears in `gaps`: what gets built is what changes the purchase or the safety, or what repeats.

## 4. A new piece of furniture and whether it is viable

1. Write the candidate: the `plan`, or the `design` piece by piece if no module builds it.
2. `npm run probe -- --diff <code> candidate.json`: it says whether the engine builds it, with how many pieces and which findings; a critical one is marked. It writes nothing.
3. `npm run probe -- --adopt <code> candidate.json` saves it with its `expect`; from then on `npm test` watches it.
4. If it opens a new module or use: its variants in the module and its phrases in the corpus (workflow 1).

Viable means the engine builds it and the checks find nothing critical. It does not prove the real piece of furniture holds. Detail: [Fichas, section 1](fichas.md#1-from-an-idea-or-some-photos-to-a-ficha).

## 5. The expert drafts or improves a ficha

What the expert writes is a draft: `--diff` decides whether it is a ficha, and then a person.

**Drafting one from photos or a description.** With the debug access, design the piece of furniture in the Studio like any other (photos, measures, description) and refine it in the chat; «Exportar ficha» downloads the candidate file. Continue at step 2 of workflow 4.

**Improving one when Knotty gains support.** The fichas that were adapted because of that feature have it in `gaps` (`grep -l '"<tag>"' src/adapters/references/*.json`). Open each one from the spotlight (`Ctrl+K`) with the debug access on, ask for the change with the new option, export and check with `--diff`; when adopting it, remove the tag from `gaps` and the adaptation.

Only what fits in a plan is exported. If the expert solved something piece by piece, the file does not come out and it says so: that feature is a gap (workflow 3), not a ficha.

## Where a new case goes

A case goes in the cheapest place that can fail for what you want to guard.

| You want to guard that… | The case is… | It goes in | What runs it |
|---|---|---|---|
| A plan gives the expected piece of furniture | A ficha, or a variant of the module | `src/adapters/references/`; the module's `benchVariants` | `npm test`; `npm run probe` to work on it |
| A chat request is read without the expert | A phrase and what it means | `scripts/autonomy/corpus/`; once taught, also `intent.test.ts` | `npm test`; `npm run autonomy` for the list |
| Knotty reacts well to an answer of the expert, good or bad | A request, a fixed answer and what may change | `src/application/useCases/reactions.test-util.ts` | `npm test` |
| The real expert does what was asked | A request and what must come out | `src/application/bench/cases.ts` | `npm run compare` |
| A piece of advice is correct and safe | A hard question with its review | The private folder | `npm run compare:hard` |

Phrases and fixed answers are said about a bench variant, not about a piece of furniture invented apart.
