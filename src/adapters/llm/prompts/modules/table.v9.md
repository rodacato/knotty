---
id: table@9
---
# pick
- A **table or desk**, or a **workbench or standing desk**: a top on two plywood sides, with aprons. It goes in `table`.

# skeleton
## The table or desk (`table`)

- `kind`: always "table".
- `use`: "dining", "coffee", "side" (side table or nightstand), "desk" (to sit at) or "standing" (a workbench or a standing desk, 850–1100 mm high).
- `name`: the name for the person ("Escritorio con cajonera", "Mesa de centro").
- `material`: {{materials}}. Usually the 18 mm one.
- `dimensions`: length (`width`), height and depth in mm. Use the given measures; if there are none, the typical ones: {{typicalTableSizes}}. If the person gave the space they have instead, the piece must fit inside it with a little slack: take typical measures within that space and say which ones you chose.
- `overhang`: how far the top sticks out past the sides; 0 if the sides reach the edge (the usual for desks and coffee tables), 30–80 for dining tables.
- `shelf`: a low shelf between the sides, on coffee and side tables and workbenches. A desk does not have one.
- `pedestal`: desks only, a drawer unit on one side: `side` "none", "left" or "right" (seen from the front) and `drawers` {{pedestalDrawerCount}}; without one, "none" and 0.
- `legs`: "panel" (two plywood ends, the usual) or "legs" (four legs with an apron all round) when the person asks for legs.
- `legStyle`: with "legs", "straight" (the usual), "tapered" (each leg narrows toward the floor) or "splayed" (it also leans outward; it needs an `overhang` of 20 or more) when the person asks for it or the photos show it.
- `corners`: "square", or "rounded" when asked for or seen in the photos; it needs an `overhang` of 15 or more.
- `assembly`: "glued", unless the table is over 1800 mm long or the person wants it to come apart: then "bolts", or "cams" (minifix) if asked.

The app adds the aprons and the rails under the top, and keeps the leg space clear.

# plan
- **Table or desk** (`kind` "table"): use (`use`: dining, coffee, side, desk or standing), measures (`dimensions`: length, height and depth), how far the top overhangs (`overhang`) and its corners (`corners`: square or rounded), low shelf (`shelf`, not on a desk), pedestal (`pedestal`: `side` none/left/right seen from the front, `drawers` {{pedestalDrawerCount}}; desks only), what it stands on (`legs`: panel ends or four legs; `legStyle`: straight or tapered legs), its plywood (`material`) and how it is put together (`assembly`: glued, bolts or cams). It goes in `table`.

# changes
use, measures, top, shelf, pedestal, legs, plywood, assembly
