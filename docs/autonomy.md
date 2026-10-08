# Autonomy

How much of what a person asks in the chat Knotty understands alone, without the expert. `npm run autonomy` runs a corpus of requests through the interpreter (`parseIntent`, in `src/domain/furniture/intent/`) and says which ones it read. Without `--ask` it calls nobody and costs no tokens.

## What it says of each request

| Outcome | What happened | What it is |
|---|---|---|
| `read` | It read the field and the value the request meant | What Knotty already does alone |
| `unread` | It read nothing, and it could have solved it | What is left to do: today that request goes to the expert |
| `misread` | It read something else | A mistake: it would apply a change nobody asked for. The command exits `1` and `npm test` fails |
| `left` | It was the expert's and it left it | The right thing for a request that is vague, open, or beyond what the plan can say |

A request with two changes counts in the `several` row: reading only one is `misread`, because the other is lost.

## The corpus

It lives in `scripts/autonomy/corpus/`, one file per module. Each request is said about a bench variant of the module (`on`) and carries what it means: `set(field, value)`, `both(...)` for two changes, `asks(topic)` for a question the design's own numbers answer, or `'expert'`.

It is written from what the person meant, not from what the interpreter reads today. A request it does not understand yet goes in the corpus all the same: taking it out so the number goes up is fooling yourself. A phrase is not changed to make it pass either.

## How to use it

1. Run `npm run autonomy` (or `npm run autonomy -- table`) and look at the `unread` list.
2. Pick a group of requests that look alike and teach the interpreter to read them, with their case in `intent.test.ts`.
3. Run it again: the number goes up and `misread` stays at zero.

If a new rule reads too much, the corpus says so: an `'expert'` request that stops being `left` is `misread`. That is why the expert's requests matter as much as the others.

## Asking the expert about what is left

`KNOTTY_MODELS=<provider:model> npm run autonomy -- --ask [module]` sends each `unread` request to the expert and says whether the plan it left is the one the request means (`as meant`), another one (`otherwise`, with the differences) or none (`no change`). Without `KNOTTY_MODELS` on the line it takes the one in `.env`, as the compare does. It is one call per request and costs tokens: by hand only.

The `as meant` ones are the candidates for a rule: the expert solved them with a change the form already knows how to make. It does not ask about questions, about the expert's own requests, or about changes the form does not set by their key.

## What it does not measure

- The expert in general: `--ask` only looks at whether it solved a request as meant. Grading it is [the compare](compare.md).
- That the change it read leaves a valid piece of furniture: the builder and the checks judge that when the request is applied.
- How people really talk. The corpus is small and written by hand; the number says how much of these phrases it covers, not a share of real use.
