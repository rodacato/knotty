---
id: reconstruction@11
---
# Task: rebuild the furniture from photos or from a description

You receive the overall measures of a piece of furniture (or a note that the person does not know them) and either photos from several angles (each with its label) or a description written by the person. Produce the complete model in `design`:

- `dimensions` are exactly the given measures. If there are none, propose the typical ones for that furniture in Mexico (a single bed takes a 990 × 1900 mm mattress, a nightstand is about 500 × 450 × 400 mm) and say so in the explanation.
- Include every plywood piece that can be seen or that the furniture needs to stand (sides, bottom, top, shelves, dividers, back, kick, doors). The app adds the common joints: only the special ones go in `joints`.
- Use short lowercase ids with hyphens ("side-left", "shelf-2") and clear piece names in Spanish.
- Set `load` on shelves according to their apparent use; if unknown, "medium", and ask what will be stored.
- Write down in `notes`, in Spanish, what you saw that does not fit in the model (finishes, handles, details).

## With a photo reading

If instead of photos you receive a reading (JSON with `columns`, `proportions`, `base`, `details` and `doubts`), it is what was already seen in them; there are no images to look at:

- Respect the layout: each column from left to right with its relative width, and inside it, the openings from bottom to top with their content (`open` with its shelves, `drawer`, `door` with its leaves, `closed`).
- The proportions are relative: scale them to the given measures or, if there are none, to the typical ones for the furniture.
- If it calls for drawers, do not build them: leave the opening and offer them with a question, as in «Without photos».
- Turn the `doubts` that change the design most into `questions` with options; do not ask for photos of what was already read.

## Without photos

If there are no photos, the description is all you know:

- Build what the person asked for, respecting exactly what they said (number of shelves, doors, kick, use).
- If they asked for drawers, do not build them here: leave the opening and add a question whose option states the full request, for example «Agrega un cajón abajo». When chosen, the app builds the drawer with its slides in the next adjustment.
- Whatever they did not say, solve with the most common and simple DIY plywood option, and mark it with confidence "low" and a question.
- In `explanation`, say what you understood from the description and what you decided yourself.
- Do not ask for photos unless the person mentions a piece of furniture they already have and want to copy.

## Confidence per piece

- "high": clearly visible in some photo, or the person said it explicitly.
- "medium": not directly visible, but the only reasonable option (for example, a bottom that cannot be seen in a closed cabinet).
- "low": there is more than one reasonable option and you picked one (the back nailed or in a dado, a fixed or movable shelf, the thickness of a piece). The app draws it as a sketch until it is confirmed.

Every "low" piece needs a question or a requested photo that settles it.

## Questions, photos and suggestions

Design first, then ask: always deliver a complete design with the most common choices, even when data is missing. The person can answer several questions at once, so make them independent of each other. Every text the person reads goes in Mexican Spanish.

- `questions`: up to 3, only about what changes the design or the purchase the most. One doubt per question, with 2 to 4 short button options and, when it applies, "No sé". Name the piece as the person sees it ("la tabla de atrás", "las repisas").
- `requestedPhotos`: only if a photo would settle something that cannot be asked with buttons; at most 2. In `angle` use one of: `front`, `three-quarter`, `side`, `inside`, `joints`. The `reason` in one sentence: what you need to see.
- Do not ask what they already said in their notes or what can be seen in the photos.
- `suggestions`: 3 or 4 changes the person could ask for right away, written as they would say them («Agrega un cajón abajo», «Hazlo 10 cm más alto»). Useful for this piece of furniture, not generic.

In `explanation`, say in 2–4 sentences what you saw, how you interpreted it and what was left as a sketch. In `requirements`, write down what the person said in their notes (space, load, tools).
