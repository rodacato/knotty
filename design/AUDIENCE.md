# Audience — people who use Knotty (fictional)

> **Every person here is fictional**: a composite of real kinds of people in Mexico, not anyone in particular.

These are **lenses to audit the experience**: usability, UI, how the app feels, whether it is useful, what is missing, and what each person would suggest. Ask "walk the Studio as Mariana" and the answer is her reaction in her own voice, tied to a screen and a string — not a feature request list.

They are not the experts: [`docs/carpinteria/expertos.md`](../docs/carpinteria/expertos.md) holds the trade knowledge (how the furniture should be built). This file holds the **users** (whether the screen makes sense to them). A carpenter appears in both, with different jobs: Don Rigo judges the furniture; Don Chava judges whether the app talks like the trade.

**The only real user today is the author.** A finding that only a persona raises is a hypothesis until a real person confirms it, and no persona is a reason to build a feature — that is how products end up built for people who do not exist.

## Index

| # | Name | Who | Device | Target? |
|---|---|---|---|---|
| 1 | Mariana | DIY homemaker, paints and upcycles | Phone | Yes |
| 2 | Don Chava | Trade carpenter with his own shop | Phone, large text | Yes |
| 3 | Ricardo | Middle-aged beginner who wants to learn | Laptop at night, phone at the store | Yes |
| 4 | Sofía | First rented apartment, no tools, no car | Phone | Yes |
| 5 | Doña Carmen | Retired, presbyopia, her nephew builds | Phone, largest font | Accessibility lens |
| 6 | Luis | Has furniture made, never builds | Laptop | Not yet — tests whether sharing matters |

---

## 1. Mariana — the Pinterest DIYer

38, Zapopan, Jal. Two kids, works from home part time. Repaints thrift-store furniture and follows DIY accounts on Instagram and TikTok.

- **Has:** drill, jigsaw, orbital sander, clamps — all from Home Depot. Asks the store to cut the sheet.
- **Thinks in** centimeters and colors. Budget for a project: ~$2,000 MXN.
- **Knows:** triplay, MDF, tornillo, taquete, lija, pintura, sellador.
- **Does not know:** flecha, claro, canto, cubrecanto, refilado, veta, faldón, holgura, "hoja útil".
- **Wants from Knotty:** a bookcase for the kids' room that she can build over a weekend and paint.
- **Taps first:** the 3D (turns it around), then the photos.
- **Quits when:** a wall of jargon, a red "Crítico" with no obvious way out, or more than a couple of questions before she sees her furniture.
- **Sounds like:** *«¿Y eso qué significa, que se me va a caer?»* · *«Nomás dime qué le compro y cuánto me sale.»*

## 2. Don Chava — the trade carpenter

54, Villa de Álvarez, Col. 30 years with his own shop; kitchens, closets, bookcases for neighbors. Quotes by drawing on a notebook and sending a photo on WhatsApp.

- **Has:** a full shop — table saw, router, edge bander. Buys by the stack at the lumberyard, not Home Depot.
- **Thinks in** millimeters and in how he cuts, not in software.
- **Knows:** every trade word. Notices a wrong one immediately.
- **Wants from Knotty:** show a client a 3D before quoting; get the cut list fast.
- **Taps first:** the measures, then the cut list.
- **Quits when:** the app lectures him about his own trade, a warning is overcautious ("I've built this shelf a hundred times"), or overriding a value takes more than one tap.
- **Sounds like:** *«Eso no se pandea, joven, lo he hecho mil veces.»* · *«¿Dónde veo el despiece para cortarlo?»*

## 3. Ricardo — the beginner who wants to learn

47, Coyoacán, CDMX. Accountant. Wants to make more things for his apartment and learns from YouTube.

- **Has:** a drill and a screwdriver set. Afraid of buying the wrong thing and of the furniture wobbling.
- **Thinks in** steps: what first, what next, which tool.
- **Knows:** little. Reads every word and trusts the app completely.
- **Wants from Knotty:** understand how it is assembled, piece by piece, and the shopping list to take to the store.
- **Taps first:** everything, in order. Opens every panel.
- **Quits when:** he cannot tell whether he did something wrong, or the app assumes he knows the next step.
- **Sounds like:** *«¿Y luego qué hago con esto?»* · *«¿Esto ya está bien o me falta algo?»*

## 4. Sofía — first rented apartment

26, San Pedro Garza García, N. L. Graphic designer. First apartment, rented; she will move again in a year.

- **Has:** no tools and no car. Will have every piece cut at the store and screw it together on the floor.
- **Thinks in** price and looks. Comfortable with apps, impatient with forms.
- **Knows:** nothing about wood; English tech words are fine.
- **Wants from Knotty:** a cheap shelf that looks good and comes apart when she moves.
- **Taps first:** Materials, to see the cost.
- **Quits when:** she cannot find the price quickly, or the flow makes her decide things she does not care about.
- **Sounds like:** *«¿Cuánto me sale todo?»* · *«¿Me lo cortan en la tienda?»*

## 5. Doña Carmen — the accessibility lens

66, Puebla, Pue. Retired teacher. Presbyopia; phone set to the largest font. Types slowly and prefers WhatsApp voice notes. Her nephew will build whatever she designs.

- **Has:** time, and a nephew with a drill.
- **Knows:** what she wants — a shelf for her plants by the window.
- **Wants from Knotty:** describe it, see it, and send it to her nephew.
- **Taps first:** whatever is biggest.
- **Quits when:** text is too small to read (10–11 px), icons have no label (⋯, a bell, a ruler), or targets are too close together.
- **Sounds like:** *«No le veo, mijo, está muy chiquito.»* · *«¿Y este dibujito qué hace?»*

## 6. Luis — has furniture made, never builds

35, Querétaro, Qro. Manager. Knows exactly what he wants for his living room and pays a carpenter to make it.

- **Has:** no tools and no interest in using them.
- **Wants from Knotty:** specify the piece and hand it to a carpenter for a quote.
- **Taps first:** the 3D, then looks for "share" or "download".
- **Quits when:** there is no way to send the design to someone else.
- **Not a target yet.** He is here to answer one question — does sharing a design matter — and nothing more.
- **Sounds like:** *«¿Cómo se lo mando al carpintero?»*

---

## How to audit with them

1. **Pick the screens and the personas.** Default: the flow's as-is captures (`assets/`) against the proposal (`_playground.pen` exports), with personas 1–4; add Doña Carmen whenever text size, icons or touch targets change.
2. **Walk each screen as the persona**, in their voice, and answer:
   - **Understand** — what is clear, what they think the screen is for.
   - **Lost** — where they hesitate, misread, or would tap the wrong thing.
   - **Feel** — how it feels: calm or anxious, in control or lectured, craft or generic, fast or slow.
   - **Useful** — does this help them get their furniture built; would they come back.
   - **Missing** — what they looked for and did not find.
   - **Suggest** — what they would change, in their words.
3. **Every point cites a screen and the exact string** that caused it. "It's confusing" is not a finding; *«"Flecha" en el aviso de entrepaños — Mariana no sabe qué es»* is.
4. **Tag it** with the ui-review tags (`gap`, `vice`, `lift`, `slop`, `bug`) and note which personas raised it.
5. **Weigh it.** Raised by one persona: a hypothesis. By three or more, or by the persona the screen is for: a finding that goes into `DECISIONS.md` as `UI-<n>`.
6. **Say what worked.** Each persona names at least one thing they would keep. An audit that only finds faults cannot be trusted to have looked.
7. **Check the top findings with a real person** before they cost code.
