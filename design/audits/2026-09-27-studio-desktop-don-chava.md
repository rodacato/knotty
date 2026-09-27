# Studio desktop audit — Don Chava (2026-09-27)

Persona 2 of `design/AUDIENCE.md` (fictional), now at the shop's computer. Taps the measures first, then the cut list.
Current = `design/assets/studio/` (+ `states/`); proposal = `design/exports/playground/d*.jpg`. Only desktop differences; the mobile audit (`2026-09-27-studio-don-chava.md`) is not repeated.
One persona, so every row is a hypothesis until a real carpenter confirms it.

## First impression

«En la compu sí cabe todo: el mueble grande a la izquierda y las medidas a la derecha, como mi mesa de trabajo.
En la nueva por fin toco el 553 y lo cambio, sin tarjeta encima del mueble.
Pero en la nueva los avisos ya no me dejan decir "así lo quiero", y los cortes por hoja que sí traía la de ahorita no los veo.»

## Current app

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| desktop-furniture.jpg | «Base» Con zoclo / Directa / Con patas · «Trasera» Clavada / Sin trasera | «Todo el armado de un vistazo, con palabras de taller. Esto sí lo uso para cotizar.» | Useful | keep |
| desktop-piece.jpg | the «Puerta de la columna 3 (hueco 1)» card over the 3D | «Tengo media pantalla vacía a la derecha y la tarjeta se me pone encima de los cajones.» | Feel | vice |
| desktop-piece-editing.jpg | «LARGO 1800 · ANCHO 900 · ESPESOR 6» tiles, then the same «1800» «900» «6 mm» fields below | «Dos veces el mismo número. ¿Cuál es el que cambio?» | Lost | slop |
| desktop-piece-editing.jpg | «BANDEJA · 1» + «Consultar al experto» over «Los puntos críticos siguen marcados en la revisión» | «Aun en pantalla grande la bandeja le tapa el renglón al experto.» | Lost | vice |
| desktop-chat-answer.jpg | «1800 × 570 × 300 mm · 57 cm de ancho» in the header vs «900 mm · 90 cm» on the 3D | «Arriba 570, abajo 900. Si se lo enseño así al cliente, me pregunta cuál es.» | Lost | bug |
| desktop-chat-answer.jpg | «Aplicar así, bajo mi riesgo» as grey text next to the «Ver el actual» button | «Lo mío ni parece botón.» | Lost | vice |
| desktop-chat-answer.jpg | «Agregar un apoyo al centro, debajo del piso» / «Agregar un divisor vertical al centro» | «Dos salidas de oficio. Al menos escojo.» | Useful | keep |
| desktop-notices-several.jpg | «Aceptar así, bajo mi riesgo» under each notice | «Chiquito y subrayado, pero está. Con eso le digo que el fondo de 20 lo quise yo.» | Useful | keep |
| desktop-materials-list.jpg | «Las cantidades son para comprar, no un plano de corte.» | «Y luego abajo me pinta las hojas con cada pieza acomodada. ¿Es plano de corte o no es?» | Lost | vice |
| desktop-materials-sheets.jpg | «Hoja 2 de 2 · desperdicio 66 %» with «Entrepaño 1 864 × 294» … | «Esto es lo que buscaba: qué sale de cada hoja, con medida. Con esto corto.» | Useful | keep |
| desktop-materials-sheets.jpg | «desperdicio 56 %» on the 18 mm row vs «45 %» and «66 %» per sheet | «Tanto desperdicio en dos hojas, ¿no cabe en una y media? Dime por qué.» | Missing | gap |

## Proposal

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| d1-conversation-default.jpg | «Cotas» on the toolbar button | «Antes era un lapicito; ahora dice cotas. Así se llama.» | Understand | keep |
| d2-piece-editing.jpg | «Largo 553 mm · Ancho 369 mm · Espesor 18 mm» as fields in the side panel | «Esto pedí: toco el 553 y lo cambio, y el mueble sigue completo a la vista.» | Useful | lift |
| d2-piece-editing.jpg | no «Aplicar», no «Al instante» under the fields | «¿Ya quedó al teclearlo o falta darle algo? No me dice.» | Lost | gap |
| d2-piece-editing.jpg | only «Divisor 2: bisagras de cazoleta» below | «La de ahorita me decía cómo se une cada pieza, "clavo y pegamento". ¿Aquí dónde veo eso?» | Missing | gap |
| d3-proposal-pending.jpg | «Aplicar así, bajo mi riesgo» as a full-width button | «Ahora sí es botón, del mismo tamaño. Así me gusta.» | Useful | lift |
| d3-proposal-pending.jpg | only «Aplicar con un apoyo al centro»; the «divisor vertical» option is gone | «Antes tenía dos salidas, ahora una. Y la mía, el faldón, sigue sin salir.» | Missing | gap |
| d3-proposal-pending.jpg | «1800 × 570 × 300 mm · 57 cm de ancho» vs «900 mm · 90 cm» | «El mismo error que la de ahorita: arriba y abajo no cuadran.» | Lost | bug |
| d4-notices-several.jpg | both notices pre-checked + «Resolver 2»; no «Aceptar así, bajo mi riesgo» | «¿Y dónde digo que el fondo de 20 lo quise yo? Si le pico, el experto me lo cambia.» | Lost | vice |
| d4-notices-several.jpg | «1 al instante · 1 al experto» | «Me dice quién hace qué antes de apretar. Eso sí.» | Useful | keep |
| d5-materials-cost-expert-working.jpg | «~$3,165» and the sheets listed while «Pensando el cambio… 24 s» | «El costo sin esperar a nadie. Con esto ya voy armando la cotización.» | Useful | lift |
| d5-materials-cost-expert-working.jpg | «Triplay de pino 18 mm … desperdicio 56 %» with the «%» alone on the next line | «Se le cae el porcentaje al otro renglón.» | Feel | bug |
| d5-materials-cost-expert-working.jpg | no «Hoja 1 de 2» layouts, no piece list | «¿Y el despiece? La de ahorita me lo dibujaba por hoja; aquí nomás cuántas hojas.» | Missing | gap |
| d5-materials-cost-expert-working.jpg | «(Esto es el modo simulado: conecta un experto real para una revisión con criterio.)» | «¿Entonces lo de "Arréglalo antes de comprar" no es con criterio? Ya no sé si hacerle caso.» | Lost | vice |

## Current vs proposal

«La nueva en la compu es mejor para trabajar la pieza: los números editables al lado y el mueble libre.
Y el costo sin esperar, y "bajo mi riesgo" como botón en la propuesta.
Pero en los avisos la nueva me quitó cómo decir que no, y me quitó una salida de oficio (el divisor).
Y el dibujo de cortes por hoja, lo mejor de la de ahorita, no aparece. Sin eso me regreso a mi libreta.»

## Top 3 findings

1. The proposal drops the override in bulk resolve — d4-notices-several.jpg: both notices come pre-checked with «Resolver 2» and the «Aceptar así, bajo mi riesgo» that desktop-notices-several.jpg has under each notice is gone (vice; the d3 fix did not reach d4).
2. The cut layout per sheet is missing from the proposal — desktop-materials-sheets.jpg shows «Hoja 2 de 2» with «Entrepaño 1 864 × 294»; d5-materials-cost-expert-working.jpg lists only «Triplay de pino 18 mm … desperdicio 56 %». The current app also contradicts its own diagram with «Las cantidades son para comprar, no un plano de corte.» (gap + vice).
3. Piece editing in the side panel is the right move, but it does not say when it applies — d2-piece-editing.jpg shows «Largo 553 mm» with no «Aplicar» and no «Al instante», and the joinery lines («Lateral izquierdo: clavo y pegamento» in desktop-piece-editing.jpg) are gone (lift + gap). The header/3D mismatch «1800 × 570 × 300 mm» vs «900 mm» persists in both versions (bug).
