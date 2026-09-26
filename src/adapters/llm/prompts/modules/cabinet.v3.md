---
id: cabinet@3
---
# pick
- A **cabinet**: a plywood box (two sides, bottom, top and back) divided into columns and openings. Bookcase, nightstand, chest of drawers, dresser, sideboard, wall cabinet, TV stand, kitchen cabinet or simple closet. It goes in `cabinet`.

# skeleton
## The plan (`cabinet`)

- `name`: the name for the person, in Spanish ("Librero", "Buró con cajón").
- `dimensions`: outside width, height and depth in mm. Use the given measures exactly; if there are none, the typical ones for that furniture in Mexico, and say so in the explanation.
- `material`: {{materials}}. Usually the 18 mm one.
- `base`: "kick" if it has a kick plate at the front (bookcases, dressers, floor cabinets), "floor" if it sits directly or hangs (wall cabinets, low nightstands), "legs" if the box stands on legs (sideboards, credenzas, TV stands or nightstands on legs). With "legs" the app builds straight plywood legs under a frame and adds legs in between on a wide piece; the height in `dimensions` includes the legs. Tapered or splayed legs are built straight: say so in the explanation.
- `wallMounted`: true if it hangs from or is anchored to the wall: wall cabinets; anything with drawers or doors from {{storageAnchorHeight}} high, whatever its depth; and open bookcases that are tall (over about {{tallFurnitureHeight}}) or shallow for their height. A tall bookcase that is not anchored can tip over: anchor it unless the person says otherwise.
- `construction`: how a carpenter would build it. Respect what the person asks for or what the photos show; if they say nothing, use the simplest ({{defaultConstruction}}) and say so in the explanation:
  - `doors`: "overlay" if the door covers the front of the furniture (easiest to adjust); "inset" if it sits inside the opening (looks finer and needs more precision).
  - `drawerFronts`: "inset" (front inside the opening) or "overlay" (front covering the edge).
  - `top`: "between" (top between the sides) or "over" (top over the sides, as in nightstands and side tables).
  - `back`: "nailed" (nailed back, the usual) or "none" (no back, only if the person asks).
  - `shelves`: "movable" (on pins) or "fixed" (screwed, firmer).
- `columns`: left to right, with their width as a fraction of the total. Each column lists its openings from bottom to top, with their height as a fraction and their content:
  - "open": an open opening; in `shelves`, how many movable shelves are inside.
  - "drawer": one drawer per opening; the opening must be at least {{minDrawerOpening}} mm high.
  - "door": an overlay door; in `doors`, 1 or 2 leaves (2 if the opening is wider than {{maxDoorLeafWidth}} mm); in `shelves`, the shelves behind it.
  - "closed": covered, not opening.
  Between openings the app adds fixed shelves, and between columns, dividers.

Build exactly the doors, drawers and open openings the person asked for: count them in the request and again in your plan before answering. Every "door" opening gets its own leaves, so two door openings of 2 leaves are four doors. A shelf in the middle behind the doors is one "door" opening with `shelves` 1 (and `construction.shelves` "fixed" if it must be firm), not two openings.

Shelves for books: one every 250–350 mm. If there are photo readings, respect their columns and openings, and their base: "kick", "legs" or "floor" as read; "wheels" is not built, use "floor" and say so.

# plan
- **Cabinet** (no `kind`): measures, plywood, base (`base`: "kick", "floor" or "legs"; with legs the height includes them), anchoring, how it is built (`construction`) and a grid of columns (left to right, width as a fraction) with openings (bottom to top, height as a fraction) that can be "open" (with `shelves` shelves), "drawer", "door" (with `doors` leaves and `shelves` behind) or "closed". It goes in `cabinet`.

# changes
measures, number or kind of openings, drawers, doors, shelves, columns, construction, base (kick, legs or directly on the floor), anchoring

# rules
- "overlay" doors cover the front; "inset" ones sit inside the opening. Drawer fronts "inset" or "overlay". Top "between" the sides or "over" them. Back "nailed" or "none". Shelves "movable" or "fixed".
- One drawer per opening, at least {{minDrawerOpening}} mm high. Doors wider than {{maxDoorLeafWidth}} mm, with 2 leaves.
