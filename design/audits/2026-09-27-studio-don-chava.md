# Studio audit — Don Chava (2026-09-27)

Persona 2 of `design/AUDIENCE.md` (fictional). Phone, large text. Taps the measures first, then the cut list.
Current = `design/assets/studio/` (+ `states/`); proposal = `design/exports/playground/`.
One persona, so every row is a hypothesis until a real carpenter confirms it.

## First impression

«A ver, joven. El mueble se ve bien y las medidas vienen en milímetros, eso sí me gusta: 1600, 400, como yo trabajo.
Pero para cambiarle el ancho me pone a platicar con una máquina y luego me regaña con que se pandea.
Y el despiece, ¿dónde? Me dice que primero me revisa "un carpintero". Pues el carpintero soy yo.»

## Current app

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| mobile-chat.jpg | «940 mm · 94 cm» / «1600 mm · 160 cm» on the 3D | «Las cotas sobre el mueble, en milímetros. Esto se lo enseño al cliente tal cual.» | Useful | keep |
| mobile-chat.jpg | «940 × 1600 × 400 …» | «¿Y los tres puntitos? Se come la medida del encabezado; con letra grande ni la veo.» | Lost | bug |
| mobile-furniture.jpg | «Medidas» Alto 940 / Ancho 1600 / Fondo 400 «mm» | «Aquí sí: tecleo 900 y listo. Esto es lo primero que busco.» | Useful | keep |
| mobile-furniture.jpg | «Sin cambios todavía.» + «Aplicar» / «Descartar» | «Cambio el número y todavía hay que darle Aplicar. Son dos toques para una medida.» | Feel | vice |
| mobile-furniture.jpg | «Lo dice el ejemplo.» | «¿Quién lo dice? No entiendo qué me quiere decir ese renglón.» | Lost | slop |
| mobile-piece.jpg | «Puerta de la columna 3 (hueco 1)» · LARGO 553 · ANCHO 369 · ESPESOR 18 · «Veta a lo largo» | «Esto es un renglón de despiece, bien dicho, con la veta. Así lo anoto en mi libreta.» | Useful | keep |
| mobile-piece.jpg | the card over the 3D | «Me tapa el mueble. Ya no veo cuál puerta es.» | Feel | vice |
| mobile-piece-editing.jpg | «Mover ↑ ↓ de 10 mm» and the LARGO/ANCHO/ESPESOR fields | «Poder corregir a mano la pieza, eso me sirve; pero me tapa hasta el nombre del mueble arriba.» | Useful | lift |
| mobile-piece-editing.jpg | «Lateral izquierdo: clavo y pegamento» | «Trasera de 6 con clavo y pegamento, correcto. Habla como taller.» | Understand | keep |
| mobile-chat-answer.jpg | «Aplicar así, bajo mi riesgo» | «Qué bueno que me deja, pero "bajo mi riesgo" suena a que el joven sabe más que yo.» | Feel | vice |
| mobile-chat-answer.jpg | «Agregar un apoyo al centro, debajo del piso» / «Agregar un divisor vertical al centro» | «Opciones de oficio. Pero falta la mía: un faldón al frente del entrepaño, o subirle a 25. No las veo.» | Missing | gap |
| mobile-notices-pending.jpg | «Entrepaño 1 se pandearía ~9.8 mm … Entrepaño 2 se pandearía ~9.8 mm …» (×5) | «Cinco veces lo mismo. Ya entendí a la primera, joven.» | Feel | slop |
| mobile-notices-fixes.jpg | «Piso se pandearía ~9.8 mm con libros en un claro de 864 mm (lo aceptable es hasta 2.4 mm). Y 4 piezas más igual.» | «Así agrupado sí. Y me da el número, no nomás "cuidado". Aunque ¿2.4 quién lo decidió?» | Understand | lift |
| mobile-notices-fixes.jpg | «AL INSTANTE» + «Un apoyo al centro, debajo de cada una (5 piezas)» + «Aplicar» | «Un toque y queda. Eso me gusta.» | Useful | keep |
| mobile-chat-tray.jpg | «BANDEJA · 1» + «Consultar al experto» over the chat | «¿Bandeja de qué? Me tapa lo que me estaba diciendo el experto.» | Lost | vice |
| mobile-chat-tray.jpg | «Listo, apliqué "Ensanchar a 90 cm" como lo pediste. Los puntos críticos siguen» | «¿Siguen qué? Se corta a media frase.» | Lost | bug |
| mobile-materials.jpg | «Un carpintero revisa tu diseño completo para que no compres algo que no se puede armar.» | «Me está explicando mi oficio. Yo nomás quiero la lista de cortes.» | Feel | vice |
| mobile-materials.jpg | «Revisar y ver materiales» | «¿Para ver el despiece tengo que esperar una revisión? Ahí me voy a mi libreta.» | Missing | gap |
| mobile-materials-verdict.jpg | «Arréglalo antes de comprar» / «(Esto es el modo simulado: conecta un experto real …)» | «¿Modo simulado? ¿Entonces lo de arriba es de a mentiras? Ya no sé si confiar.» | Lost | vice |
| mobile-materials-verdict.jpg | «la parte buena de la hoja (2410 × 1188 mm), ya sin los 15 mm por orilla que se recortan» | «Eso es el refilado, bien hecho que lo cuente. Esto sí lo checaría.» | Useful | keep |
| mobile-materials-list.jpg | «Mide el espesor real de tus hojas … el triplay de 18 mm suele medir un poco menos.» | «Joven, llevo 30 años cortando triplay.» | Feel | vice |
| mobile-materials-list.jpg | «Pide los cortes largos en la tienda y deja los chicos para casa.» | «Tengo sierra de banco. Ese consejo no es para mí.» | Feel | vice |
| mobile-materials-list.jpg | «COSTO APROXIMADO ~$3,165» | «Sirve para ir armando la cotización.» | Useful | keep |
| mobile-history-versions.jpg | «Qué cambió (1) · 9 piezas se ajustaron solas» + «Volver a esta» | «Poder regresar a como estaba, y saber cuántas piezas se movieron. Bien.» | Useful | keep |

## Proposal

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| 1-conversation-default.png | «940 × 1600 × 400 mm · 160 cm» | «Ahora sí se lee la medida completa arriba, sin puntitos.» | Understand | keep |
| 1-conversation-default.png | «Hazlo de 90 cm de ancho» | «Eso es una medida, no una plática. ¿Por qué me lo ofrece como mensaje?» | Suggest | gap |
| 2-piece-selected.png | the door highlighted with the rest transparent | «Ahora sí veo cuál puerta es y dónde van las correderas. Esto se lo enseño al cliente.» | Useful | lift |
| 2-piece-selected.png | «553 mm · 369 mm · 18 mm» + «Veta a lo largo» | «Números grandotes, con letra grande los leo sin lentes.» | Useful | keep |
| 2-piece-selected.png | «Editar a mano» at the bottom, below the empty space | «Para corregir sigue siendo otro toque, y abajo del todo. Déjame tocar el 553 y cambiarlo.» | Suggest | gap |
| 3-conversation-thinking.png | «Pensando el cambio… · 12 s» | «¿Doce segundos para cambiar un ancho? En el campo Ancho era al instante.» | Feel | vice |
| 4-conversation-proposal-pending.png | «Cambio el ancho total a 90 cm. Los laterales se recorren y el piso, el techo y los entrepaños se estiran» | «Me dice qué movió. Así sí le entiendo.» | Understand | lift |
| 4-conversation-proposal-pending.png | «Aplicar con un apoyo al centro» (black) vs «Aplicar así, bajo mi riesgo» (small link) | «Lo mío quedó chiquito y en gris. Me empuja a hacerlo a su modo.» | Feel | vice |
| 4-conversation-proposal-pending.png | «1800 × 570 × 300 mm · 57 cm» over a 3D labelled «900 mm · 90 cm» | «Arriba dice 570 y abajo el mueble dice 900. ¿Cuál es?» | Lost | bug |
| 5-notices-critical.png | «Al instante» / «A la bandeja, para el experto» | «Ya sé qué hace la app sola y qué va con el experto. Eso ayuda.» | Understand | lift |
| 5-notices-critical.png | «Aceptar así, bajo mi riesgo» (grey text, no button) | «Otra vez lo mío casi ni se ve. Con letra grande ni lo encuentro.» | Lost | vice |
| 5-notices-critical.png | only «Un apoyo al centro, debajo de cada una (5 piezas)» | «Una sola salida. ¿Y el faldón? ¿Y el entrepaño de 25?» | Missing | gap |
| 6-conversation-tray.png | «Bandeja · 1» + «Consultar al experto» | «Dice uno, pero no dice qué hay adentro. Antes al menos se leía "que decida el experto".» | Lost | vice |
| 6-conversation-tray.png | «Los puntos críticos siguen» | «Se sigue cortando la frase, igual que antes.» | Lost | bug |
| 7-notices-several-resolve.png | «Con 200 mm de fondo, los libros grandes quedan de fuera; un librero lleva 230–300 mm.» | «Lo hice de 20 a propósito, es para libros de bolsillo. No me des clases.» | Feel | vice |
| 7-notices-several-resolve.png | «Que el experto decida» already checked + «Resolver 2» | «Ya viene palomeado. Si le pico sin fijarme, el experto me cambia el fondo que yo quise.» | Lost | vice |
| 7-notices-several-resolve.png | «1 al instante · 1 al experto» | «Me dice cuánto va a hacer cada quien antes de apretar. Eso sí.» | Useful | keep |
| 8-materials-expert-working.png | «Pensando el cambio… 24 s» + «Revisar y ver materiales» | «El despiece sigue escondido detrás de la revisión. Nada cambió aquí.» | Missing | gap |
| 8-materials-expert-working.png | «Un carpintero revisa tu diseño completo …» | «Mismo sermón que antes.» | Feel | vice |
| 9-materials-expert-answered.png | «Conversación •» and the bell with no number | «¿Ya contestó? ¿Qué decidió? Me deja en Materiales viendo lo mismo; tengo que ir a buscar.» | Lost | gap |

## Current vs proposal

«Me quedo con la nueva, pero no por mucho. Ya no me tapa el mueble, la pieza se ve transparente y leo los números grandes.
Pero en las dos, para ver mi despiece tengo que pasar por la revisión, y en la nueva lo mío ("bajo mi riesgo") quedó más chiquito todavía.
Y la nueva me hace esperar al experto para cambiar un ancho que yo tecleo en un segundo.
Si me dejan cambiar la medida directo y ver el despiece sin sermón, la uso para cotizar.»

## Top 3 findings

1. The cut list sits behind a review, in both versions — mobile-materials.jpg / 8-materials-expert-working.png, «Revisar y ver materiales» under «Un carpintero revisa tu diseño completo…» (gap + vice: it lectures the person the screen is for).
2. The proposal makes overriding smaller: in 4-conversation-proposal-pending.png and 5-notices-critical.png, «Aplicar así, bajo mi riesgo» and «Aceptar así, bajo mi riesgo» are small grey text links. In 7-notices-several-resolve.png, «Que el experto decida» comes pre-checked for a «Recomendación» (vice; Don Chava quits when overriding takes more than one clear tap).
3. There is only one fix for sag, with no trade alternatives — mobile-notices-fixes.jpg / 5-notices-critical.png, «Un apoyo al centro, debajo de cada una (5 piezas)», and no front apron (faldón) or thicker shelf offered. The proposal also has a header/3D mismatch: in 4-conversation-proposal-pending.png the header says «1800 × 570 × 300 mm» while the 3D is labelled «900 mm» (gap + bug).
