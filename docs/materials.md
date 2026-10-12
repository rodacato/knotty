# Materials and the printable guide

Materials keeps the estimated cost visible before a purchase review. Its next action depends on the current design:

- No current review: review the design before showing the shopping list.
- Review running: show the real stage, elapsed time and cancellation control.
- Changes needed: expose pending checks and expert corrections before the export actions.
- Viable review: make the existing printable guide the primary action; copying the lumberyard message is secondary.
- Not viable: the list requires the existing explicit opt-in. Exporting never clears the pending warnings.

## Review lifecycle

Each run captures the current version and `reviewSignature`. Only its own controller can update progress or save a result. Cancellation clears the UI immediately, aborts the transport and ignores late callbacks, failures and results.

The store observes relevant design and catalog changes while a review is running. A changed signature cancels that run and explains why. No automatic retry sends another expert request. Opening another design cancels even when its contents match the previous one.

The signature excludes finishes, wall choice, edge profiles and prices. Those choices can update the purchase while preserving the structural review. Geometry, requirements, accepted findings, sheet dimensions and cutting settings still invalidate it. A draft does not replace the actual design until applied.

Stages are factual: local checks, waiting for the expert, then receiving its response. OpenAI-compatible SSE reports receiving only when text content arrives; JSON responses report it after the body is read. Anthropic reports the first text event. Providers without response callbacks remain in waiting until completion. There is no estimated percentage or completion time.

## Actions and export

Expert corrections state the requested change beside a button that explicitly sends it to Conversation. Viewing a piece in 3D remains a separate action. Successful checks and optional advice are disclosed on demand; unresolved checks remain visible.

The guide opens at `#takeaway`. Its existing print action calls `window.print()`, allowing the browser to print or save as PDF. It includes numbered cuts and diagrams; assembly phases remain available only for modules that already provide them.

The guide and copied message carry stale-review, unresolved-review and unknown-wall notes. They do not certify real material, installation or site conditions. The existing pre-cut notice and lumberyard checklist remain available.

An unknown wall remains a valid answer, with the anchor-selection gap explicit. Cutting settings are advanced lumberyard options: changes recalculate the layout and invalidate the review. Finish choices are summarized and expanded when needed.

## Verification

Run `npm test -- src/ui/store/review.test.ts src/ui/studio/Materials.test.ts src/adapters/llm/compatibleOpenAI.test.ts` for cancellation races, late responses, real stream activity, purchase gates and rendered action hierarchy.

For browser checks, open a catalog base and enter Materials. Review locally without connecting an expert; confirm one primary guide action, one copy action, closed details and no document overflow while expanding the cut list. Open the guide and check its print action. With a controlled delayed provider, cancel, edit a dimension, change a cutting setting and replace the design while reviewing; late responses must not alter the active design.

The clipboard live region needs a positioned containing block. Without it, its absolute static position can escape the Materials scroll panel and enlarge the document.
