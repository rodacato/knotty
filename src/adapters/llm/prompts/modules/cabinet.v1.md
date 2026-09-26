---
id: cabinet@1
---
## plan
- **Cabinet** (no `kind`): measures, plywood, base (`base`: "kick", "floor" or "legs"; with legs the height includes them), anchoring, how it is built (`construction`) and a grid of columns (left to right, width as a fraction) with openings (bottom to top, height as a fraction) that can be "open" (with `shelves` shelves), "drawer", "door" (with `doors` leaves and `shelves` behind) or "closed". It goes in `cabinet`.

## changes
measures, number or kind of openings, drawers, doors, shelves, columns, construction, base (kick, legs or directly on the floor), anchoring

## rules
- "overlay" doors cover the front; "inset" ones sit inside the opening. Drawer fronts "inset" or "overlay". Top "between" the sides or "over" them. Back "nailed" or "none". Shelves "movable" or "fixed".
- One drawer per opening, at least {{minDrawerOpening}} mm high. Doors wider than {{maxDoorLeafWidth}} mm, with 2 leaves.
