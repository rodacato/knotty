# Studio audit — Ricardo (2026-09-27)

Persona 3 of `design/AUDIENCE.md`: 47, accountant, beginner, reads every word, opens every panel, quits when he cannot tell whether he did something wrong. Mobile only. Current = `design/assets/studio/` (+ `states/`); proposal = `design/exports/playground/`. One persona: every row is a hypothesis until a real person confirms it.

## First impression

«El mueble se ve precioso y me encanta que me diga las medidas en mm y en cm, así no me equivoco. Pero yo vine a aprender cómo se arma, y lo primero que leo es "puertas embutidas", "nichos", "claro de 864 mm"… y cuando le pido 90 cm me sale un "CRÍTICO" en rojo. ¿Lo rompí yo? En la propuesta por lo menos me dice qué botón picarle, pero luego me habla de una "bandeja" y nunca supe qué había adentro.»

## Current app

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| mobile-chat | «tres puertas embutidas […] tres nichos abiertos» | «¿Embutidas? ¿Nichos? Lo leo todo y no sé qué es cada pieza.» | Lost | gap |
| mobile-chat | «Hazlo de 90 cm de ancho» | «Qué bueno que me den ejemplos de qué pedir, yo no sabría ni cómo empezar.» | Useful | keep |
| mobile-chat | «Armado» | «Esto es justo lo que busco: ver cómo se arma. Lo primero que pico.» | Understand | keep |
| mobile-piece | «Divisor 2: bisagras de cazoleta» / «Veta a lo largo» | «Me dice con qué se une, eso sirve… pero ¿qué es cazoleta? ¿Y la veta importa para mí?» | Missing | gap |
| mobile-piece | «Editar a mano» | «¿Si lo toco lo descompongo? No me atrevo.» | Feel | gap |
| mobile-furniture | «Lo dice el ejemplo.» | «¿Quién lo dice? ¿Lo puedo cambiar o no?» | Lost | slop |
| mobile-furniture | «Sin cambios todavía.» + «Aplicar» apagado | «Claro: no he hecho nada, no hay nada que aplicar. Tranquilo.» | Understand | keep |
| mobile-materials | «Que las medidas cierren» … «Que se pueda cortar y armar» | «Me gusta saber qué va a revisar antes de comprar. Me da confianza.» | Feel | keep |
| mobile-materials | «con tu experto conectado, hasta un par de minutos» | «¿Mi experto? ¿Yo tengo uno? ¿Me falta conectar algo?» | Lost | gap |
| mobile-notices-pending | «Entrepaño 1 se pandearía ~9.8 mm […] Entrepaño 2 se pandearía ~9.8 mm […]» (×5) | «Cinco veces lo mismo. Me asusté y no sé qué hacer. ¿Qué es un "claro"?» | Feel | vice |
| mobile-chat-answer | «¿Cómo lo resolvemos?» · «Agregar un apoyo al centro, debajo del piso» · «Agregar un divisor vertical al centro» | «Me da opciones, bien, pero ¿cuál es la buena para alguien como yo?» | Missing | gap |
| mobile-chat-answer | «Aplicar así, bajo mi riesgo» | «Ni loco. Suena a que se me cae encima.» | Feel | keep |
| mobile-notices-fixes | «AL INSTANTE» · «Un apoyo al centro, debajo de cada una (5 piezas)» · «Ver» · «Aplicar» | «Ah, esto sí: me dice qué hacer y puedo verlo antes. Esto lo entiendo.» | Useful | lift |
| mobile-chat-tray | «Listo, apliqué "Ensanchar a 90 cm" como lo pediste. Los puntos críticos siguen» | «¿Lo aplicó aunque estaba mal? ¿Entonces ya está bien o me falta algo?» | Lost | gap |
| mobile-chat-tray | «BANDEJA · 1» · «Entrepaños que se pandean: que decida el experto» | «No sé qué es la bandeja, pero por lo menos leo qué tiene adentro.» | Understand | keep |
| mobile-piece-editing | «Lateral izquierdo: clavo y pegamento» … «Techo: clavo y pegamento» | «¡Esto! La trasera va con clavo y pegamento a cuatro piezas. Así sí aprendo a armar.» | Useful | keep |
| mobile-piece-editing | «Mover» ↑ ↓ «de 10 mm» | «¿Mover qué, hacia dónde? Y la ventana me tapó todo el librero.» | Lost | vice |
| mobile-materials-verdict | «(Esto es el modo simulado: conecta un experto real para una revisión con criterio.)» | «¿Entonces esta revisión no vale? ¿Hice algo mal al no conectarlo?» | Feel | gap |
| mobile-materials-verdict | «ya sin los 15 mm por orilla que se recortan» | «No sabía que la hoja se recorta. Aprendí algo.» | Useful | keep |
| mobile-materials-list | «Para el taller» · «Pide los cortes largos en la tienda y deja los chicos para casa.» | «Este consejo lo apunto. Es lo que un maestro me diría.» | Useful | keep |
| mobile-history-versions | «9 piezas se ajustaron solas» · «Volver a esta» | «¿Solas? Me inquieta… pero saber que puedo regresar a la v1 me calma.» | Feel | keep |

## Proposal

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| 1-conversation-default | «940 × 1600 × 400 mm · 160 cm» | «¿Los 160 cm son el ancho? Tuve que adivinarlo.» | Lost | gap |
| 1-conversation-default | icons ⛶, regla, «⋯» with no label (no «Armado») | «¿Dónde quedó "Armado"? Era lo que yo quería picar. Los dibujitos no me dicen nada.» | Missing | vice |
| 1-conversation-default | «Experto v1» | «Ah, esto lo dijo el experto, versión 1. Bien marcado.» | Understand | keep |
| 2-piece-selected | the door highlighted inside the transparent furniture | «¡Ahora sí veo dónde va esa puerta dentro del mueble! Esto me enseña.» | Useful | lift |
| 2-piece-selected | «Divisor 2: bisagras de cazoleta» | «Sigue sin decirme qué es cazoleta ni qué pieza sigue.» | Missing | gap |
| 3-conversation-thinking | «Pensando el cambio… · 12 s» | «Sé que está trabajando y cuánto lleva. No me desespero.» | Feel | keep |
| 3-conversation-thinking | botón cuadrado sin texto | «¿Ese cuadrito es para parar? ¿Si lo pico pierdo todo?» | Lost | gap |
| 4-conversation-proposal-pending | «Los laterales se recorren y el piso, el techo y los entrepaños se estiran» | «Me explica qué piezas cambian. Así sí entiendo el mueble.» | Useful | lift |
| 4-conversation-proposal-pending | «Aplicar con un apoyo al centro» (botón principal) | «Por fin me dice cuál es la buena. Le pico a esa sin miedo.» | Useful | lift |
| 4-conversation-proposal-pending | header «1800 × 570 × 300 mm · 57 cm» vs 3D «900 mm · 90 cm» | «Arriba dice 57 y abajo 90. ¿Cuál es el mío?» | Lost | gap |
| 5-notices-critical | «Al instante» vs «A la bandeja, para el experto» | «¿Cuál es la diferencia? ¿La bandeja es más segura o más lenta? ¿Cuesta?» | Lost | gap |
| 5-notices-critical | «Aceptar así, bajo mi riesgo» en gris chiquito | «Bien que esté escondido; no quiero picarlo por error.» | Feel | keep |
| 6-conversation-tray | «Bandeja · 1» (sin decir qué contiene) | «En la versión de antes leía qué había en la bandeja. Aquí solo un 1. ¿Un qué?» | Missing | vice |
| 6-conversation-tray | «Los puntos críticos siguen» | «Otra vez: ¿lo dejé mal? Nadie me dice que ya está en manos del experto.» | Feel | gap |
| 7-notices-several-resolve | «Con 200 mm de fondo, los libros grandes quedan de fuera; un librero lleva 230–300 mm.» | «Eso no lo sabía. Me enseña sin regañarme.» | Useful | keep |
| 7-notices-several-resolve | «1 al instante · 1 al experto» · «Resolver 2» | «Claro qué va a pasar con cada uno. Uno ahorita, uno lo ve el experto.» | Understand | lift |
| 8-materials-expert-working | «Antes de comprar, una revisión» sin la lista de qué revisa | «Antes me decía qué iba a checar. Ahora solo "una revisión". Me quedo con menos confianza.» | Missing | vice |
| 8-materials-expert-working | «Pensando el cambio… 24 s» + «Revisar y ver materiales» a la vez | «¿Espero a que termine o le pico a Revisar? No sé si choca una cosa con otra.» | Lost | gap |
| 9-materials-expert-answered | «Conversación ●» y la campana ya sin número | «¿Ese puntito es que el experto ya contestó? ¿Ya quedó el librero? Nadie me lo dice.» | Lost | gap |

Not judged: the proposal exports have no materials list, no piece editing and no history, so «Para el taller», the joints list and «Volver a esta» have no counterpart to compare.

## Current vs proposal

«Me quedo con la propuesta para decidir: "Aplicar con un apoyo al centro" y "Resolver 2" me dicen qué hacer, y ver la puerta resaltada dentro del mueble me enseña más que cualquier texto. Pero para aprender, la actual me da más: la lista de lo que revisa antes de comprar, qué hay en la bandeja y "Armado" con su nombre. Si la propuesta me quita esas palabras, me quedo más tranquilo pero sabiendo menos.»

## Top 3 findings

1. **Tray has no contents** — 6-conversation-tray, «Bandeja · 1»: the proposal drops the item text the current shows («Entrepaños que se pandean: que decida el experto»), and «Al instante» vs «A la bandeja, para el experto» (5-notices-critical) is never explained. `vice`
2. **No "is it OK now?" signal** — «Los puntos críticos siguen» (mobile-chat-tray, 6-conversation-tray) and «Conversación ●» (9-materials-expert-answered): after acting, Ricardo cannot tell whether the furniture is fine or he still owes a step. `gap`, both versions
3. **Learning content is lost in the proposal** — «Armado» becomes an unlabeled icon (1-conversation-default) and the five-item review list is gone from «Antes de comprar, una revisión» (8-materials-expert-working); keep the lift of the highlighted piece (2-piece-selected) and «Aplicar con un apoyo al centro» (4-conversation-proposal-pending). `vice`
