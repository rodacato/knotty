# 09 — Fabricación y armado

Lo que una persona en México necesita para pasar del diseño de Knotty a un mueble de triplay armado, anclado y que dure: herramientas por nivel, qué uniones permite cada nivel, cómo pedir los cortes, en qué orden armar, cuánto tarda, qué sale mal, seguridad, transporte, instalación y mantenimiento. Al final, cómo Knotty puede generar las **instrucciones de armado paso a paso de forma determinista** a partir del modelo.

> Base: `docs/PROPUESTA.md` (modelo §3, reglas §5, fases 8 y 9), `06-glosario.md` (vocabulario canónico), `07-arquitectura-del-conocimiento.md` §3.6 (`ToolId`, `JointSpec`) y el código de la rama `investigacion-triplay` al 2026-09-25 (`joints.ts`, `cajon.ts`, `cabinet.ts`, `catalogo.json`, `supuestos.ts`).
>
> Unidades: sistema métrico. Lo que se vende en pulgadas va **primero en mm** y luego con su designación comercial: «tornillo de 32 mm (1¼")».
>
> Confianza: ✅ dos fuentes o más · ⚠️ una fuente o práctica de taller · ❓ por validar (con carpinteros, tiendas o pruebas de uso).

---

## Resumen

1. **Tres niveles** bastan para cubrir a casi todas las personas: *cortes en tienda + taladro*, *intermedio* (sierra circular con guía, plantilla de bolsillo, broca de 35 mm) y *taller completo* (sierra de mesa, router, prensas suficientes). El nivel decide qué uniones puede proponer Knotty (§1.3); hoy `completeJoints` no lo considera.
2. **El corte a medida es el cuello de botella** para el nivel 1. The Home Depot México anuncia su sala de cortes para «puertas o productos de madera» comprados en tienda, sin precio ni tolerancia publicados [23][24]; las madererías y los Placacentro ofrecen dimensionado, cubrecanto, perforación para bisagras y ranuras [25]. El costo por corte en madererías de la CDMX se reporta en $10–30 MXN [26] (⚠️ una fuente). Knotty debe exportar una **lista de corte que un mostrador entienda** (§2.4).
3. **Secuencia de armado**: perforar todo en plano → presentar en seco → piso y laterales → repisas fijas y divisores → techo o cubierta → **escuadrar por diagonales** → trasera clavada y pegada → zoclo → correderas y cajones → puertas y ajuste → jaladeras → acabado y anclaje (§3). Es derivable del grafo de uniones.
4. **Errores más caros de principiante**: no medir el espesor real, no descontar el ancho del corte, cortar puertas y frentes antes de armar el cuerpo, atornillar al canto sin taladro guía, no escuadrar y hacer un mueble que no pasa por la puerta (§6, §8).
5. **Seguridad**: lentes, protección auditiva y respirador; el polvo de madera y el formaldehído están en el Grupo 1 de la IARC [33] (el formaldehído desde 2004); la sierra circular necesita disco a 3–6 mm por debajo de la pieza, apoyo a ambos lados y dos manos [31].
6. **Anclaje**: todo mueble alto se ancla. En tablaroca, el taquete solo no basta para el jalón perpendicular de un antivuelco: hay que ir al poste [42].
7. Propuesta técnica: `planAssembly(design, toolkit)` → `AssemblyPlan` con `AssemblyStep[]`, ordenado por un orden topológico del grafo de uniones con prioridades por rol y desempate por id, con herramientas por unión, tiempos por operación calibrables y un `SkillLevel` calculado (§11).

---

## 1. Herramientas mínimas por nivel

### 1.1 Los tres niveles

| Nivel | Id | Para quién | Herramientas | Conf. |
|---|---|---|---|---|
| **1. Cortes en tienda + taladro** | `storeCuts` | Primera vez; depa sin taller; no quiere sierra. | Taladro atornillador con brocas para madera de 3 y 4 mm y **avellanador** [9]; puntas de desarmador; flexómetro; escuadra de carpintero [9]; lápiz; 2–4 prensas (de esquina o rápidas) [9]; martillo; lija de grano 120–180 [9]; pegamento blanco [36]. | ✅ [9][36] |
| **2. Intermedio** | `intermediate` | Ya armó algo; tiene donde cortar. | Lo del nivel 1 + **sierra circular** con regla guía [31]; **plantilla de bolsillo** (Kreg o similar) [19]; **broca Forstner de 35 mm** con tope de profundidad para cazoletas [14]; plantilla de perforación para soportes de repisa (sistema 32) [15]; caladora [18]; lijadora orbital; 4–6 prensas. | ⚠️ [14][19][31] |
| **3. Taller completo** | `fullShop` | Hace muebles seguido. | Lo del nivel 2 + **sierra de mesa** o escuadradora; **router** con fresas de ranura y de rebaje [18]; prensas largas (sargentos) [1]; plantilla para tarugos; aspiradora o colector de polvo [32]; plancha o enchapadora de cantos. | ⚠️ [1][18] |

Ids de herramienta: los de `07-arquitectura-del-conocimiento.md` §3.6. *Nota de auditoría:* la lista se unificó y ya incluye los que usa este documento (`impactDriver`, `forstner35`, `shelfPinJig`, `countersink`, `square`, `tape`, `sander`, `studFinder`) más `hammer`, `stapler`, `forstner15`, `confirmatBit` y `biscuitJoiner`; ver `10-auditoria.md` §3.

### 1.2 Lo que se puede pedir en lugar de comprar herramienta

Una maderería con seccionadora y enchapadora puede hacer lo que al nivel 1 le falta. Placacentro anuncia en México: optimizador de cortes, dimensionado, enchapado de cantos, **perforación para bisagras**, **ranuras para traseras y fondos de cajón**, corte diagonal y circular, ruteado y **etiquetado de piezas** [25]. Así, una persona de nivel 1 puede tener cazoletas y ranuras sin broca Forstner ni router. ✅ [25][28]

### 1.3 Uniones que permite cada nivel

`tipo` según el modelo actual (`esquema.ts:69-72`); nombres de `06-glosario.md` §5.

| Unión | Nivel 1 | Nivel 2 | Nivel 3 | Herramienta que la exige | Nota | Conf. |
|---|---|---|---|---|---|---|
| A tope con tornillo (`tope-tornillo`) | ✅ | ✅ | ✅ | taladro, avellanador | Con taladro guía para no abrir el canto. | ⚠️ [9] |
| Clavo y pegamento (`clavo-pegamento`) | ✅ | ✅ | ✅ | martillo (o clavadora) | Trasera y fondos. | ⚠️ |
| Escuadra metálica (`escuadra`) | ✅ | ✅ | ✅ | taladro | Por dentro; no escuadra el cuerpo por sí sola. | ❓ |
| Soportes de repisa (`soporte-repisa`) | ⚠️ con plantilla o perforado en maderería | ✅ | ✅ | taladro + plantilla (`shelfPinJig`) | Agujeros de 5 mm, cada 32 mm, a 37 mm del frente [15][16]. | ✅ [15][16] |
| Bisagras de cazoleta (`bisagra-cazoleta`) | ⚠️ solo si la maderería perfora [25] | ✅ | ✅ | `forstner35` + tope | Cazoleta de 35 mm, 11.5–13 mm de profundidad [14]. | ✅ [14][25] |
| Correderas (`corredera`) | ✅ | ✅ | ✅ | taladro, escuadra | Caja 26 mm más angosta que el hueco (13 mm por lado; la corredera de balines admite 12.7–13.5) [`02` §6.3]. *Nota de auditoría: antes decía 25–26 mm (12.5–13 por lado); con 25 mm el cajón no entra.* | ✅ [9][`02`] |
| Tornillo de bolsillo (`bolsillo`) | ❌ | ✅ | ✅ | `pocketJig` | Tornillo de rosca gruesa para triplay [19]; largo por espesor real [20]. | ✅ [19][20] |
| Tarugos (`tarugo`) | ❌ | ⚠️ con plantilla | ✅ | `dowelJig` | Pide agujeros alineados en las dos piezas. | ❓ |
| Minifix (`minifix`) | ❌ (salvo perforado en maderería) | ⚠️ | ✅ | Forstner 15 mm + plantilla | Para muebles desarmables (§8.4). | ❓ |
| Ranura (`canal`) | ⚠️ solo si la maderería la hace [25] | ⚠️ con sierra circular y varias pasadas | ✅ | `router` o `tableSaw` | Profundidad: un tercio del espesor, nunca más de la mitad ✅ (`02-uniones-y-herrajes.md` §3.2). | ⚠️ [25] |
| Rebaje (`rebaje`) | ❌ | ⚠️ | ✅ | `router` o `tableSaw` | Típico para traseras embutidas. | ⚠️ [1] |

Consecuencia para Knotty: hoy `completeJoints` pone siempre `tope-tornillo`, `clavo-pegamento`, `soporte-repisa` y `bisagra-cazoleta` (`joints.ts:21-51`), todas posibles en nivel 1 si la maderería perfora las cazoletas. El experto sí puede declarar `bolsillo`, `canal` o `minifix` (`sistema.v4.md:56`): con un `ToolKit` en los requisitos (propuesta de `07-…` §3.11, `tools: ToolId[]`), una validación puede avisar «esta unión pide plantilla de bolsillo y dijiste que solo tienes taladro».

---

## 2. Cortes: tienda, maderería y lista de corte

### 2.1 Dónde cortar en México

| Opción | Qué ofrece | Precisión | Costo | Conf. |
|---|---|---|---|---|
| **The Home Depot México — Sala de cortes** | Corte recto de alto y ancho, preparación de puertas, colocación de bisagras y cerraduras; para productos de madera comprados en la tienda [23][24]. La ficha del triplay dice que «puede cortarse a la medida que se requiera» [22]. | No publicada. | No publicado: «visita nuestra Sala de Cortes» [24]. | ⚠️ [22][23][24] |
| **Sodimac México** | Vende «tableros dimensionados» [46]; hay reportes en video de cortes gratis de tableros [46]. | No publicada. | No publicado. | ❓ [46] |
| **Maderería de barrio / distribuidora** | Corte a medida, a veces enchapado de cantos, entrega en la zona [26][28]. | Depende de la máquina: una seccionadora vertical profesional ajusta a 0.1 mm [30]; una sierra de banco con guía desgastada, peor (❓). | $10–30 MXN por corte en la CDMX [26]; algunas cortan sin costo con la compra [26]. | ⚠️ [26] |
| **Placacentro Masisa y distribuidores de tableros** | Optimizador, dimensionado, enchapado, perforación para bisagras, ranuras, etiquetado, envío [25]. | Máquinas dimensionadoras [25]. | No publicado. | ⚠️ [25] |
| **Cortar en casa (nivel 2–3)** | Sierra circular con regla guía o sierra de mesa. | ±1 mm con buena guía (❓). | Herramienta propia. | ❓ |

Para la persona: **llama o manda WhatsApp antes** con la lista y pregunta tres cosas: precio por corte, si refilan la hoja (le quitan el canto de fábrica) y si pueden cortar respetando la veta. ⚠️ [26][27][28]

### 2.2 Qué pedir y qué no

- **Sí pedir**: todos los cortes rectos del cuerpo (laterales, piso, techo, repisas, divisores, travesaños, zoclo, trasera), el cubrecanto de los cantos visibles y, si la persona es de nivel 1, la perforación para bisagras y las ranuras [25]. ⚠️
- **Dejar para después** (o pedir al final, con medidas reales): puertas, frentes de cajón y, si va en rebaje, la trasera. Se miden sobre el cuerpo ya armado y escuadrado, porque un error de 1–2 mm en el cuerpo se nota en las separaciones entre puertas. ❓ (práctica de taller; validar)
- **Cortes curvos o pequeños** (< 100 mm): muchas tiendas no los hacen por seguridad; la sierra circular tampoco debe cortar piezas que no se pueden sujetar [31]. ⚠️ [31]

### 2.3 Orden de cortes y acomodo

Principios (el acomodo de Knotty ya los aplica en parte: `acomodo.ts`, parámetros `refilado: 15`, `sierra: 4`, `holgura: 2` en `catalogo.json`):

1. **Refilar** la hoja: el canto de fábrica llega golpeado. Knotty descuenta 15 mm por lado. ⚠️
2. **Primero los cortes largos** que parten la hoja en tiras al ancho de las piezas (a lo largo de la veta), luego los cortes transversales de cada tira. Es como trabajan las seccionadoras [30] y como se evita manipular hojas completas. ⚠️ [30]
3. **Piezas iguales, en el mismo ajuste**: los dos laterales, todas las repisas iguales. Si salen iguales entre sí, el cuerpo cuadra aunque la medida absoluta se desvíe 0.5 mm. ❓
4. **Descontar el ancho del corte** (3–4 mm) entre piezas [29]. ⚠️ [29]
5. **Respetar la veta** de las piezas visibles (Knotty guarda `veta: 'largo' | 'ancho' | 'libre'`); las piezas `libre` rellenan el sobrante. ⚠️
6. **La pieza más grande primero**: si la hoja tiene un defecto, que caiga en una pieza chica o en el sobrante. ❓

### 2.4 Lista de corte que entiende un mostrador

Formato propuesto para exportar (PDF y texto para WhatsApp), una tabla por material:

| # | Pieza | Largo (mm) | Ancho (mm) | Cant. | Veta | Cubrecanto | Notas |
|---|---|---|---|---|---|---|---|
| 1 | Lateral | 1800 | 300 | 2 | a lo largo (1800) | frente | izq. y der. |
| 2 | Repisa | 564 | 280 | 5 | a lo largo (564) | frente | — |
| 3 | Trasera (6 mm) | 1800 | 600 | 1 | libre | — | cortar al final si va en rebaje |

Reglas:

- **Largo = la medida en dirección de la veta**, siempre primero; así el mostrador no tiene que adivinar. Convención común de los optimizadores (orientación importa) [29]. ⚠️ [29]
- Encabezado: material, espesor nominal, **espesor real medido**, número de hojas, si la hoja se refila y el ancho de corte supuesto.
- Numerar las piezas y **pedir que las etiqueten** (servicio que ofrecen [25]); el número coincide con el de las instrucciones de armado.
- Adjuntar el diagrama de acomodo (Knotty ya lo dibuja: `Materiales.tsx:84`) como sugerencia, no como obligación: cada tienda optimiza con su programa [25][29].
- Medidas en mm enteros. Si una pieza sale de 563.5, redondear hacia abajo y dejarlo dicho. ❓

---

## 3. Secuencia de armado típica de un cuerpo

Para un cuerpo sin marco (el que genera `cabinet.ts`): laterales, piso, techo o cubierta, repisas, divisores, trasera, zoclo, puertas y cajones.

| # | Paso | Detalle | Conf. |
|---|---|---|---|
| 0 | **Preparar** | Revisar la lista de corte, etiquetar piezas, marcar la **cara buena** y el frente de cada pieza. | ⚠️ |
| 1 | **Perforar en plano** | Antes de armar: agujeros de soportes de repisa (sistema 32) [15], cazoletas de las puertas [14], placas de bisagra y correderas en los laterales, agujeros de bolsillo [19]. Es más fácil y preciso con la pieza acostada. | ⚠️ [14][15] |
| 2 | **Cubrecanto y lijado** | Poner cubrecanto a los cantos visibles y lijar las caras interiores; después cuesta más llegar. | ❓ |
| 3 | **Presentar en seco** | Armar sin pegamento con prensas para comprobar que todo coincide [9]. | ✅ [9][34] |
| 4 | **Piso a los laterales** | Pegamento en el canto, prensas, taladro guía, avellanar y atornillar desde la cara del lateral (unión a tope). Tornillo que entre al menos 25 mm en el canto (`sistema.v4.md:56`). | ⚠️ [9] |
| 5 | **Divisores y repisas fijas** | En el orden que se puedan alcanzar con el taladro; lo que va en ranura se mete **antes** de cerrar con el segundo lateral. | ⚠️ |
| 6 | **Techo, cubierta o travesaños** | Igual que el piso. La cubierta sobrepuesta se atornilla desde abajo o con escuadras / bolsillo para no ver tornillos. | ❓ |
| 7 | **Escuadrar** | Medir las dos diagonales del frente; si no son iguales, apretar una prensa en la diagonal larga hasta igualarlas [34]. Revisar también la parte de atrás: un cuerpo puede estar a escuadra al frente y torcido atrás [34]. Hacerlo **antes** de que pegue el pegamento (30–60 min en prensa con cola PVA [35]). | ✅ [34][35] |
| 8 | **Trasera** | Con el cuerpo a escuadra, pegar y clavar la trasera en todo el perímetro; al quedar fija, mantiene la escuadra (regla R5 de `PROPUESTA.md` §5). Si va en ranura o rebaje, cuadrarla antes de meterla [34]. | ✅ [34] |
| 9 | **Zoclo o patas** | Zoclo remetido al frente [10] o patas niveladoras. | ⚠️ [10] |
| 10 | **Correderas en el cuerpo** | Con escuadra y a la altura marcada; misma altura a ambos lados. | ⚠️ [9] |
| 11 | **Cajones** | Armar la caja (costados, contrafrente, trasera) con prensas de esquina y dos tornillos por unión; fondo atornillado cada ~150 mm; montar la caja en las correderas; al final el **frente falso**, atornillado desde adentro con tornillos más cortos que la suma de espesores [9]. | ✅ [9][13] |
| 12 | **Puertas** | Montar bisagras en la puerta, colgar y ajustar: lateral (iguala separaciones), profundidad y altura [14]. | ✅ [14] |
| 13 | **Jaladeras** | Plantilla de papel o cartón para que todas queden a la misma altura; broca 1 mm más grande que el tornillo [9]. | ⚠️ [9] |
| 14 | **Acabado** | Lijar, sellar y dar acabado (ver el documento hermano de acabados). Desmontar herrajes si se barniza. | ❓ |
| 15 | **Instalar** | Nivelar, anclar al muro (§9). | ✅ [42][43] |

**Tiempos de pegamento** (cola blanca PVA tipo Titebond Original): 4–6 min de tiempo abierto para cerrar la unión, 30–60 min en prensa, resistencia total a las 24 h [35]. El Resistol 850 seca transparente y **no es resistente al agua** [36]. ✅ [35][36]

*Nota de auditoría:* el pegamento que la mayoría compra en México es el **Resistol 850**, y su ficha técnica da **15 min** de tiempo abierto, **30–40 min** en prensa, manipulación a las 4 h y carga a las 24 h, con aplicación entre 10 y 40 °C (`02-uniones-y-herrajes.md` §5). Knotty debe usar esos tiempos por omisión; los de Titebond solo si la persona dice que usa Titebond.

---

## 4. Plantillas y trucos

| Truco | Para qué | Conf. |
|---|---|---|
| **Taco espaciador** del alto de la repisa | Poner repisas fijas a la misma altura en ambos laterales sin medir cada vez. | ❓ |
| **Plantilla de perforación de 32 mm** (comprada o de triplay con agujeros) | Soportes de repisa alineados en los cuatro puntos [15][16]. | ✅ [15][16] |
| **Tope en la broca** (cinta o collarín) | No atravesar el lateral al perforar soportes o cazoletas; la cazoleta va a 11.5–13 mm [14]. | ⚠️ [14] |
| **Prensas de esquina** | Sostener dos piezas a 90° mientras se atornilla [9]. | ⚠️ [9] |
| **Diagonales con flexómetro** | Escuadrar el cuerpo [34]. | ✅ [34] |
| **Hoja de cartón con las jaladeras** | Misma posición en todos los frentes [9]. | ⚠️ [9] |
| **Cinta de pintor sobre la línea de corte** | Menos astillado en la cara del triplay con sierra circular. | ❓ |
| **Cortar con la cara buena hacia abajo** (sierra circular) | El diente sale por arriba y astilla la cara de arriba. | ❓ |
| **Separadores de 2–3 mm** (monedas, tarjetas) | Dejar parejas las separaciones al colgar puertas y frentes. | ❓ |
| **Pedir a la maderería que etiquete** | Cada pieza con su número de la lista [25]. | ⚠️ [25] |

---

## 5. Tiempos estimados

No hay una fuente publicada para tiempos de principiante; los números siguientes son **supuestos de taller para calibrar** (❓) y están pensados como datos editables (`07-…`, «lo que un carpintero podría corregir es dato»). Lo único con fuente son los tiempos de secado [35].

| Operación | Principiante (min) | Con práctica (min) | Conf. |
|---|---|---|---|
| Unión a tope con tornillo (pegar, prensar, guía, avellanar, 3–4 tornillos) | 8–12 | 3–5 | ❓ |
| Unión de bolsillo (perforar 2–3 bolsillos y atornillar) | 8–12 | 3–5 | ❓ |
| Perforar una fila de soportes con plantilla | 5 | 2 | ❓ |
| Cazoleta + montar bisagra | 10–15 | 3–5 | ❓ |
| Colgar y ajustar una puerta | 20–40 | 5–10 | ❓ |
| Cajón completo (caja, fondo, correderas, frente) | 60–120 | 20–40 | ❓ |
| Trasera clavada y pegada | 15–20 | 5–10 | ❓ |
| Escuadrar y esperar prensa | 30–60 (secado) | 30–60 | ✅ [35] |
| Curado antes de cargar | 24 h | 24 h | ✅ [35] |

Ejemplos (❓): un **buró** con una puerta y un cajón, nivel 1 con cortes de tienda: 4–6 h de armado más el secado del acabado. Un **librero** de 1800 × 600 mm con 5 repisas móviles: 3–5 h. Una **alacena** de 2 puertas y 2 cajones: 8–12 h, en dos días.

---

## 6. Errores típicos de principiante

| # | Error | Consecuencia | Cómo evitarlo | Conf. |
|---|---|---|---|---|
| 1 | Suponer que el triplay de 18 mm mide 18.0 | Ranuras flojas, tornillos de bolsillo que salen por la cara | Medir el espesor real y ajustar la plantilla y el largo del tornillo [20][21] (`dictamen.v1.md:13`) | ✅ [20][21] |
| 2 | No descontar el ancho del corte | La última pieza de cada tira sale 3–4 mm corta | Lista de corte con acomodo [29] | ⚠️ [29] |
| 3 | Cortar puertas y frentes antes de armar | Separaciones disparejas | Medir sobre el cuerpo armado | ❓ |
| 4 | Atornillar al canto sin taladro guía | El canto se abre entre capas | Broca guía y avellanar [9] | ⚠️ [9] |
| 5 | Tornillo demasiado largo o mal inclinado | Asoma por la cara | Largo = espesor de la pieza que atraviesa + lo que entra en la otra; en bolsillo, tabla por espesor [20] | ✅ [20] |
| 6 | No escuadrar antes de que seque | Puertas que no cierran parejo, cajones que rozan | Diagonales y prensa en la larga [34] | ✅ [34] |
| 7 | Clavar la trasera con el cuerpo torcido | La trasera «congela» el error | Escuadrar primero, trasera después [34] | ✅ [34] |
| 8 | Cajón sin holgura de corredera | No entra o no corre | Caja 26 mm más angosta que el hueco (13 mm por lado); revisar la ficha de la corredera [9][`02` §6.3] | ✅ [9] |
| 9 | Perforar la cazoleta en la cara equivocada o sin tope | Puerta arruinada | Marcar la cara interior; tope a 11.5–13 mm [14] | ⚠️ [14] |
| 10 | Puertas pares sin reflejar | Dos puertas izquierdas | Marcar «izq.» y «der.» antes de perforar | ❓ |
| 11 | Pegamento escurrido sin limpiar | El barniz no agarra y queda mancha | Limpiar con trapo húmedo antes de que seque | ❓ |
| 12 | Mueble que no pasa por la puerta o no se puede parar | Hay que desarmarlo o cortarlo | Revisar transporte en el diseño (§8) | ✅ [37] |
| 13 | No anclarlo | Riesgo de vuelco | Kit antivuelco a un poste o muro sólido [42][43] | ✅ [42][43] |
| 14 | Cargar antes de 24 h | Uniones que se abren | Esperar el curado [35] | ✅ [35] |

---

## 7. Seguridad

### 7.1 Equipo de protección personal

| Riesgo | Protección | Por qué | Conf. |
|---|---|---|---|
| Astillas y dientes de disco | **Lentes de seguridad** siempre que haya máquina | Un disco dañado puede lanzar dientes [31] | ✅ [31] |
| Polvo de madera y de tableros | **Respirador** (no cubrebocas de tela), aspiración, trabajar ventilado | El polvo de madera y el formaldehído están clasificados como cancerígenos del Grupo 1 por la IARC [33] (*nota de auditoría:* el polvo de madera, desde el vol. 62 de 1995; el formaldehído pasó al Grupo 1 en 2004, vol. 88 y vol. 100F; el vol. 62 lo tenía como 2A); el polvo irrita vías respiratorias y fino acumulado puede incendiarse [32] | ✅ [32][33] |
| Ruido | Tapones u orejeras con sierra y router | Práctica de taller | ❓ |
| Enganches | Nada de ropa suelta ni joyas; cabello recogido | [31] | ⚠️ [31] |
| Acabados con solvente | Ventilación y guantes de nitrilo | Ver documento de acabados | ❓ |

### 7.2 Sierra circular (resumen del Power Tool Institute [31])

- Revisar que la **guarda inferior** regrese sola antes de cada corte; nunca amarrarla ni quitarla [31]. OSHA exige guardas arriba y abajo en sierras portátiles de disco [52].
- **Profundidad del disco**: 3–6 mm (⅛"–¼") más que el espesor; menos de un diente completo debe asomar por abajo [31].
- **Apoyar la hoja a ambos lados del corte** para que no pellizque el disco; el sobrante debe poder caer libre y la base de la sierra debe ir sobre la parte sujeta [31].
- **Sujetar la pieza con prensas**; nunca sostenerla con la mano o sobre la pierna; **dos manos en la sierra** [31].
- Esperar a que el disco llegue a velocidad antes de tocar la pieza; no sacar la sierra del corte con el disco girando [31].
- Mantener el cable fuera del camino del disco [31].
- No cortar piezas pequeñas que no se puedan sujetar [31].
- Discos limpios y afilados: la resina acumulada aumenta la fricción y el contragolpe [31].

✅ [31][52]

### 7.3 Otras herramientas

- **Taladro y atornillador de impacto**: sujetar la pieza; en triplay de 12 mm el impacto hunde la cabeza (❓).
- **Router**: sujetar la pieza, avanzar contra el giro de la fresa, dos manos (❓).
- **Caladora**: esperar a que la hoja se detenga antes de sacarla (❓).

---

## 8. Transporte

### 8.1 La hoja

Una hoja de triplay de pino de 18 mm mide 2440 × 1218 mm y pesa **28.1 kg** [22]. No cabe en la cajuela de un auto; se necesita camioneta con caja de al menos 2.44 m o pedir los cortes y llevarse las piezas. *Nota de auditoría:* casi ninguna pickup tiene caja de 2.44 m (suelen medir 1.6–2.0 m): la hoja viaja con la compuerta abajo, amarrada con matraca y con bandera roja en lo que sobresale; lo más común en México es pedir **flete** a la maderería o a la tienda, o llevarse las piezas ya cortadas. The Home Depot México tiene «Compra Express» del patio de materiales para cargar directo en el vehículo [24]; algunas madererías entregan en la zona [27][28]. ⚠️ [22][24][28]

### 8.2 Medidas mínimas de paso (CDMX)

De la Norma Técnica Complementaria para el Proyecto Arquitectónico de la CDMX [37] (mínimos de proyecto; la vivienda real puede tener medidas distintas, y la vivienda de interés social tiene excepciones [37]):

| Elemento | Mínimo | Conf. |
|---|---|---|
| Altura de puertas | 2.10 m | ✅ [37][38] |
| Ancho de puerta de acceso y locales habitables (vivienda) | 0.90 m | ✅ [37][38] |
| Ancho de puerta de cocina y baño | 0.80 m | ✅ [37][38] |
| Pasillos dentro de la vivienda | 0.75 m de ancho, 2.30 m de alto | ⚠️ [37] |
| Escalera privada con muro en un costado | 0.75 m (CDMX) / 0.90 m (Hermosillo) | ✅ [37][38] |
| Escalera común a dos o más viviendas | 0.90 m (CDMX) / 1.20 m (Hermosillo) | ✅ [37][38] |
| Cabina de elevador accesible (edificios de uso público) | 1.10 × 1.40 m, puerta de 0.90 m | ⚠️ [37] |

Ojo: el **ancho libre** de una puerta es menor que la hoja (el marco y la puerta abierta se comen centímetros); la Norma Técnica de Habitabilidad citada por El Arqui MX pide 0.85 m de ancho [39]. **Hay que medir** la puerta más angosta del recorrido, con la hoja abierta. ⚠️ [39]

### 8.3 Reglas para el diseño

1. **¿Pasa por la puerta?** El mueble cabe si sus dos medidas más chicas caben en el ancho libre y el alto de la puerta (lo más común: pasa de lado, con el fondo como ancho). ⚠️ (geometría)
2. **¿Se puede parar dentro del cuarto?** Al levantarlo desde acostado, la diagonal de su perfil lateral debe ser menor que la altura del techo: `√(alto² + fondo²) < altura del techo`. Un ropero de 2200 × 600 mm necesita 2281 mm; en un techo de 2300 mm pasa por 19 mm. ⚠️ (geometría)
3. **Escaleras y giros**: en una escalera de 0.75 m [37] con descanso en «U», un mueble largo puede no girar. Si pasa de 1.80 m de largo, conviene hacerlo en módulos. ❓
4. **Elevadores**: en edificios de departamentos no siempre hay elevador de carga; una cabina accesible tiene 1.10 × 1.40 m [37] y un mueble alto puede entrar solo inclinado. ❓

### 8.4 Muebles desarmables

- **Minifix** en las uniones de cuerpo permite armar y desarmar sin dañar el triplay (nivel 2–3; ver §1.3). ❓
- **Módulos**: dos cuerpos de 900 mm en lugar de uno de 1800 mm, unidos entre sí con tornillos por dentro. ❓
- **Cubierta y zoclo sueltos**: se atornillan en sitio. ❓
- La **trasera** es lo que escuadra: si se desarma el cuerpo, se vuelve a escuadrar al armar [34]. ✅ [34]

---

## 9. Instalación

### 9.1 Nivelar

- Los pisos no suelen estar nivelados; por eso los módulos de cocina se separan del piso con patas y se cierran con zoclo [10]. ✅ [10][12]
- Patas niveladoras (el catálogo trae `pata-niveladora`) o cuñas debajo del zoclo; nivel de burbuja en dos direcciones. ⚠️
- Un cuerpo apoyado en un piso desnivelado se tuerce y las puertas pierden la escuadra; se nivela **antes** de ajustar bisagras [14]. ⚠️ [14]

### 9.2 Anclar al muro (antivuelco)

«Anclar todo mueble con cajones, puertas y repisas al muro evita lesiones y muertes por vuelco» [43]. Knotty ya decide `anclajeMuro` en el diseño (`PROPUESTA.md` §3, regla R4). ✅ [42][43]

| Muro | Qué usar | Carga orientativa | Conf. |
|---|---|---|---|
| **Concreto** | Taquete de nylon expansivo o ancla metálica; broca para concreto con percusión | Plástico 5–25 kg; metálico 25–80 kg o más [40] | ⚠️ [40] |
| **Tabique rojo macizo** | Taquete plástico expansivo [40] | *Nota de auditoría:* no «similar a concreto»: el tabique rojo recocido artesanal es más débil que el ladrillo de las tablas de fischer; usar la mitad de la carga de `05-reglas-estructurales.md` §8.2 (≈ 30 kg por taquete de 8 × 40) hasta validar | ⚠️ [40] |
| **Block hueco** | Taquete para huecos; el expansivo común no agarra [40] | — | ⚠️ [40] |
| **Tablaroca** | **Atornillar al poste**; si no hay poste donde se necesita, taquete de mariposa o Molly [40]. La CPSC advierte que los taquetes de tablaroca resisten mal el jalón perpendicular de un antivuelco y que la tablaroca no suele aguantar 222 N (50 lb) [42] | Mariposa 10–30 kg [40]; plástico 2–8 kg [41] | ✅ [40][41][42] |
| **Madera** | Tornillo para madera de al menos 51 mm (2") [43] | — | ⚠️ [43] |

Pasos [43]: fijar una placa al muro (en el poste), acercar el mueble, fijar la placa al mueble (en el travesaño o techo, no en la trasera de 3 mm), unir con la cinta, apretar y **jalar para comprobar**. ✅ [42][43]

Advertencias:

- Revisar que no haya tubería ni cables donde se perfora [31]. ⚠️ [31]
- El taquete debe coincidir con el diámetro de la broca; un agujero grande pierde agarre [40]. ⚠️ [40]
- En tablaroca en México los postes suelen ser metálicos (canal galvanizado): se fijan con tornillo autorroscante para lámina, no con tornillo para madera (❓, validar con tablaroquero).

### 9.3 Muebles de cocina y colgados (fuera del alcance de hoy)

Los módulos altos colgados necesitan riel o placa de colgar y cálculo de carga; Knotty no los modela todavía. ❓

---

## 10. Mantenimiento

| Qué | Cada cuánto | Cómo | Conf. |
|---|---|---|---|
| **Ajustar bisagras** | Cuando las separaciones se disparejan | Tornillos de ajuste lateral, profundidad y altura [14] | ✅ [14] |
| **Apretar tornillos** de jaladeras, correderas y bisagras | Cada 6–12 meses | Desarmador manual, sin atornillador de impacto | ❓ |
| **Revisar el anclaje** | Al mover el mueble o cada año | Jalar la cinta [43] | ⚠️ [43] |
| **Humedad** | Siempre | El pegamento blanco no resiste el agua [36]; secar derrames, no apoyar en piso mojado | ⚠️ [36] |
| **Correderas** | Cuando raspan | Limpiar polvo; no lubricar con aceite que junte polvo (❓) | ❓ |
| **Repisas pandeadas** | Si se ven combas | Voltearlas (la comba se corrige en parte) o agregar un travesaño o divisor | ❓ |
| **Acabado** | Cuando se gasta | Lijar suave y renovar (ver documento de acabados) | ❓ |

---

## 11. Cómo Knotty puede generar instrucciones de armado deterministas

### 11.1 Principios

1. **Todo sale del diseño resuelto**: piezas, roles, uniones (incluidas las que infiere `completeJoints`), grupos (`cajon-1`, `puerta-1`), herrajes y geometría. El LLM no escribe pasos; a lo sumo, redacta un párrafo de introducción. Coherente con D34 («nada se decide con el LLM si una tabla basta»).
2. **Mismo diseño, mismos pasos**: orden topológico con desempate estable (fase, rol, id).
3. **Textos para la persona** salen de plantillas con el vocabulario de `06-glosario.md` (`Term.label`); identificadores en inglés.
4. **Datos calibrables** (tiempos, dificultad por unión, herramientas por unión) viven en JSON con fuente, como propone `07-…` §3.

### 11.2 Algoritmo

1. **Grafo**: nodos = piezas; aristas = uniones (`a` se fija a `b`). Las piezas con `grupo` forman **subensambles** (cajón, puerta) que se arman aparte y se unen al cuerpo al final.
2. **Fases fijas** (en orden): `prepare` → `drill` (perforar en plano) → `edge` (cubrecanto) → `dryFit` → `carcass` → `square` → `back` → `base` → `hardware` → `subassemblies` → `fronts` → `pulls` → `finish` → `install`.
3. **Orden dentro de `carcass`**: raíz = la pieza que toca `y = 0` con mayor área (el piso; si no hay, un lateral). Se agregan piezas en orden de prioridad por rol (`bottom`, `side`, `divider`, `shelf` fija, `top`/`topOver`, `rail`) **siempre que todas sus uniones hacia piezas ya colocadas se puedan hacer**. Restricción de acceso: una pieza unida con `groove`/`rabbet` a dos piezas debe entrar antes que la segunda (si no, no se puede meter). Desempate: id.
4. **Checkpoint de escuadra**: después de la última pieza rígida del cuerpo y antes de la primera unión de `back` (`nailGlue` sobre la trasera). Si el diseño no tiene trasera rígida, el paso de escuadra aparece igual y agrega «revisa de nuevo después de 30 min».
5. **Operaciones previas por unión**: cada `JointSpec` declara lo que hay que hacer **en plano** (perforar bolsillos, cazoletas, filas de 32 mm, ranuras) y en qué pieza; esos se juntan en la fase `drill`, agrupados por pieza para que la persona trabaje una pieza a la vez.
6. **Herramientas**: la unión de todas las `requires` de las uniones del diseño; el paso lista solo las suyas.
7. **Dificultad**: `max(jointSpec.difficulty)` y un puntaje que suma precisión (puertas embutidas, cajones, ranuras); el `SkillLevel` es el nivel más bajo cuyo `ToolKit` cubre todas las herramientas requeridas (con la opción de «pedirlo a la maderería» para cazoletas y ranuras, §1.2).
8. **Tiempo**: suma de minutos por operación (tabla §5) × multiplicador por nivel; los secados se suman aparte como «espera».

### 11.3 Tipos (bosquejo)

```ts
// src/domain/assembly/assembly.ts
import { z } from 'zod'
import { ToolId } from '../knowledge/joinery'

// Minutes are calibration data, not truth: they come from knowledge/data/assembly/times.json with a source.
export const Minutes = z.object({ min: z.number().nonnegative(), max: z.number().nonnegative() })

export const SkillLevel = z.enum(['storeCuts', 'intermediate', 'fullShop'])
export type SkillLevel = z.infer<typeof SkillLevel>

export const ToolKit = z.object({
  level: SkillLevel,
  tools: z.array(ToolId),
  /** Operations the person will ask the lumber yard to do instead of owning the tool. */
  outsourced: z.array(z.enum(['cutToSize', 'edgeBanding', 'hingeBoring', 'grooving', 'shelfPinRows'])),
})
export type ToolKit = z.infer<typeof ToolKit>

export const AssemblyPhase = z.enum([
  'prepare', 'drill', 'edge', 'dryFit', 'carcass', 'square', 'back', 'base',
  'hardware', 'subassemblies', 'fronts', 'pulls', 'finish', 'install',
])
export type AssemblyPhase = z.infer<typeof AssemblyPhase>

export const Check = z.object({
  kind: z.enum(['diagonals', 'level', 'gap', 'flush', 'pullTest']),
  /** Spanish, for the person: "Las dos diagonales del frente deben medir lo mismo (±1 mm)." */
  text: z.string(),
  toleranceMm: z.number().nonnegative().nullable(),
})

export const AssemblyStep = z.object({
  id: z.string().describe('Estable: "carcass-3", "drawer-cajon-1-2"'),
  phase: AssemblyPhase,
  order: z.number().int().nonnegative(),
  /** Spanish, imperative, short: "Une el piso a los laterales". */
  title: z.string(),
  /** Spanish instructions built from templates and vocabulary labels. */
  body: z.array(z.string()),
  pieces: z.array(z.string()).describe('Ids de pieza que participan'),
  joints: z.array(z.string()).describe('Ids de unión que se hacen en este paso'),
  tools: z.array(ToolId),
  hardware: z.array(z.object({ herrajeId: z.string(), count: z.number().int().positive() })),
  glue: z.boolean(),
  checks: z.array(Check),
  safety: z.array(z.string()).describe('Avisos en español: "Lentes y respirador"'),
  minutes: Minutes,
  waitMinutes: z.number().nonnegative().describe('Secado o curado antes del siguiente paso'),
  /** For the 3D view: pieces to show exploded and the ones to highlight. */
  view: z.object({ show: z.array(z.string()), highlight: z.array(z.string()) }),
  /** Where the step comes from, for the debug log and tests. */
  because: z.array(z.string()).describe('"joint:u-piso-lat-izq", "rule:square-before-back"'),
})
export type AssemblyStep = z.infer<typeof AssemblyStep>

export const AssemblyPlan = z.object({
  steps: z.array(AssemblyStep),
  level: SkillLevel,
  tools: z.array(ToolId),
  outsourced: ToolKit.shape.outsourced,
  minutes: Minutes,
  waitMinutes: z.number().nonnegative(),
  difficulty: z.number().int().min(1).max(5),
  /** Spanish warnings: "Esta unión pide plantilla de bolsillo y no la tienes". */
  warnings: z.array(z.object({ code: z.string(), text: z.string(), joints: z.array(z.string()) })),
})
export type AssemblyPlan = z.infer<typeof AssemblyPlan>
```

```ts
// src/domain/knowledge/joinery.ts (additions to JointSpec from 07 §3.6)
export const JointProcess = z.object({
  /** Work done on a single piece before assembly, grouped in the "drill" phase. */
  prep: z.array(z.object({
    on: z.enum(['a', 'b']),
    op: z.enum(['pilotAndCountersink', 'pocketHoles', 'cupBoring', 'shelfPinRow', 'groove', 'rabbet', 'dowelHoles', 'camBoring']),
    tools: z.array(ToolId),
    outsourceable: z.boolean(),
  })),
  /** When it happens in the assembly. */
  phase: AssemblyPhase,
  /** Access: the piece must go in before the second neighbour closes the slot. */
  insertBeforeClosing: z.boolean(),
  minutes: z.record(SkillLevel, Minutes),
  waitMinutes: z.number().nonnegative(),
})
```

```ts
// src/domain/assembly/plan.ts
export function planAssembly(design: Diseno, geometry: Geometria, kb: KnowledgeBase, kit: ToolKit): Decision<AssemblyPlan>
export function requiredLevel(design: Diseno, kb: KnowledgeBase): { level: SkillLevel; missing: ToolId[]; outsourceable: string[] }
export function cutList(design: Diseno, geometry: Geometria, catalog: Catalogo): CutListRow[]   // largo = along the grain

export const CutListRow = z.object({
  number: z.number().int().positive(),
  pieceIds: z.array(z.string()),
  label: z.string().describe('Nombre para la persona: "Lateral"'),
  materialId: z.string(),
  lengthMm: z.number().positive().describe('En dirección de la veta'),
  widthMm: z.number().positive(),
  quantity: z.number().int().positive(),
  grain: z.enum(['length', 'free']),
  edgeBanding: z.array(z.enum(['length1', 'length2', 'width1', 'width2'])),
  note: z.string().nullable(),
})
```

### 11.4 Plantillas de texto (ejemplos)

| Paso | Plantilla | Resultado |
|---|---|---|
| `carcass` / `buttScrew` | «Une {a} a {b}: pon pegamento en el canto de {b}, sujeta con prensas, haz {n} taladros guía de {guide} mm a través de {a}, avellana y atornilla con tornillos de {len} mm ({trade}).» | «Une el lateral izquierdo al piso: pon pegamento en el canto del piso, sujeta con prensas, haz 4 taladros guía de 3 mm a través del lateral, avellana y atornilla con tornillos de 51 mm (#8 × 2").» |
| `square` | «Mide las dos diagonales del frente. Si no son iguales, aprieta una prensa en la más larga hasta que midan lo mismo. Revisa también atrás.» | — |
| `back` / `nailGlue` | «Con el mueble a escuadra, pon pegamento en los cantos de atrás y clava la trasera cada {spacing} mm, empezando por una esquina.» | — |
| `drill` / `cupBoring` | «En la cara interior de {door}, perfora {n} cazoletas de 35 mm a {depth} mm de profundidad. Si te las perfora la maderería, sáltate este paso.» | — |

### 11.5 Pruebas (propiedades)

- Cada unión del diseño aparece en **exactamente un** paso.
- Ninguna pieza se usa antes de que exista el paso donde se coloca la pieza a la que se fija (`b` antes de `a`, salvo la raíz).
- El paso `square` precede a toda unión `nailGlue` de una pieza con rol `back`.
- Toda unión con `insertBeforeClosing` ocurre antes de la segunda unión que cierra el espacio.
- Mismo diseño → mismo plan (serialización idéntica).
- Con `kit.level = 'storeCuts'` y un diseño con `bolsillo`, el plan trae el aviso de herramienta faltante.
- Los tiempos totales son monótonos: agregar una unión nunca reduce `minutes.max`.

### 11.6 Encaje con lo que ya existe

- Reutiliza `resolver`, `contactos` y `completeJoints` (`joints.ts`) para el grafo.
- Los requisitos de tipo herramienta (`requisitos.ts`) pasan a `tools: ToolId[]` como propone `07-…` §3.11; de ahí sale el `ToolKit`.
- La vista de armado de la escena (`PROPUESTA.md` §2, «Vista de armado») ya separa piezas; `AssemblyStep.view` le dice qué mostrar en cada paso.
- La bitácora de depuración puede registrar `because` de cada paso.

---

## 12. Preguntas frecuentes

1. **¿Necesito sierra para hacer un mueble con Knotty?** No. Con cortes en tienda o maderería y un taladro atornillador puedes armar uniones a tope, trasera clavada, soportes de repisa (con plantilla) y correderas. Pide en la maderería la perforación de bisagras y las ranuras si tu diseño las lleva [25].
2. **¿Cuánto cobran por cortar?** No hay tarifa pública en The Home Depot México [24]; en madererías de la CDMX se reportan $10–30 MXN por corte, y algunas cortan sin costo con la compra [26]. Pregunta antes.
3. **¿Cómo le paso la lista a la maderería?** Con la lista de corte de Knotty: largo (en dirección de la veta) × ancho en mm, cantidad, cantos con cubrecanto y número de pieza; pide que etiqueten [25].
4. **¿Por qué armar primero el cuerpo y luego cortar las puertas?** Porque las separaciones entre puertas (2–3 mm) se notan; medirlas sobre el cuerpo ya armado absorbe los errores de corte. ❓
5. **¿Cómo sé si mi mueble está a escuadra?** Mide las dos diagonales; deben ser iguales. Si no, aprieta una prensa en la más larga antes de que seque el pegamento [34].
6. **¿Cuánto tarda en secar el pegamento?** Unos 30–60 min en prensa y 24 h para aguantar carga [35].
7. **¿Qué tornillo uso?** Para unión a tope en triplay de 18 mm, uno que entre al menos 25 mm en el canto de la otra pieza (p. ej., 51 mm, #8 × 2"). Para bolsillo en 18 mm, 32 mm (1¼") de rosca gruesa [19][20].
8. **¿Pasa por mi puerta?** Mide el ancho libre con la puerta abierta. Si las dos medidas más chicas del mueble caben en el ancho y el alto de la puerta, pasa. Para pararlo dentro, `√(alto² + fondo²)` debe ser menor que la altura del techo [37].
9. **¿Cómo lo anclo si mi pared es de tablaroca?** Al poste. Los taquetes de tablaroca resisten mal el jalón hacia afuera de un antivuelco [42].
10. **¿Qué protección necesito?** Lentes, protección auditiva y respirador para polvo; el polvo de madera es cancerígeno [33]. Con sierra circular: disco apenas por debajo de la pieza, apoyo a ambos lados y dos manos [31].
11. **Mis puertas quedaron disparejas, ¿qué hago?** Ajusta las bisagras de cazoleta con sus tornillos: lateral, profundidad y altura [14]. Antes, revisa que el mueble esté nivelado.
12. **¿Puedo hacerlo desarmable para mudarme?** Sí, con minifix en las uniones del cuerpo o en módulos más chicos; al volver a armar, escuadra de nuevo [34]. ❓

---

## Fuentes

La numeración se comparte con `06-glosario.md`.

1. Grupo Mobila (Servef, Valencia). *Glosario de Carpintería y Ebanistería para Escuelas Taller*, 2006. https://terminologiaarquitectonica.files.wordpress.com/2018/02/2006-glosario-de-carpinterc3ada-y-ebanisterc3ada-para-escuelas-taller.pdf
9. Arauco. *Serie Cómo Hacer / Mueblería: Cajones para muebles* (Chile, 2015). https://arauco.com/chile/wp-content/uploads/sites/14/2019/03/08_pap_cajones_chile_30jul_2015_1002.pdf
10. Arauco. *Cómo diseñar y construir correctamente una cocina* (Chile, 2016). https://arauco.com/archivos_bim/17_16486_pdf_sch_foll-web_muebleria_como_disenar_cocina_chile_11may_16-pdf_374_so1.pdf
12. Scatec. «¿Cómo se llaman las partes de un mueble de cocina?». https://www.scatec.es/como-se-llaman-las-partes-de-un-mueble-de-cocina/
13. Hammer Melamine. «¿Cómo hacer cajones para muebles de melamina?». https://hammermelamine.blogspot.com/2018/05/como-hacer-cajones-para-muebles.html
14. ParaCarpinteros. «Bisagras de cazoleta: recta, semicurva, curva y cómo ajustarlas». https://www.paracarpinteros.com/blog/explora-la-carpinteria-y-ebanisteria-con-paracarpinteros-com-3/bisagras-de-cazoleta-recta-semicurva-curva-y-como-ajustarlas-82
15. Festool España. «Perforación en línea con el sistema LR 32». https://www.festool.es/conocimientos/ejemplos-de-aplicaci%C3%B3n/fresadora-perforaci%C3%B3n-linea
16. Foromadera. «El sistema de construcción 32 mm». https://www.foromadera.com/t/el-sistema-de-construccion-32-mm/18497
18. The Home Depot México, «Routers eléctricos para madera»; Coppel, «Routers fresadoras y rebajadoras». https://www.homedepot.com.mx/b/herramientas/herramientas-electricas-portatiles/routers · https://www.coppel.com/routers-fresadoras-y-rebajadoras
19. Kreg Tool. «How to select the right pocket-hole screw». https://learn.kregtool.com/learn/how-to-select-right-pocket-hole-screw/
20. Home Repair Geek. «Kreg jig screw chart». https://homerepairgeek.com/tips/kreg-jig-screw-chart/
21. Kreg Tool. «Why material thickness matters». https://learn.kregtool.com/learn/why-material-thickness-matters/
22. The Home Depot México. «Triplay BC 1.22 × 2.44 m 18 mm». https://www.homedepot.com.mx/p/triplay-bc-122-x-244-m-18mm-554283-554283
23. The Home Depot México. «Sala de cortes». https://www.homedepot.com.mx/sala-cortes
24. The Home Depot México. «Conoce los servicios exclusivos en tienda» (Sala de cortes, Compra Express). https://www.homedepot.com.mx/ayuda-servicios-exclusivos-tienda
25. Placacentro Masisa México. «Servicios». https://placacentro.com/mexico/servicios/
26. Cerca de mi ubicación. «Madererías en CDMX» (costos de corte y enchapado). https://cercademiubicacion.com.mx/madererias/cdmx/
27. Materiales Nungaray (Tijuana / Mexicali). «Servicios». https://www.materialesnungaray.com.mx/servicios/
28. Maderas y Tableros Xochimilco (CDMX). https://maderasxochimilco.com/
29. CutList Optimizer. https://www.cutlistoptimizer.com/
30. HOLZ-HER. Seccionadora vertical SECTOR 1260. https://www.holzher.es/es/productos/sierras-para-tableros-verticales/sector-1260-automatic.html
31. Power Tool Institute. *Circular Saws*. https://www.powertoolinstitute.com/wp-content/uploads/2025/10/PTI_Circular-Saws.pdf
32. OSHA. «Wood Dust – Hazard Recognition». https://www.osha.gov/wood-dust/hazards
33. IARC. *Monographs vol. 62: Wood Dust and Formaldehyde* (1995) y *vol. 88: Formaldehyde* (2006, Grupo 1); resumen en INCHEM y NCBI. https://www.inchem.org/documents/iarc/vol62/wood.html · https://www.ncbi.nlm.nih.gov/books/NBK493455/
34. Popular Woodworking. «Squaring up cabinets – don't forget the back». https://www.popularwoodworking.com/editors-blog/squaring-up-cabinets-dont-forget-the-back/
35. WorkshopCalc. «Wood glue dry & cure time chart» (Titebond Original: 4–6 min abierto, 30–60 min en prensa, 24 h). https://workshopcalc.com/reference/wood-glue-dry-time-chart
36. Freund Ferretería. «Pegamento cola blanca para madera 850 Resistol». https://www.freundferreteria.com/producto/9899278
37. Gobierno del Distrito Federal. *Norma Técnica Complementaria para el Proyecto Arquitectónico*, Gaceta Oficial, 8 de febrero de 2011 (tablas 4.1, 4.2, 4.3; elevadores). https://transparencia.cdmx.gob.mx/storage/app/uploads/public/5c8/185/844/5c8185844efec199981494.pdf
38. Municipio de Hermosillo. *NTC-PA-2018, Norma Técnica Complementaria… Proyecto Arquitectónico*, Boletín Oficial de Sonora, 3 de septiembre de 2018. https://dia.unison.mx/wp-content/uploads/2018/09/NTC_PA-2018.pdf
39. El Arqui MX. «Dimensiones de puertas de acceso: normativa». https://elarquimx.com/dimensiones-de-puertas-de-acceso-normativa/
40. Revista Ferrepat. «Qué taquete usar según el tipo de pared y cuánto peso soporta». https://www.revista.ferrepat.com/ferreteria/taquete-segun-tipo-de-pared/
41. Tablaroca.org. «Taquetes». https://www.tablaroca.org/taquetes/ (*nota de auditoría, 2026-09-25: el servidor respondió 522; dato sin poder reverificar*)
42. U.S. CPSC. *Tipover Prevention Project: Anchors without Tools*. https://www.cpsc.gov/s3fs-public/pdfs/Tipover-Prevention-Project-Anchors-without-Tools.pdf
43. U.S. CPSC. *Anchor It!*; Consumer Reports, «How to anchor furniture to help prevent tip-overs». https://www.anchorit.gov/ · https://www.consumerreports.org/home-garden/furniture/how-to-anchor-furniture-to-help-prevent-tip-overs-a4328328212/
46. Sodimac México, «Tableros dimensionados»; video «Cortes gratis de tableros en Sodimac México» (TikTok, @elcarpientero). https://www.sodimac.com.mx/sodimac-mx/category/cat3240001/Tableros-Dimensionados · https://www.tiktok.com/@elcarpientero/video/7173789958107335942
52. OSHA. 29 CFR 1910.243, «Guarding of portable powered tools». https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.243
