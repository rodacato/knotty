---
id: bed@4
---
# pick
- A **bed**: a plywood base with or without drawers, and a headboard; or a **daybed**, a bed that is a sofa by day. It goes in `bed`.

# skeleton
## The bed (`bed`)

- `kind`: always "bed".
- `name`: the name for the person ("Cama individual con cajones").
- `mattress`: "individual", "matrimonial", "queen" or "king". The bed's length and width come from the mattress; if the person gave room measures, use them only to choose the mattress.
- `material`: {{materials}}. Usually the 18 mm one.
- `height`: base height in mm, from the floor to where the mattress rests; usually 350–450.
- `drawers`: the drawers in the base.
  - `side`: which side they open on, seen from the foot of the bed: "none", "left", "right" or "both".
  - `count`: how many per side, {{bedDrawerCount}}; usually 2 or 3.
  - `position`: if they do not fill the whole length, where they gather: "head", "center" or "foot".
  - `mount`, `style`, `pulls` ("handle" is bought, one per front), `corners`, `fingers`: only if asked or clearly shown.
- `headboard`: the headboard.
  - `style`: "none" (no headboard), "plain" (a flat board), "bookcase" (a bookcase with open shelves) or "storage" (a closed space at pillow height with open shelves above) or "daybed" (a backrest along the side without drawers and an arm at each end, as high as `height`; drawers on one side at most, and no legs).
  - `height`: total height from the floor in mm; usually 900–1200.
  - `depth`: depth of the bookcase or compartment in mm; usually 200–300. It does not count for a plain headboard.
  - `shelves`: shelves in the bookcase or above the compartment.
  - `cap`: a cap board on top, only if asked or shown.
- `lip`: a lip that keeps the mattress in, only if asked or shown.

Decide at once what the person already said (how many drawers, which side, where, what headboard) and ask only what is missing and changes the furniture a lot.

# plan
- **Bed** (`kind` "bed"): mattress (`mattress`: individual, matrimonial, queen or king; the length and width come from it), base height (`height`), drawers (`drawers`: `side` none/left/right/both seen from the foot, `count` per side {{bedDrawerCount}}, `position` head/center/foot; `mount`, `style`, `pulls`, `corners`, `fingers` only if asked) and headboard (`headboard`: `style` none/plain/bookcase/storage/daybed, `height` from the floor, `depth`, `shelves`, `cap`), and `lip` to keep the mattress in. "storage" is a closed space at pillow height with open shelves above; "daybed" puts a backrest on the side without drawers and an arm at each end. It goes in `bed`.

# changes
mattress, height, drawers, headboard, lip
