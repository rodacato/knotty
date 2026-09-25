# 10 — Auditoría de la investigación

> Revisión del 2026-09-25 de los documentos 01 a 09, hecha con ojo de carpintero de triplay y de ingeniería de la madera. Todo en milímetros; las pulgadas solo como designación comercial, p. ej. «32 mm (1¼")».
>
> Confianza: ✅ dos fuentes o más (o verificado en la fuente primaria durante esta auditoría) · ⚠️ una fuente o práctica de taller · ❓ por validar.
>
> Los documentos se corrigieron en su lugar; cada cambio importante lleva una «Nota de auditoría:» en el texto. Este documento es la referencia única: si un número de 01–09 no coincide con §2, manda §2.

---

## 1. Resumen ejecutivo

1. **La investigación es buena y útil**, pero los siete autores trabajaron sin verse y dejaron **tres tipos de choque**: valores distintos para el mismo supuesto (E del triplay, fluencia, holgura de corredera, espesor de puerta, merma de barniz), nombres distintos para la misma pieza («entrepaño» y «repisa», «faja» y «travesaño», «canal» y «ranura») e **ids de TypeScript distintos para lo mismo** (`Tool` contra `ToolId`, `'pocket-screw'` contra `pocketScrew`, `shoeCabinet` contra `shoeRack`, tres enums de confianza, tres tipos de rango y dos numeraciones de reglas que chocan en R10–R12). Todo quedó unificado en §2 y §3.
2. **Rigidez (E) del triplay de pino: se adopta 4500 MPa con la veta a lo largo del claro en 18 mm**, por espesor (§2.1), y **2000 MPa con la veta cruzada**. 6000 MPa (lo de hoy y lo que defendía 01) es el valor de APA para especies del Grupo 1 (abeto Douglas, pino del sur); lo que se vende en México es pino radiata chileno, y su ficha **medida** (Eagon, 18 mm, 7 capas, EN 310) da **4742 MPa**, que verifiqué en el PDF. 4500 es el valor **conservador**; 6000, el optimista.
3. **Fluencia ×2** para toda carga que se queda puesta (NDS da K_cr = 2.0 para tableros; el Wood Handbook y el Eurocódigo coinciden). ×1 para cargas pasajeras (una persona). Se descarta el ×1.5, que es de la Sagulator y de la madera maciza.
4. **Umbral crítico de R1: L/100 sobre la flecha final** (recomendación: L/360). Con los supuestos nuevos, L/100 deja el claro crítico de una repisa de 18 mm con libros en **≈ 830 mm**, casi donde hoy lo pone L/200 con los supuestos viejos (≈ 800 mm) y donde el carpintero dice «ya no» (80–90 cm). Lo que cambia es la recomendación: baja de 656 a **≈ 540 mm**. Un pandeo es de apariencia, no de seguridad: el crítico de R1 debería decir «se va a ver muy pandeada» y no bloquear como un vuelco (decisión para el autor, §9).
5. **Correderas:** 12.7 mm por lado **+0.8 / −0** (verificado en la ficha de Accuride 3832EC). Knotty debe **diseñar la caja 26 mm más angosta que el hueco** (13 mm por lado), no con el nominal exacto como hoy (`cajon.ts:58`), y R9 debe dejar de aceptar −1 mm.
6. **Antivuelco desde 686 mm** (ASTM F2057-23; verifiqué en el Federal Register el calce de 10.9 mm, los 27.2 kg en la orilla del cajón, 136 kg/m³ de ropa y la fuerza de 44.5 N). La cómoda de triplay de 90 cm **se voltea sola con los cajones abiertos y llenos**: el kit antivuelco no es opcional.
7. **Colchones:** confirmé en Luuna que el **king mexicano mide 2000 de ancho × 1900 de largo** (más ancho que largo) y el queen 1500 × 1900. Hoy `typology.ts` da un **falso crítico** para una base correcta de queen o king mexicano.
8. **Fuentes:** de 330 direcciones, 290 responden 200. Rotas de verdad: 4 (§6). Otras 36 bloquean a los robots (403/429) y parecen vivas. Muchas citas marcadas con † son solo resúmenes del buscador.
9. **Lo que falta** es sobre todo del lado de la persona: costo total y presupuesto, retazos, seguridad infantil, formaldehído (E1/E2/NAUF), responsabilidad legal de las recomendaciones, modo principiante e instrucciones imprimibles (§7).
10. **Primero en el código:** corredera (hoy acepta cajones que no entran), colchones (hoy rechaza bases correctas), E + fluencia + L/100 **juntos** (hoy subestima el pandeo), bisagra en 15 mm, umbral de 686 mm y bisagras por peso (§8).

---

## 2. Valores canónicos reconciliados

«Origen» es el documento donde está el detalle. Cuando dos documentos discrepaban, se indica cuál ganó.

### 2.1 Material (triplay de pino radiata, el de Home Depot MX y madererías)

| Supuesto | Valor canónico | Antes | Origen | Confianza |
|---|---|---|---|---|
| E∥ (veta de la cara a lo largo del claro), 18 mm | **4500 MPa** | 6000 (código y 01); 4500 (05) | 05 §1.2; Eagon medido 4742; APA Grupo 1 × 0.75 ≈ 4460 | ⚠️ conservador |
| E∥, 15 mm | **5000 MPa** | 6500 (01) | APA ⅝" 6500 × 0.75 ≈ 4900 | ⚠️ |
| E∥, 12 mm y 9 mm | **5500 MPa** | 7000 / 7500 (01) | APA ½" 7700 × 0.75 ≈ 5800; redondeado a la baja | ⚠️ |
| E⊥ (veta cruzada), 18 / 15 / 12 / 9 / 6 mm | **2000 / 1500 / 1000 / 800 / 700 MPa** | 3500 (código); 2000 fijo (05) | APA 1680 (5 capas) y Eagon 3912 (7 capas) acotan el de 18 mm | ⚠️ conservador |
| Valor «optimista» de referencia, 18 mm | 6000 ∥ / 3900 ⊥ | — | APA Grupo 1; Eagon ⊥ | — |
| Abedul báltico 18 mm | 9000 ∥ / 6900 ⊥ | — | 01 §6.2 (Riga) | ✅ |
| Fluencia (flecha final / inicial) | **2.0** con carga sostenida (libros, platos, ropa, TV); **1.0** con carga pasajera (persona, asiento) | 1.5 (código); 1.5/2.0 según carga (01) | 05 §1.3 (NDS, Eurocódigo 5, Wood Handbook) | ✅ |
| MOR (resistencia a flexión) | **40 MPa**; diseño con σ ≤ MOR / 3 | — | Eagon 44.2 ∥ / 39.9 ⊥ | ⚠️ |
| Densidad para peso (compra, transporte, bisagras, anclaje colgado) | **540 kg/m³** (hoja de 18 mm ≈ 28–29 kg) | 500 (02, 05) | 01 §5.3 (pesos de HD MX) | ✅ |
| Densidad para estabilidad (vuelco) | **500 kg/m³** (más ligero = peor caso) | — | Eagon | ⚠️ |
| Espesor real por omisión | nominal − 0.5 mm (18 → 17.5), editable; «mídelo con vernier» | nominal | 01 §5.1 | ⚠️ |
| Hoja | 2440 × 1218 mm, veta a lo largo; ancho por material (hay de 1210) | igual | 01 §5.2, D29 | ✅ |
| Refilado / corte de sierra / holgura por pieza | 15 / 4 / 2 mm | igual (PROPUESTA §6 dice 10: error) | 01 §9, D29 | ⚠️ |

### 2.2 Cargas y pandeo (R1)

| Supuesto | Valor canónico | Origen | Confianza |
|---|---|---|---|
| Cargas por área (`LoadCase.id`) | `none` 0 · `light` 50 · `medium` 100 · `heavy` («libros») 150 kg/m² | 05 §1.4 | ✅ |
| Biblioteca o archivo | 244 kg/m² (AWS) | 05 §1.4 | ✅ |
| Ropa en cajones | 136 kg/m³ (ASTM F2057) | 05 §1.4 | ✅ |
| Persona | 110 kg, factor dinámico × 2, sin fluencia | 05 §7.2 | ❓ |
| Recomendación | flecha final > **L/360** | 05 §1.5 | ✅ |
| Crítico | flecha final > **L/100** (hoy L/200) | 05 §1.5 | ⚠️ |
| Claro de repisa de 18 mm con libros | **540 mm** sin pandeo visible / **830 mm** límite | 05 §1.6 | ⚠️ cálculo |
| Con tira de pino de 18 × 40 pegada al frente | I × 3, claro × 1.45 (540 → 780 / 830 → 1200) | 05 §1.7 | ⚠️ cálculo |
| Veta cruzada, 18 mm, libros | ≈ 410 mm | 05 §1.6 | ⚠️ |

**Por qué L/100.** (a) La AWS acepta L/144 instantánea con 244 kg/m²; con libros (150) y fluencia ×2 eso equivale a L/117 final. (b) Con E 4500 y ×2, L/100 pone el crítico en 830 mm, prácticamente donde hoy lo pone L/200 con E 6000 y ×1.5 (≈ 800 mm): el cambio **no crea críticos nuevos**, solo mueve las recomendaciones hacia claros más cortos. (c) Coincide con la regla de taller «18 mm, no más de 80–90 cm». Con L/120 los críticos bajarían a ≈ 780 mm; queda como opción si el autor prefiere ser más estricto.

**Los tres cambios van juntos** (E, fluencia y L/100). Cambiar solo E y fluencia sin mover el crítico convertiría en críticos muchos libreros que hoy pasan.

### 2.3 Uniones, tornillos y herrajes

| Supuesto | Valor canónico | Origen | Confianza |
|---|---|---|---|
| Ranura (canal) | profundidad ≤ t/3 recomendado; > t/2 crítico | 02 §3 | ✅ |
| Rebaje | ≤ t/2 recomendado; > 2t/3 crítico (hoy usa el umbral de la ranura) | 02 C6 | ⚠️ |
| Tornillo a tope | penetración ≥ 25 mm; primero a 25–50 mm del extremo; separación 150–200 mm; receptor de 12 mm → #6 | 02 §7, §9 | ⚠️ |
| Tornillo de bolsillo | 25 mm (1") en 12–16 mm; 32 mm (1¼") en 18–19 mm; rosca gruesa | 02 §7 | ✅ |
| Tornillo de herraje | largo ≤ t − 3 | 02 §7 | ⚠️ |
| Tarugo | Ø 6 en 15 mm; Ø 8 en 18 mm; 100–150 mm entre centros; en la cara ≤ ⅔ t | 02 C5 | ⚠️ |
| Minifix 15 | tablero ≥ 16 mm (en 15, recomendación) | 02 C7 | ❓ (Häfele lo vende también para 15) |
| Sistema 32 | Ø 5 mm, cada 32, a 37 del frente; profundidad ≤ t − 5 (10 mm en 15, 13 en 18) | 02 §4 | ✅ / ⚠️ |
| Bisagra de cazoleta | Ø 35 × 13 mm (11–11.5 en bisagras económicas y de puerta delgada) | 02 §6.1 | ✅ |
| Espesor de puerta con cazoleta | **≥ 16 mm** sin aviso (18 ideal); **15 mm → recomendación**; **< 14 → crítico** salvo bisagra para puerta delgada | 02 C2 (05 decía 15) | ✅ |
| Bisagras por puerta | alto ≤ 900 / 1600 / 2000 / 2400 mm y peso ≤ 6 / 12 / 18 / 22 kg → 2 / 3 / 4 / 5; gana el mayor; +1 si la hoja mide 601–650 de ancho | 02 §6.1 (05 no tenía la tabla) | ✅ |
| Ancho máximo de puerta | 600 mm (601–650 con una bisagra más; más ancho, dos hojas) | 02, 04 | ✅ |
| Holgura de corredera de balines | **12.7 mm por lado, +0.8 / −0**; Ducasse 13 +0.5/−0.2 | 02 §6.3, 05 §4.1 (09 y 06 decían 12.5–13: error) | ✅ verificado |
| Caja del cajón (diseño) | **hueco − 26 mm** (13 por lado, centro de la tolerancia) | auditoría (Accuride sugiere 27: justo en el límite) | ⚠️ |
| Capacidad de corredera | Handy Home HD MX: 20 kg (parcial) / 30 kg (total); de marca: 45 kg por par | 02, 05 | ✅ |
| Fondo de cajón | 6 mm estándar; 3 mm solo < 300 mm de ancho (hoy 450); 9 mm (o 6 con travesaño) con carga pesada y > 600 de ancho | 05 §4.3 | ⚠️ cálculo |
| Pegamento (Resistol 850) | 15 min abierto; 30–40 min en prensa; 4 h para manipular; carga a las 24 h; 10–40 °C | 02 §5 (09 usaba Titebond) | ✅ |

### 2.4 Espesores mínimos por pieza

| Pieza | Mínimo | Típico | Origen |
|---|---|---|---|
| Laterales, piso, techo | 15 | 15–18 | 01 §10, 02 |
| Repisa | 15 con claro corto (usar R1) | 18 | 01, 05 |
| Puerta con cazoleta | 16 (15 con aviso) | 18 | 02 |
| Frente de cajón | 12 | 15–18 | 01 |
| Costados de cajón | 12 (13–16 con corredera bajo cajón) | 12–15 | 01, 02 |
| Fondo de cajón | 6 (3 si < 300 de ancho) | 6 | 05 |
| Trasera | 3 pegada en rebaje o ranura; 6 clavada y pegada | 6 | 05 §2 |
| Zoclo | 12 | 15–18 | 01 |
| Tablillas de cama | 18 × 100 | 18 × 100 | 05 §7.3 |

### 2.5 Tipologías, alturas y colchones

| Supuesto | Valor canónico | Hoy en código | Origen | Confianza |
|---|---|---|---|---|
| Colchón individual | 1000 × 1900 (acepta 990) | 990 × 1900 | 04 §2.7, Luuna | ✅ verificado |
| Matrimonial | 1350 × 1900 (1350–1370) | igual | ídem | ✅ |
| Queen MX / EE. UU. | **1500 × 1900** / 1520 × 2030 | 1520 × 2000 | ídem | ✅ |
| King MX / EE. UU. | **2000 (ancho) × 1900 (largo)** / 1930 × 2030 | 1930 × 2000 | ídem | ✅ |
| Cuna | 700 × 1300 | — | 04 | ✅ |
| Grosor de colchón | 200–320, típico 260 | — | 04 | ✅ |
| Separación entre tablillas | ≤ 75 mm | — | 05 §7.3 | ✅ |
| Claro de tablilla de 18 × 100 | ≤ 700 mm (hoy `BED_SPAN` 800) | 800 | 05 §7.3 | ❓ |
| Escritorio | 740 (680–780) | 700–780 | 04 §2.1 | ✅ |
| Hueco para piernas | 600 ancho × **650** alto × 450 (rodillas) / 600 (pies) | alto 620 | 04 §2.1 | ✅ |
| Mesa de comedor / centro / lateral | 750 (700–780) / 430 (380–500) / 600 (450–650) | 720–770 / 350–500 / 450–650 | 04 | ✅ / ✅ / ❓ |
| Barra de cubierta / barra alta | 900 (860–915) / 1070 (1020–1100) | no existe | 04 | ✅ |
| Banca / banco de barra | 450 (400–480) / 610–800 | 420–480 / no existe | 04 | ✅ |
| Cocina: cubierta, fondo, alacena | 900; 600 (520–600); fondo de alacena 330 | — | 04 §2.3 | ✅ |
| Clóset: fondo, barra | 580–600 (650 con corredizas); barra 1680–1730; doble 1020 y 2030 | fondo mín. 550 | 04 §2.4 | ✅ |
| Librero: fondo | 200 bolsillo / 280 común / 330 grande / 350 LP | mín. 230 | 04 §2.5 | ⚠️ |
| Alcance cómodo | 380–1220 | — | 04 §2.13 | ✅ |
| Zoclo | 80–100 × 50 en cocina; 50–70 en recámara | 70 × 30 | 04 §5.1 | ⚠️ |
| Separación entre frentes | 2–3 mm (hoy 2) | 2 | 04 | ⚠️ |

### 2.6 Vuelco, anclaje y muros

| Supuesto | Valor canónico | Origen | Confianza |
|---|---|---|---|
| Umbral de anclaje | **686 mm** para todo mueble de guardado con cajones o puertas (hoy 700 en cajonera y 1500 en clóset); detectar por geometría, no por nombre | 04, 05 | ✅ |
| Prueba de estabilidad (R11) | cajones y puertas abiertos, ropa 136 kg/m³, 27.2 kg en la orilla del cajón más alto ≤ 1422 mm, calce de 10.9 mm, 44.5 N horizontal | 05 §6, Federal Register | ✅ verificado |
| Libreros sin cajones | R4: alto/fondo ≥ 3 → recomendación; ≥ 4 con alto > 1200 → crítico; recomendar anclaje desde 1200 | 05 §6.3, 04 §5.1 | ⚠️ |
| Kit antivuelco | resiste 222 N (ASTM F3096); al poste o muro sólido, nunca a la trasera | 06, 09 | ✅ |
| Tablaroca 12.7 mm, taquete de mariposa 6 mm | 27 kg de trabajo por taquete | 05 §8.2 | ✅ |
| Block hueco, mariposa 6 mm | 32 kg a extracción | 05 §8.2 | ✅ |
| Tabique rojo recocido, taquete 8 × 40 | **30 kg** (la mitad de los 61 de fischer en ladrillo alemán) hasta validar | 05 §8.2 (09 decía «similar a concreto») | ❓ |
| Concreto, taquete 8 × 40 | 71 kg | 05 §8.2 | ✅ |
| Mueble colgado | extracción = peso × brazo / altura entre apoyos; listón de colgar de 18 × 80–100 o French cleat | 05 §8.1 | ✅ principio |

### 2.7 Acabados y cantos

| Supuesto | Valor canónico | Origen | Confianza |
|---|---|---|---|
| Litros de acabado | área × manos ÷ (rendimiento × **0.8**) | 03 decía +15–20 %; 08 decía ÷ 0.75 | ⚠️ |
| Lijado de caras | 120 → 180 → 220; 80 solo en cantos | 03 §2.1 | ✅ |
| Cubrecanto | ancho ≥ espesor + 1: 19–22 mm para 18; 16 mm para 12 y 15 (HD MX solo tiene preencolado de 16) | 01 §12, 08 §6.2 | ✅ |
| Sellador | de la misma familia que el acabado; nunca nitro bajo poliuretano | 03 §3 | ✅ |

---

## 3. Vocabulario canónico

Regla general: **la interfaz usa una sola palabra por concepto** (columna «Para la persona»); los sinónimos van a `aliases`. **Todo id y todo literal de enum va en inglés y en camelCase** (`pocketScrew`, `round3`, `shoeRack`), igual que los ids que ya existen (`shoeRack`, `wallCabinet`, `drawerFronts`). Los ids de **artículos de catálogo** siguen en kebab-case como hoy (`tornillo-8x1`, `kit-antivuelco`, `stain-walnut`).

### 3.1 Piezas y conceptos

| Concepto | Para la persona | Id (código) | Legacy | Notas |
|---|---|---|---|---|
| Tablero horizontal interior | **Repisa** (fija / móvil) | `shelf` + `mount: 'fixed' \| 'movable'` | `entrepano` | «entrepaño» solo como alias; 07 decía «Entrepaño» (corregido) |
| Tablero vertical exterior | **Lateral** | `side` | `lateral` | En el cajón: «costado» |
| Tablero de abajo | **Piso** | `bottom` | `piso` | No «base» |
| Tablero de arriba entre laterales | **Techo** | `top` | `techo` | |
| Tablero de arriba sobre los laterales | **Cubierta** | `topOver` (o `top` + `over`) | `techo` | |
| Tablero vertical interior | **Divisor** | `divider` | `divisor` | |
| Tablero de atrás | **Trasera** | `back` | `trasera` | |
| Tira de abajo al frente | **Zoclo** | `kick` | `zoclo` | |
| Tira que une laterales | **Travesaño** | `rail` + `position` | `faja` | «faja» no se muestra |
| Tablero bajo la cubierta de una mesa | **Faldón** | `apron` | — | |
| Tira de madera pegada al frente de una repisa | **Tira de refuerzo** (al frente) | `frontEdge` (fix `addFrontEdge`) | — | 05 §1.7 |
| Pata | **Pata** | `leg` | — | |
| Hueco cerrado fijo | **Tapa fija** | `fixedPanel` | `otro` | |
| Puerta | **Puerta** | `door` | `puerta` | «hoja» solo para el tablero de 1220 × 2440 |
| Piezas del cajón | **Frente del cajón / Costado del cajón / Contrafrente / Trasera del cajón / Fondo del cajón** | `drawerFront` / `drawerSide` / `drawerSubFront` / `drawerBack` / `drawerBottom` | `frente-cajon`, `costado-cajon` (hoy también para contrafrente y trasera: error), `fondo-cajon` | |
| Cuánto se comba una repisa | **Pandeo** («se pandea») | `deflection`; `R1_FLECHA`, `flecha()` se quedan | — | «flecha» nunca en la interfaz |
| Vuelco | **Vuelco** / «se va de frente» | `tipOver` | — | |
| Distancia libre entre apoyos | **Claro** | `span` | — | No «luz» |
| Espacio entre puertas | **Separación** | `gap` | — | |
| Espacio que pide un herraje | **Holgura** | `clearance` | `holguraLateral` | |
| Lo que sobresale la cubierta | **Vuelo** | `overhang` | `topOverhangs` | |
| Puerta que tapa el canto / que va dentro | **Sobrepuesta / Embutida** | `overlay` / `inset` | igual | |
| Tablero de 1220 × 2440 | **Hoja** | `sheet` | — | |
| Profundidad | **Fondo** | `depth` | `fondo` | La pieza es «fondo del cajón» completo |
| Tira que tapa el canto | **Cubrecanto** | `edgeBanding` | `cantos` | No «cantear» |

### 3.2 Uniones (`JointKind`)

| Para la persona | Id | Legacy |
|---|---|---|
| A tope con tornillo | `buttScrew` | `tope-tornillo` («tornillo al canto», «tornillo de tope») |
| Tornillo de bolsillo | `pocketScrew` | `bolsillo` |
| Tarugos | `dowel` | `tarugo` |
| Galleta | `biscuit` | — |
| Confirmat | `confirmat` | — |
| Minifix | `camLock` | `minifix` |
| **Ranura** (alias «canal») | `dado` (a través de la veta) / `groove` (a lo largo) | `canal` |
| Rebaje | `rabbet` | `rebaje` |
| Lengüeta | `tongueGroove` | — |
| Escuadra metálica | `angleBracket` | `escuadra` (02 decía `metal-bracket`) |
| Clavo y pegamento / grapa y pegamento | `nailGlue` / `stapleGlue` | `clavo-pegamento` |
| Inglete con tira | `splineMiter` | — |
| Cola de milano | `dovetail` | — |
| Perno desarmable | `knockDownBolt` | — |
| Soportes de repisa | `shelfPin` | `soporte-repisa` |
| Bisagras de cazoleta (recta / codo / **súper codo**) | `cupHinge` + `crank: 'straight' \| 'crank' \| 'superCrank'` | `bisagra-cazoleta` (06 decía «supercodo») |
| Bisagra de piano | `pianoHinge` | — |
| Correderas | `drawerSlide` + `mount: 'side' \| 'undermount'` | `corredera` (02 tenía `side-slide` y `undermount-slide`) |

### 3.3 Enums y tipos compartidos

| Tipo | Definición canónica | Reemplaza |
|---|---|---|
| `ToolId` | `drill, impactDriver, countersink, hammer, circularSaw, tableSaw, jigsaw, router, pocketJig, dowelJig, biscuitJoiner, confirmatBit, forstner15, forstner35, shelfPinJig, nailGun, stapler, clamps, square, tape, sander, studFinder` (y `bevelGauge` si se usa) | `Tool` de 02 (kebab), `ToolId` corto de 07, listas de 06 y 09 |
| `SkillLevel` | `storeCuts, intermediate, fullShop` | 09 (sin cambio) |
| `FurnitureType` | `bookcase, shelvingUnit, cubeGrid, sideboard, tvUnit, nightstand, dresser, fileCabinet, shoeRack, wardrobe, kitchenBase, wallCabinet, pantry, vanity, coffeeTable, sideTable, diningTable, desk, workbench, counter, dressingTable, bench, stool, platformBed, storageBed, headboard, floorBed, bunkBed, crib, wallShelf, pegboard` | 04 (`shoeCabinet` → `shoeRack`, `kitchenWall` → `wallCabinet`); legacy de `typology.ts`: `drawers` → `dresser`/`nightstand`, `table` → tres mesas, `bed` → `platformBed` |
| `MmRange` | `{ min, typical, max }` en mm (07 §3.3); con `sources` y `confidence` vía `sourced()` | `Range` de 04 |
| `MinMax` | `{ min, max }` para tolerancias y separaciones | `Range` de 02 |
| `Confidence` | `verified \| singleSource \| toValidate` (✅ ⚠️ ❓) | tres versiones (02, 04, 05) |
| `SourceRef.strength` | `standard \| manufacturer \| measured \| shopRule \| assumption` | 07 (`shop-rule`) |
| `LoadCase.id` | `none, light, medium, heavy, dishes, clothes, tv, person, file` (`heavy` = «libros») | 05 usaba `books` |
| `EdgeProfile` | `square, eased, round3, round6, chamfer3, chamfer6, bullnose` | 08 (kebab); `EdgeTreatment` de 01 |
| `EdgeBanding` | `none, veneer, pvc, melamine, solidWood` | 08 |
| `FinishKind` (apariencia en 3D) | `natural, oil, varnish, stain, paint, whitewash, laminate` | 08 |
| `FinishFamily` (química, reglas F1–F8) | `none, oil, wax, nitroLacquer, catalyzedLacquer, pu1kSolvent, pu1kWater, pu2k, alkydMarine, colorVarnishWater, paintEnamel, melamine, hpl, veneer` | 03 (kebab). Un `FinishPreset` lleva los dos |
| `Exposure` | `interior, kitchen, bathroom, kids, foodContact, exteriorCovered, exterior` | 03 |

---

## 4. Numeración única de reglas

| Código | Qué revisa | Estado |
|---|---|---|
| R1_FLECHA … R10_USO | las de hoy (`PROPUESTA.md` §5) | ajustes en §8 |
| R11_TIP_OPEN | vuelco con cajones y puertas abiertos | nueva (05) |
| R12_SLIDE_CAPACITY | carga del cajón contra la corredera | nueva (05; 02 la había puesto dentro de R9) |
| R13_DRAWER_BOTTOM … R22_LEGS | fondo de cajón, peso de puerta, tira de refuerzo, anclaje a muro, repisa flotante, mesas, asientos, tablillas, ahorro, patas | nuevas (05) |
| **R23_HARDWARE_SCREW** | tornillo de herraje que atraviesa la pieza | nueva (02 la llamaba R10: chocaba con `R10_USO`) |
| **R24_SHELF_PIN_DEPTH** | profundidad de la perforación del sistema 32 | nueva (02 la llamaba R11: chocaba con R11_TIP_OPEN) |
| `hingeTypeFor` | recta / codo / súper codo por geometría | inferencia, sin código R (02 la llamaba R12) |
| M1–M7 | material (espesor real, cubrecanto, MDF en baño) | 01 |
| F1–F8 | acabados | 03 |

---

## 5. Correcciones hechas a cada documento

**01 — Triplay.** Nota de auditoría con los E canónicos y la razón (radiata ≠ Grupo 1; Eagon 4742 verificado) en el resumen y tras el veredicto de §6.3; tablas §14.1 y constantes §14.2 (`PINE_PLYWOOD_MOE_MPA`, `CREEP_FACTOR`) cambiadas al canónico; puerta con cazoleta: mínimo 16 (antes 15) y profundidad ✅; fondo de cajón de 3 mm solo < 300 (antes 450); tolerancia de las seccionadoras matizada; «entrepaño» → «repisa» en todo el texto y en los mensajes para la persona; nota sobre la tira de refuerzo (I × 3 con 18 × 40).

**02 — Uniones y herrajes.** Notas de auditoría en bisagra (≥ 16, 15 con aviso, < 14 crítico; puerta delgada Blum 8–14) y en corredera (+0.8/−0 verificado; diseñar con 26 mm, no 27); kit antivuelco con los criterios completos de F2057; C1 con la corrección de `cajon.ts`; reglas renumeradas (R23, R24, R12, R11) con nota; bosquejo Zod unificado (`JointKind` y `ToolId` en camelCase, `MinMax`, `Confidence`); «Canal» → «Ranura» para la persona; barreno de paso 4.4 mm (antes 4.4 y 4.5 en dos lugares); FAQ 4 y 8.

**03 — Acabados.** Corregido «el pino es madera de poro grande» (es conífera, no tiene poro; se mancha por la diferencia entre madera temprana y tardía); lija de agua (Fandeli, Truper) agregada; merma unificada en ÷ 0.8; `FinishFamily`, `Exposure` y pasos en camelCase, con nota de cómo se relaciona con `FinishKind` de 08.

**04 — Tipologías.** §1.6: corregido «el pino común usa adhesivo que no es de exterior» (el AraucoPly es fenólico; el problema es la durabilidad del radiata, las grietas de torno y los cantos); librero: anclaje desde 686 (antes «~700»); nota en el claro de repisa (760–810 es «aceptable», no «recto»); FAQ 4 con 550 / 800 / tira de refuerzo; colchones verificados en Luuna y «preguntar la medida»; `FurnitureType` (`shoeRack`, `wallCabinet`), `Confidence` y nota de ids legacy.

**05 — Reglas estructurales.** Nota de reconciliación de E con valores por espesor y la ficha Eagon verificada; bisagra: nota contra el «mínimo 15 mm» y tabla de bisagras de 02; «faja» → «travesaño» y «entrepaño» → «repisa» en todo el documento; título de §1 «Flecha (pandeo) de repisas»; R6 con alto y peso; `SHELF_SAG.title`, roles, `LoadCase` (`heavy`) y `setJoint` con ids canónicos; FAQ 7 y 9; F2057 verificada; fuente [14] marcada.

**06 — Glosario.** Comas decimales → punto (México usa punto decimal); holgura de corredera corregida (12.5–13 → 12.7–13.5, diseño 13); «supercodo» → «súper codo»; «Molly» separado del taquete de mariposa; «Pandeo» como término para la persona; nota sobre 07 ya corregido; fuente [48] rota sustituida por la ficha del mismo SKU.

**07 — Arquitectura.** Marcadores `NN-*.md` sustituidos por `06-glosario.md` §1.1, `04-tipologias-y-medidas.md` §2.6 y `05-reglas-estructurales.md` §1 y §6, con anchors reales y una nota sobre acentos en los slugs; `label: "Entrepaño"` → «Repisa» con alias; `ToolId` completo; `strength: 'shopRule'`; título de la regla de pandeo; zapatera con anclaje desde 686 (antes 900) y prehecho anclado.

**08 — Estilo visual.** `EdgeProfile` y `EdgeBanding` en camelCase (+ `melamine`); merma 0.75 → 0.8 y ejemplo recalculado (2.8 L); «entrepaño» → «repisa»; fuente de cubrecanto con el SKU alterno.

**09 — Fabricación.** Comas decimales → punto; corredera (antes «25–26 mm, 12.5–13 por lado»: con 25 el cajón no entra); profundidad de ranura ✅ desde 02; tiempos del Resistol 850 como valor por omisión; IARC: el formaldehído es Grupo 1 desde 2004 (vol. 88), no desde el vol. 62; transporte (casi ninguna pickup tiene caja de 2.44 m: flete o piezas cortadas); tabique rojo a la mitad de la carga, no «como concreto»; `ToolId` unificado; fuente [41] marcada.

---

## 6. Fuentes rotas o dudosas

Revisadas con `curl` el 2026-09-25 (330 direcciones; 290 responden 200, y los títulos de página no muestran «no encontrado»).

**Rotas:**

| Dirección | Dónde | Qué pasa | Acción |
|---|---|---|---|
| `accuride.com/hardware/Model-3832` | 05 [14] | ciclo de redirecciones 301 | Marcada; el PDF de la misma fuente sí abre |
| `homedepot.com.mx/b/materiales-de-construccion/melamina/cubrecanto-de-madera-16-mm-838882` | 06 [48] | 404 | Sustituida por la ficha `/p/…-838882` |
| `tablaroca.org/taquetes/` | 09 [41] | 522 (servidor caído) | Marcada; el dato (plástico 2–8 kg) queda sin reverificar |
| `coppel.com/routers-fresadoras-y-rebajadoras` | 06 y 09 [18] | sin respuesta | Sin acción: la otra mitad de la cita (HD MX) sí abre |

**Bloquean robots (403 o 429), probablemente vivas:** CPSC (FAQ, literas, cunas), anchorit.gov, RAE, ResearchGate (2), academia.edu, doi.org de *Forests*, socomi.com (APA; responde 206 con GET), fpl.fs.usda.gov (1989), Häfele México (2), Leroy Merlin, SGS Engineering, Essentra, BS Fixings, Canadian Woodworking, Woodworkers Source, Woodworking Network, wwhardware, El Mueble, TrueTips, Wayfair (2), Accuride 3832E (406), festoolownersgroup, amazon.com.mx (405 con HEAD, 200 con GET). Woodworking Talk responde 202. Las dos de Wikipedia con paréntesis (`Router_(woodworking)`, `Taco_(construcción)`) están bien.

**Dudosas por su naturaleza:**
- Las marcadas con † en 04 son **resúmenes del buscador**, no páginas leídas. Varias (TrueTips, Alcovio, Layoutr, Homenish) son blogs de contenido genérico: sirven para rangos, no para reglas.
- 05 [25] (Promob) cita una «NOM-167-SCFI-2009» que no aparece en el DOF: no usar.
- 09 [26] (cercademiubicacion.com.mx) y [46] (TikTok) para costos de corte: anecdóticos.
- 02 [4], [21], [27] (calculadoras y blogs) sostienen reglas de tarugo y ranura: confirmar con una fuente de fabricante.
- 01 [30], [32], [36], [41], [42], [43] son resultados de búsqueda.
- La ficha de Eagon (05 [7]) es **de un fabricante chileno distinto de Arauco**; confirma el orden de magnitud del radiata, no el triplay exacto de Home Depot MX.

**Datos críticos verificados en esta auditoría (WebFetch y PDF):** Eagon 18 mm (E∥ 4742, E⊥ 3912, MOR 44.18 / 39.91, 7 capas, 500 kg/m³); Accuride 3832EC (12.7 +0.8/−0, 45.5 kg por par, «27.0 mm less than cabinet opening»); Federal Register F2057-23 (686 mm, 13.6 kg, 90.6 L, 8.5 lb/pie³, calce de 0.43", 60 lb, 10 lbf a ≤ 56"); Luuna (100 / 135 / 150 / 200 × 190); Blum CLIP top (estándar hasta ≈ 24 mm; puerta delgada 8–14 mm).

---

## 7. Lo que la investigación no consideró (y debería)

| Tema | Por qué importa | Propuesta |
|---|---|---|
| **Costo total y presupuesto** | La persona decide por dinero: hojas + herrajes + pegamento + acabado + lija + cortes + flete. Hoy cada documento da piezas sueltas. | «Costo estimado» con desglose y un **tope de presupuesto** que la app respete (bajar a T15 donde se pueda, trasera de 3 en rebaje, R21). Mostrar el costo por hoja extra: «con 20 cm menos de ancho te ahorras una hoja ($1000)». |
| **Desperdicio y retazos** | Un mueble chico usa 1.3 hojas y deja 0.7 tirada. | Mostrar el % de aprovechamiento y los retazos útiles (> 300 × 300) como inventario del taller; sugerir la ¼ de hoja (610 × 1220) cuando baste; proponer piezas de un segundo mueble con el sobrante. |
| **Humedad y aclimatar** | En la costa el triplay gana humedad después de comprarlo; se alabea si se guarda recargado. | Paso 0 en las instrucciones: 2–7 días acostada sobre separadores en el cuarto; acabar las dos caras igual (01 §8, 03 F5). |
| **Seguridad infantil** | Vuelco, dedos en puertas y cajones, esquinas, pintura. | Pregunta «¿hay niñas o niños en casa?» que active: anclaje obligatorio, redondeo de esquinas (r ≥ 3), topes de cajón, bisagras con cierre suave, acabados base agua curados 7 días, nada de cuna ni litera generadas como «seguras». |
| **Accesibilidad** | Personas mayores o en silla de ruedas. | Modo que use los rangos de NMX-R-050 (alcance 400–1200, jaladeras 900–1200, hueco libre bajo cubierta 730) y prefiera jaladeras de barra y correderas de extensión total. |
| **Desarmable para mudanza** | Mucha gente renta y se muda. | Opción «desarmable» que cambie a minifix o perno KD, módulos ≤ 1800 mm, trasera atornillada; revisar «¿pasa por la puerta?» (09 §8.3) en todo diseño. |
| **Ecología y certificación** | FSC y PEFC existen en triplay chileno (Arauco); el MDF y el aglomerado emiten más. | Campo `certification` en el material; mencionarlo sin prometer. |
| **Formaldehído (E1/E2/NAUF, CARB P2, TSCA VI)** | Los adhesivos UF de interior emiten formaldehído (Grupo 1 IARC); el fenólico emite mucho menos; en recámaras de bebé importa. | Campo `emissionClass` (`E0`, `E1`, `E2`, `NAUF`, `unknown`); recomendación en cuartos infantiles: fenólico, NAUF o E1 y ventilar 1–2 semanas. En México no hay NOM equivalente ❓. |
| **Garantía y responsabilidad legal** | Knotty da recomendaciones estructurales (vuelco, anclaje, camas, asientos) sin norma mexicana y con supuestos no calibrados. | Aviso claro y constante: «cálculo orientativo, no sustituye a un profesional»; no mostrar nada como «certificado»; no generar cuna, litera ni silla; registrar la versión del conocimiento en cada dictamen (07 §7). Revisión legal antes de publicar. |
| **Modo principiante** | El nivel 1 (09) no tiene sierra, router ni prensas suficientes. | Perfil de herramientas al inicio; con nivel 1, solo uniones a tope, trasera clavada y cortes en tienda; lenguaje sin jerga; un solo espesor de casco. |
| **Instrucciones imprimibles** | En el taller no hay pantalla limpia. | PDF de una hoja: lista de corte (formato de 09 §2.4), lista de compra, pasos numerados con dibujo y casillas para palomear. |
| **Lista para el mostrador y WhatsApp** | La persona llama a la maderería. | Texto plano copiable; ya lo propone 09, falta darle prioridad. |
| **Tiempo de calendario** | El acabado domina (3 manos + 7 días). | «Listo para usar el sábado 12» en vez de horas sueltas. |
| **Herramienta prestada o rentada** | Muchos no compran router. | Sugerir pedir el servicio a Placacentro o maderería (cazoletas, ranuras, cubrecanto) antes que comprar herramienta. |
| **Clima y temperatura del pegado** | El Resistol 850 pide ≥ 10 °C: en la sierra en invierno no pega bien. | Aviso estacional en el paso de armado. |
| **Plagas (termita, polilla)** | En costas y zonas cálidas. | Mencionar triplay fenólico y sellado de cantos; no inventar tratamientos. |

**Lo que Knotty NO debería hacer:**
- Generar como «segura» una cuna, una litera, una silla, un columpio o un mueble que cargue personas en altura (04 §4 ya lo dice: mantenerlo).
- Decir «certificado», «cumple la norma» o «aguanta X kg» sin factor de seguridad y sin «estimado».
- Recomendar colgar de la trasera, de tablaroca sin poste o con taquetes de plástico en block hueco.
- Proponer uniones que la persona no puede hacer con su herramienta (09 §1.3).
- Dar precios como definitivos o prometer que la tienda corta gratis.
- Proponer MDF o aglomerado estándar en baño o exterior.
- Ocultar un aviso de vuelco porque la persona «lo aceptó» sin decirle qué acepta (D37: dejarlo visible en la ficha).

---

## 8. Cambios al código

### 8.1 Corregir primero (hoy dan resultados incorrectos)

| # | Archivo | Problema hoy | Cambio | Por qué primero |
|---|---|---|---|---|
| 1 | `src/domain/estructura/reglas/cajones.ts:18` + `supuestos.ts:49` (`toleranciaCorredera: 1`) | Acepta 11.7 mm por lado: **aprueba cajones que no entran** | Tolerancia asimétrica `{ under: 0, over: 0.8 }`; < nominal → crítico, > nominal + 0.8 → recomendación | Error físico; la persona corta mal |
| 2 | `src/domain/operaciones/cajon.ts:58` (`lado = corredera.holguraLateral`) | Diseña la caja al nominal exacto: medio milímetro de error de corte la deja fuera | `lado = holguraLateral + 0.3` (13 mm con 12.7; caja = hueco − 26) | Ídem |
| 3 | `src/domain/typology/typology.ts:29` (`MATTRESSES`) y `:71` (`sort`) | Queen 1520 × 2000 y king 1930 × 2000; y reordena ancho y largo: **falso crítico** en bases correctas de queen y king mexicanos | Variantes `queenMx` 1500 × 1900, `queenUs` 1520 × 2030, `kingMx` 2000 × 1900, `kingUs` 1930 × 2030; individual 1000; no reordenar; preguntar el colchón | Bloquea diseños buenos |
| 4 | `src/domain/estructura/supuestos.ts:7-9, :14` (`moduloElasticidad`, `fluencia`, `limiteFlecha`) y `reglas/flecha.ts` | E 6000/3500 y ×1.5 **subestiman el pandeo ≈ 45 %** (la flecha real es ≈ 1.8 veces la calculada) | E por espesor del material (§2.1), fluencia 2.0 (1.0 si la carga no es sostenida), crítico L/100; **los tres en el mismo PR**, con prueba de regresión de la tabla de 05 §1.6 | Resultado estructural incorrecto |
| 5 | `supuestos.ts:25` (`'bisagra-cazoleta': { a: 15 }`) | Puerta de 15 mm pasa sin aviso | ≥ 16 sin aviso; 15 → recomendación; < 14 → crítico | La bisagra se arranca con el uso |
| 6 | `typology.ts:142` (cajonera > 700) y `:167` (clóset > 1500) | Umbrales distintos de F2057; detección por nombre | 686 mm para todo mueble con cajones o puertas; detectar por geometría (≥ 1 grupo `cajon-*` o puertas) | Seguridad |
| 7 | `supuestos.ts:44` + `reglas/uso.ts` (bisagras 2/3/4 por alto 900/1500) | No cuenta el peso; salta a 4 en 1500 | Tabla de 02 §6.1 por alto **y** peso (densidad 540) | Puertas que se descuelgan |
| 8 | `supuestos.ts:52` (`anchoFondoDelgado: 450`) | Fondo de 3 mm aceptado hasta 450 de ancho | 300 | Fondos vencidos |
| 9 | `src/domain/diseno/joints.ts:54` | Siempre `bisagra-cazoleta-35-recta`, aunque la puerta sea embutida o comparta lateral | `hingeTypeFor` por geometría (recta / codo / súper codo) | Lista de compra equivocada |
| 10 | `public/catalogo/catalogo.json` | R3 sugiere tornillo de bolsillo de 1" que **no existe** en el catálogo; `cubrecanto-19` que HD MX no vende (tiene 16); TR6 a $480 (HD: $315) | Agregar `tornillo-bolsillo-1`, `tornillo-6x3/4`, `tornillo-6x1`; cubrecanto de 16 y de 22 con nota de dónde se consigue; revisar TR3 y TR6; agregar `capacidadKg` a correderas | Lista de compra imposible |
| 11 | `typology.ts:32` (`KNEE.height: 620`) | Menos que EN 527 (650) | 650 | Escritorios incómodos que pasan |
| 12 | `supuestos.ts:22-23` (`canal` y `rebaje` con el mismo umbral) | El rebaje se marca con el umbral de la ranura | Rebaje ≤ ½ / crítico > ⅔ | Falsos avisos |
| 13 | `supuestos.ts:19` (`tarugo: 15/15` sin diámetro) y `joints.ts` `screwFor` | Tarugo de 8 en 15 mm; #8 al canto de 12 | Ø 6 en 15; #6 al canto de 12 | Canto que se abre |
| 14 | `reglas/flecha.ts` (`reglaFlecha`) | Posible falso positivo en un piso que descansa en el suelo (05 §1.8) | Excluir `caja.y0 ≈ 0` como hace `reglaBase`; confirmar con prueba | Aviso falso |
| 15 | `docs/PROPUESTA.md` §6 | «refilado (10 mm)»; D29 y el catálogo usan 15 | Corregir el texto | Deriva documental |

### 8.2 Mejoras nuevas (después)

1. `domain/knowledge/` con vocabulario, materiales y parámetros de reglas (07 K0–K2), usando los ids de §3.
2. E por material en el catálogo (`StructuralProps`), espesor real editable y calibración casera de E (01 §6.3, 05 §1.9, 07 §7.3).
3. Solución `addFrontEdge` (tira de refuerzo 18 × 40) como primera alternativa de R1, antes de subir espesor.
4. R11 (vuelco con cajones abiertos) y R16 (anclaje por tipo de muro, preguntando el muro).
5. R12 (capacidad de corredera), R13 (fondo de cajón por cálculo), R14 (peso de puerta y alabeo > 1800).
6. Tipos que faltan (`headboard`, `counter`, `stool`, `workbench`, …) y detección por `kind` declarado, no por nombre (04 §5.2).
7. Plantillas y prehechos (04 §4; 07 §3.8).
8. Instrucciones de armado deterministas y lista de corte para mostrador (09 §11), imprimibles.
9. Perfiles de canto y acabados en 3D (08, orden E0 → E1 → E3 → E2).
10. Lista de compra con acabado, lija, pegamento y costo total con presupuesto (03 §17, 08 §6.2, §7 de este documento).
11. Perfil de la persona: herramientas, niños en casa, muro, colchón, desarmable.

---

## 9. Decisiones que le tocan al autor

1. **E conservador (4500) o central (≈ 5000–5500) para 18 mm.** La auditoría recomienda 4500 hasta hacer la prueba casera con hojas de Home Depot MX; con 5000 los claros suben ≈ 4 %.
2. **¿El crítico de R1 bloquea?** Hoy «crítico» entra en `criticosNuevos` y frena cambios. Un pandeo es estético: propuesta de que R1 nunca pase de «recomendación fuerte» salvo cargas de personas (asientos, camas).
3. **L/100 o L/120** para el crítico.
4. **686 mm para todo mueble con cajones o puertas**, o solo para muebles de ropa (lo literal de F2057). La auditoría recomienda todo.
5. **Qué pasa con lo ya aceptado** cuando cambian E, fluencia y umbrales (07 §7.1: reabrir solo si empeora).
6. **Colchón:** preguntar siempre la medida, o asumir la variante mexicana por omisión.
7. **Densidad:** 540 para peso y 500 para vuelco (dos números) o uno solo.
8. **Convención de ids:** camelCase para ids y enums, kebab-case para artículos de catálogo (§3); confirmarla en D33.
9. **Aviso legal** y alcance: qué tipologías se niegan (cuna, litera, silla) y con qué texto.
10. **«Ranura» o «canal»** para la persona: la auditoría eligió «Ranura» (06); en taller mexicano se oyen las dos.
11. **Modo principiante** como perfil inicial obligatorio o como ajuste.
