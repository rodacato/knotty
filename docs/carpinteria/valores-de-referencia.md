# Valores de referencia

Los números de oficio para hacer muebles de triplay en México, reunidos en un solo lugar. Cada valor dice cuánto, en qué unidad, cuándo aplica, qué tan seguro es y qué documento lo explica con calma. Cuando las fuentes no coincidían, se indica en una línea por qué se eligió el valor.

Todo va en milímetros; las pulgadas aparecen solo como designación comercial, p. ej. «32 mm (1¼")». El material de referencia es el **triplay de pino radiata** que se vende en Home Depot México y en las madererías; si usas otro tablero, revisa la sección de material.

**Confianza:** ✅ dos fuentes o más, o verificado en la fuente primaria · ⚠️ una sola fuente, práctica de taller o cálculo propio · ❓ por validar · † el dato viene de un resumen del buscador, no de la página leída. Los números entre corchetes remiten a las [fuentes](#fuentes).

**Abreviaturas:** t = espesor del tablero · L = claro (distancia libre entre apoyos) · E = módulo de elasticidad (rigidez) · ∥ con la veta de la cara a lo largo del claro · ⊥ con la veta cruzada.

---

## 1. Material

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| E∥, 18 mm | **4500** | 4742 medido en radiata chileno; 6000 optimista | MPa | Cálculo de pandeo con la veta a lo largo del claro | ⚠️ conservador [1][2] | [triplay.md](triplay.md), [estructura.md](estructura.md) |
| E∥, 15 mm | **5000** | — | MPa | ídem | ⚠️ [1] | [estructura.md](estructura.md) |
| E∥, 12 mm y 9 mm | **5500** | — | MPa | ídem | ⚠️ [1] | [estructura.md](estructura.md) |
| E⊥, 18 / 15 / 12 / 9 / 6 mm | **2000 / 1500 / 1000 / 800 / 700** | 18 mm: entre 1680 (5 capas) y 3912 (7 capas) | MPa | Pandeo con la veta atravesada | ⚠️ conservador [1][2] | [estructura.md](estructura.md) |
| E optimista, 18 mm | 6000 ∥ / 3900 ⊥ | — | MPa | Solo como cota superior o para triplay de especies más rígidas | — [1][2] | [triplay.md](triplay.md) |
| Abedul báltico, 18 mm | 9000 ∥ / 6900 ⊥ | — | MPa | Triplay de abedul ruso o báltico | ✅ [3] | [triplay.md](triplay.md) |
| MOR (resistencia a flexión) | **40** | 44.2 ∥ / 39.9 ⊥ medido | MPa | Revisar ruptura; diseñar con esfuerzo ≤ MOR / 3 | ⚠️ [2] | [estructura.md](estructura.md) |
| Densidad para calcular peso | **540** | hoja de 18 mm ≈ 28–29 kg | kg/m³ | Compra, transporte, peso de puertas, muebles colgados | ✅ [9] | [triplay.md](triplay.md) |
| Densidad para estabilidad | **500** | — | kg/m³ | Cálculo de vuelco (más ligero = peor caso) | ⚠️ [2] | [estructura.md](estructura.md) |
| Espesor real | **nominal − 0.5** (18 → 17.5) | la norma permite 17.1–18.1 en 18 mm | mm | Siempre: mídelo con vernier en tres puntos antes de ranurar o escoger tornillos | ⚠️ [10] | [triplay.md](triplay.md) |

**Por qué 4500 MPa y no 6000.** 6000 MPa es el valor de APA para especies del Grupo 1 (abeto Douglas, pino del sur). Lo que se vende en México es pino radiata chileno, y su ficha **medida** (18 mm, 7 capas, EN 310) da 4742 MPa; el valor de APA × 0.75 da ≈ 4460. Se toma 4500 como valor conservador; los de 15, 12 y 9 mm salen de APA × 0.75, redondeados a la baja.

## 2. Hoja y corte

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Medida de la hoja | **2440 × 1220** nominal (útil 2440 × 1218) | hay hojas de 1210 de ancho: revisa la que compras | mm | Planear el despiece | ✅ [9][11] | [triplay.md](triplay.md) |
| Dirección de la veta | a lo largo del lado de 2440 | — | — | Cortar repisas con la veta a lo largo del claro | ✅ | [triplay.md](triplay.md) |
| Refilado de la orilla de la hoja | **15** | — | mm | Descontar del borde de fábrica antes de acomodar piezas | ⚠️ | [triplay.md](triplay.md), [fabricacion-y-armado.md](fabricacion-y-armado.md) |
| Ancho de corte de la sierra | **4** | — | mm | Entre pieza y pieza en el despiece | ⚠️ | [triplay.md](triplay.md) |
| Holgura por pieza | **2** | — | mm | Margen para error de corte | ⚠️ | [triplay.md](triplay.md) |
| Costo de corte en maderería | $10–30 por corte | algunas cortan gratis con la compra | MXN | CDMX, 2026; pregunta antes | ⚠️ [12] | [fabricacion-y-armado.md](fabricacion-y-armado.md) |

## 3. Espesores por pieza

| Pieza | Mínimo | Típico | Nota | Ver |
|---|---|---|---|---|
| Laterales, piso, techo | 15 mm | 15–18 mm | | [triplay.md](triplay.md), [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Repisa | 15 mm con claro corto | 18 mm | Revisar pandeo (§4) | [estructura.md](estructura.md) |
| Puerta con bisagra de cazoleta | 16 mm (15 con bisagra adecuada) | 18 mm | Ver §8 | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Frente de cajón | 12 mm | 15–18 mm | | [triplay.md](triplay.md) |
| Costados de cajón | 12 mm (13–16 con corredera bajo cajón) | 12–15 mm | | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Fondo de cajón | 6 mm (3 si mide < 300 de ancho) | 6 mm | Ver §9 | [estructura.md](estructura.md) |
| Trasera | 3 mm pegada en rebaje o ranura; 6 mm clavada y pegada | 6 mm | La trasera escuadra el mueble | [estructura.md](estructura.md) |
| Zoclo | 12 mm | 15–18 mm | | [triplay.md](triplay.md) |
| Tablillas de cama | 18 × 100 mm | 18 × 100 mm | Ver §11 | [estructura.md](estructura.md) |

## 4. Pandeo

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Fluencia (flecha final ÷ flecha inicial) | **2.0** | — | factor | Carga que se queda puesta: libros, platos, ropa, TV | ✅ [4][5][6] | [estructura.md](estructura.md) |
| Fluencia, carga pasajera | **1.0** | — | factor | Una persona, un asiento | ✅ [4][5][6] | [estructura.md](estructura.md) |
| Flecha final sin pandeo visible | **≤ L/360** | — | — | Meta de diseño | ✅ [7] | [estructura.md](estructura.md) |
| Flecha final límite | **≤ L/100** | L/120 si se quiere más estricto | — | Más allá, la repisa se ve muy pandeada | ⚠️ [7] | [estructura.md](estructura.md) |
| Claro de repisa de 18 mm con libros, sin pandeo visible | **540** | — | mm | Pino radiata, veta a lo largo | ⚠️ cálculo | [estructura.md](estructura.md) |
| Claro de repisa de 18 mm con libros, límite | **830** | regla de taller: 800–900 | mm | ídem | ⚠️ cálculo | [estructura.md](estructura.md) |
| Repisa de 18 mm con tira de pino de 18 × 40 pegada al frente | **780** sin pandeo visible / **1200** límite | rigidez × 3, claro × 1.45 | mm | Tira pegada en toda su longitud | ⚠️ cálculo | [estructura.md](estructura.md) |
| Repisa de 18 mm con veta cruzada, libros | ≈ **410** | — | mm | Cuando el despiece obliga a cortar atravesado | ⚠️ cálculo | [estructura.md](estructura.md) |

**Por qué fluencia ×2 y no ×1.5.** El 1.5 viene de calculadoras pensadas para madera maciza [8]; para tableros, la norma estadounidense de madera (NDS, K_cr = 2.0) [4], el Eurocódigo 5 [5] y el *Wood Handbook* [6] coinciden en 2.

**Por qué L/100 como límite.** El estándar de carpintería arquitectónica (AWS) acepta L/144 instantánea con 244 kg/m² [7]; con libros (150 kg/m²) y fluencia ×2 eso equivale a ≈ L/117 final. L/100 deja el límite de una repisa de 18 mm con libros en ≈ 830 mm, que coincide con la regla de taller «18 mm, no más de 80–90 cm». Un pandeo es un problema de apariencia, no de seguridad.

## 5. Cargas

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Sin carga | 0 | — | kg/m² | Repisa decorativa vacía | ✅ | [estructura.md](estructura.md) |
| Carga ligera | 50 | — | kg/m² | Ropa doblada, objetos ligeros | ✅ | [estructura.md](estructura.md) |
| Carga media | 100 | — | kg/m² | Trastes, despensa | ✅ | [estructura.md](estructura.md) |
| Carga pesada (libros) | 150 | — | kg/m² | Libros de uso doméstico | ✅ [7] | [estructura.md](estructura.md) |
| Biblioteca o archivo | 244 | — | kg/m² | Libreros y archiveros llenos a tope | ✅ [7] | [estructura.md](estructura.md) |
| Ropa en cajones | 136 | — | kg/m³ | Volumen interior del cajón | ✅ [13] | [estructura.md](estructura.md) |
| Persona | 110 kg × factor dinámico 2, sin fluencia | — | kg | Bancas, asientos, camas | ❓ | [estructura.md](estructura.md) |

## 6. Uniones

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Profundidad de ranura | **≤ t/3** (6 en 18 mm) | nunca > t/2 | mm | Ranura para repisa fija, trasera o fondo | ✅ [18][19] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Profundidad de rebaje | **≤ t/2** | nunca > 2t/3 | mm | Rebaje para trasera o esquina | ⚠️ [19] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Tornillo a tope: penetración en el canto | **≥ 25** | 51 mm (#8 × 2") para unir piezas de 18 | mm | Unión a tope con tornillo y pegamento | ⚠️ | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Tornillo a tope: distancia al extremo / separación | **25–50** / **150–200** | — | mm | ídem | ⚠️ | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Tornillo al canto de 12 mm | calibre **#6** | el #8 abre las capas | — | Receptor de 12 mm, sin carga fuerte | ⚠️ | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Tornillo de bolsillo | **25 (1")** en 12–16 mm; **32 (1¼")** en 18–19 mm | rosca gruesa | mm | Unión de bolsillo en triplay | ✅ [17] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Tornillo de herraje | largo **≤ t − 3** | — | mm | Bisagras, correderas, jaladeras por dentro | ⚠️ | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Tarugo | **Ø 6** en 15 mm; **Ø 8** en 18 mm | — | mm | Unión con tarugo y pegamento | ⚠️ [20] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Tarugo: separación / profundidad en la cara | **100–150** entre centros / **≤ ⅔ t** | — | mm | ídem | ⚠️ [20] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Minifix 15 | tablero **≥ 16** | en 15 mm funciona con cuidado | mm | Uniones desarmables | ❓ [21] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Pegamento blanco (Resistol 850) | 15 min abierto · 30–40 min en prensa · 4 h para manipular · **24 h para cargar** | trabajar entre 10 y 40 °C | — | Muebles de interior | ✅ [23] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |

**Minifix en 15 mm.** La regla general pide 16 mm o más, pero Häfele también lo vende para 15 [21]: por eso queda por validar.

## 7. Herrajes

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Sistema 32: perforación | **Ø 5**, cada **32**, a **37** del frente | — | mm | Soportes de repisa móvil y herrajes | ✅ [22] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Sistema 32: profundidad | **≤ t − 5** (10 en 15 mm, 13 en 18 mm) | — | mm | ídem | ⚠️ | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Cazoleta de bisagra | **Ø 35 × 13** | 11–11.5 de hondo en bisagras económicas o para puerta delgada | mm | Bisagra de cazoleta (recta, codo, súper codo) | ✅ [15][16] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |

## 8. Puertas

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Espesor de puerta con cazoleta | **≥ 16** (18 ideal) | 15: justo (quedan 2 mm de cara), mejor con cazoleta de 11–11.5; < 14 solo con bisagra para puerta delgada | mm | Puerta abatible con bisagra de cazoleta | ✅ [16] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Bisagras por altura de puerta | ≤ 900 → **2** · ≤ 1600 → **3** · ≤ 2000 → **4** · ≤ 2400 → **5** | — | mm → piezas | Gana el mayor entre altura y peso | ✅ [15][24] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Bisagras por peso de puerta | ≤ 6 → **2** · ≤ 12 → **3** · ≤ 18 → **4** · ≤ 22 → **5** | — | kg → piezas | ídem | ✅ [15][24] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Ancho máximo de una hoja | **600** | 601–650 con una bisagra más; más ancho, dos hojas | mm | Puerta abatible | ✅ [15] | [uniones-y-herrajes.md](uniones-y-herrajes.md), [muebles-y-medidas.md](muebles-y-medidas.md) |
| Separación entre frentes | **2–3** | — | mm | Entre puertas y frentes de cajón | ⚠️ | [muebles-y-medidas.md](muebles-y-medidas.md), [fabricacion-y-armado.md](fabricacion-y-armado.md) |

**Por qué 16 mm y no 15.** La cazoleta mide 13 mm de hondo: en 15 mm deja 2 mm de cara, poco para una bisagra común; el fabricante pide 16 o más [16]. Con 15 mm funciona una bisagra de cazoleta baja.

## 9. Cajones

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Holgura de corredera de balines | **12.7 por lado, +0.8 / −0** | Ducasse: 13 +0.5 / −0.2 | mm | Correderas laterales de balines | ✅ verificado [25][26] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Ancho de la caja del cajón | **hueco − 26** (13 por lado) | el fabricante sugiere − 27, justo en el límite | mm | Centro de la tolerancia: medio milímetro de error no te deja fuera | ⚠️ [25] | [uniones-y-herrajes.md](uniones-y-herrajes.md) |
| Capacidad de corredera económica | **20** (extensión parcial) / **30** (extensión total) | — | kg por par | Handy Home, Home Depot México | ✅ [27][28] | [estructura.md](estructura.md) |
| Capacidad de corredera de marca | **45** | — | kg por par | Libros, herramienta, archivo | ✅ [25] | [estructura.md](estructura.md) |
| Fondo de cajón | **6** | 3 solo si mide < 300 de ancho y carga ligera; 9 (o 6 con travesaño) con carga pesada y > 600 de ancho | mm | Fondo en ranura | ⚠️ cálculo | [estructura.md](estructura.md) |

**Por qué 12.7 y no 12.5–13.** Algunas fuentes redondeaban a 12.5 o 13 mm; la ficha de la corredera de referencia [25] da 12.7 +0.8 / −0: una corredera acepta un poco de más, nunca de menos.

## 10. Medidas de muebles y ergonomía

| Concepto | Valor recomendado | Rango | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Alto de escritorio | **740** | 680–780 | mm | Trabajo sentado | ✅ [33] † | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Hueco libre para piernas | **600** ancho × **650** alto × **450** (rodillas) / **600** (pies) de fondo | — | mm | Escritorio y tocador | ✅ [33] † | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Mesa de comedor | **750** | 700–780 | mm | | ✅ [34] † | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Mesa de centro | **430** | 380–500 | mm | | ✅ | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Mesa lateral | **600** | 450–650 | mm | | ❓ | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Barra a altura de cubierta | **900** | 860–915 | mm | | ✅ [34] † | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Barra alta | **1070** | 1020–1100 | mm | | ✅ [34] † | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Banca | **450** | 400–480 | mm | Asiento | ✅ | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Banco de barra | — | 610–800 | mm | Según alto de la barra | ✅ | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Cocina: alto de cubierta | **900** | — | mm | | ✅ [35] | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Cocina: fondo de gabinete bajo | **600** | 520–600 | mm | | ✅ [35] | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Cocina: fondo de alacena | **330** | — | mm | | ✅ [35] | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Clóset: fondo | **580–600** | 650 con puertas corredizas | mm | | ✅ [36] | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Clóset: altura de barra | **1680–1730** sencilla | doble barra: 1020 y 2030 | mm | | ✅ [36] | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Librero: fondo | **280** libros comunes | 200 bolsillo · 330 grandes o carpetas · 350 discos LP | mm | | ⚠️ [37] † | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Alcance cómodo | — | 380–1220 del piso | mm | Repisas y cajones de uso diario | ✅ [38] † | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Zoclo | **80–100** alto × **50** remetido en cocina | **50–70** alto en recámara | mm | | ⚠️ | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Alto del colchón al piso | **600–635** (cara de arriba del colchón) | — | mm | Base de cama; con colchón de 260, base ≈ 350 | ⚠️ | [muebles-y-medidas.md](muebles-y-medidas.md) |

## 11. Colchones de México y bases de cama

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Individual | **1000 × 1900** | 990 × 1900 | mm | Colchón mexicano | ✅ verificado [29] | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Matrimonial | **1350 × 1900** | 1350–1370 de ancho | mm | ídem | ✅ [29] | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Queen | **1500 × 1900** | EE. UU.: 1520 × 2030 | mm | ídem | ✅ [29][30] † | [muebles-y-medidas.md](muebles-y-medidas.md) |
| King | **2000 (ancho) × 1900 (largo)**: más ancho que largo | EE. UU.: 1930 × 2030 | mm | ídem | ✅ verificado [29][30] † | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Cuna | **700 × 1300** | — | mm | Colchón de cuna | ✅ [31] † | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Grosor de colchón | **260** | 200–320 | mm | | ✅ | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Holgura del colchón en la base | 10–30 por lado | — | mm | Mide tu colchón antes de cortar | ⚠️ | [muebles-y-medidas.md](muebles-y-medidas.md) |
| Separación entre tablillas | **≤ 75** | — | mm | Base con tablillas | ✅ [32] | [estructura.md](estructura.md) |
| Claro de tablilla de 18 × 100 | **≤ 700** | — | mm | Entre apoyos; apoyo central desde matrimonial, dos en king | ❓ | [estructura.md](estructura.md) |

**Mide el tuyo.** Los importados (Simmons y otros) suelen medir 2030 de largo [30] †; el king mexicano no es el king estadounidense.

## 12. Vuelco y anclaje

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Altura desde la que se ancla | **686** (27") | — | mm | Todo mueble de guardado con cajones o puertas | ✅ [13][14] | [estructura.md](estructura.md) |
| Prueba de estabilidad (ASTM F2057-23) | cajones y puertas abiertos · ropa 136 kg/m³ · 27.2 kg en la orilla del cajón más alto (hasta 1422 mm) · calce de 10.9 mm · 44.5 N horizontal | — | — | Cómodas, cajoneras y roperos | ✅ verificado [13] | [estructura.md](estructura.md) |
| Librero sin cajones | anclar si alto/fondo ≥ 3, y siempre si mide más de **1200** de alto | alto/fondo ≥ 4 con alto > 1200: muy inestable | — | Libreros y repisas altas | ⚠️ | [estructura.md](estructura.md), [muebles-y-medidas.md](muebles-y-medidas.md) |
| Kit antivuelco | resiste 222 N (ASTM F3096) | — | N | Al poste o al muro sólido, **nunca a la trasera** delgada | ✅ | [glosario.md](glosario.md), [estructura.md](estructura.md), [fabricacion-y-armado.md](fabricacion-y-armado.md) |
| Tablaroca de 12.7 mm, taquete de mariposa de 6 mm | **27** | — | kg de trabajo por taquete | Muro de tablaroca sin poste | ✅ [39][41] | [estructura.md](estructura.md) |
| Block hueco, mariposa de 6 mm | **32** | — | kg a extracción | Block de concreto hueco | ✅ [39] | [estructura.md](estructura.md) |
| Tabique rojo recocido, taquete de 8 × 40 | **30** | 61 en ladrillo macizo alemán | kg | Tabique rojo | ❓ [40][42] | [estructura.md](estructura.md) |
| Concreto, taquete de 8 × 40 | **71** | — | kg | Muro o losa de concreto | ✅ [40] | [estructura.md](estructura.md) |
| Mueble colgado | extracción = peso × brazo ÷ altura entre apoyos | listón de colgar de 18 × 80–100 o listón a 45° (*French cleat*) | — | Alacenas, repisas flotantes | ✅ principio [43] | [estructura.md](estructura.md) |

**Por qué 686 mm.** Es el umbral de la norma estadounidense ASTM F2057-23, obligatoria allá desde 2023 [13][14]; en México no hay norma obligatoria de estabilidad, pero la física es la misma. Una cómoda de triplay de 90 cm se voltea sola con los cajones abiertos y llenos: el kit antivuelco no es opcional.

**Por qué 30 kg en tabique.** fischer da 61 kg en ladrillo macizo alemán [40]; el tabique rojo recocido mexicano es más blando y disparejo, así que se toma la mitad hasta tener pruebas locales.

## 13. Acabados y cantos

| Concepto | Valor recomendado | Rango o alternativas | Unidad | Cuándo aplica | Confianza | Ver |
|---|---|---|---|---|---|---|
| Litros de acabado | área × manos ÷ (rendimiento × **0.8**) | Polyform 3000 (8 m²/L) → 6.4 m² por litro y por mano | L | Calcular compra de barniz, sellador o pintura | ⚠️ [44] | [acabados.md](acabados.md) |
| Lijado de caras | **120 → 180 → 220** | 80 solo en cantos | grano | Antes de sellar | ✅ | [acabados.md](acabados.md) |
| Cubrecanto | ancho **≥ t + 1**: 19–22 para 18 mm; 16 para 12 y 15 mm | Home Depot México solo tiene preencolado de 16 | mm | Tapar el canto de capas | ✅ [45][46] | [triplay.md](triplay.md), [acabados.md](acabados.md) |
| Sellador | de la misma familia que el acabado | nunca nitro bajo poliuretano | — | Primera mano | ✅ | [acabados.md](acabados.md) |

**Por qué ÷ 0.8.** Unas fuentes sumaban 15–20 % de merma y otras dividían entre 0.75; ÷ 0.8 (25 % más que el rendimiento de la carta técnica) queda en medio y cubre lo que absorbe el pino en la primera mano.

---

## Fuentes

1. APA – The Engineered Wood Association, *Panel Design Specification* (2008), tablas 1, 4B y 4C. https://www.socomi.com/wp-content/uploads/APA_PanelDesignSpec.pdf
2. Lautaro S.A. (Eagon), *18 mm Radiata Pine Plywood*, ficha técnica (EN 310 / EN 13986). https://inlandplywood.com/wp-content/uploads/2022/09/Eagon-18MM-Specifications.pdf
3. Latvijas Finieris, *Riga Plywood Handbook* (tablas 2.2, 2.6, 3.18, 3.19, 4.9). https://www.dhhpanelproducts.co.uk/wp-content/uploads/2023/01/Riga-Plywood-Handbook.pdf
4. American Wood Council, *National Design Specification for Wood Construction* 2018, §3.5 (K_cr). https://plib.org/wp-content/uploads/2020/09/AWC-NDS2018.pdf
5. COFORD, *The Structural Use of Timber – Handbook for Eurocode 5: Part 1-1*, tabla D.6 (k_def). https://www.coford.ie/media/coford/content/publications/TimberHandbook5Part130418.pdf
6. USDA Forest Products Laboratory, *Wood Handbook* (FPL-GTR-282), cap. 5, «Creep and Relaxation». https://research.fs.usda.gov/download/treesearch/62244.pdf
7. Architectural Woodwork Institute, *Architectural Woodwork Standards*, 2.ª ed. (2014), Sección 10, «Adjustable shelf loading and deflection». https://woodworkinstitute.com/wp-content/uploads/2015/05/Sec10_2ndEdAWS_SmBkMrkd_141001-3.pdf
8. WoodBin, *The Sagulator*. https://woodbin.com/calcs/sagulator/
9. The Home Depot México, «Triplay BC 1.22 × 2.44 m 18 mm», SKU 554283. https://www.homedepot.com.mx/p/triplay-bc-122-x-244-m-18mm-554283-554283
10. Madererías Selvamex (CDMX), *Triplay – ficha técnica*. https://selvamex.com.mx/wp-content/uploads/2020/12/Ficha-tecnica-Triplay.pdf
11. The Home Depot México, «Triplay: madera contrachapada», listado de categoría. https://www.homedepot.com.mx/b/materiales-de-construccion/terciada-triplay
12. Cerca de mi ubicación, «Madererías en CDMX» (costos de corte y enchapado). https://cercademiubicacion.com.mx/madererias/cdmx/
13. Federal Register, vol. 88, núm. 86 (4 de mayo de 2023), *Safety Standard for Clothing Storage Units* (ASTM F2057-23). https://www.govinfo.gov/content/pkg/FR-2023-05-04/html/2023-08997.htm
14. UL Solutions, *CPSC Adopts ASTM F2057-23 to Prevent Furniture Tip-overs*. https://www.ul.com/news/cpsc-adopts-astm-f2057-23-prevent-furniture-tip-overs
15. Blum, «CLIP top BLUMOTION: número de bisagras» (EASY ASSEMBLY). https://ea.blum.com/en/number-of-hinges/
16. Blum, *Catalogue and technical manual 2022/2023*, p. 70 (CLIP top BLUMOTION, espesores de puerta). https://publications.blum.com/2022/catalogue/en/70/
17. Kreg Tool, «How to select the right pocket-hole screw». https://learn.kregtool.com/learn/how-to-select-right-pocket-hole-screw/
18. Highland Woodworking, «The ideal dado depth?». https://woodworkingtooltips.com/2013/10/the-down-to-earth-woodworking-the-ideal-dado-depth/
19. Canadian Woodworking, «Rabbets, dados and grooves». https://canadianwoodworking.com/techniques_and_tips/rabbets-dados-and-grooves/
20. Woody Calc, «Dowel joint sizing calculator». https://woodycalc.com/dowel-joint-sizing-calculator/
21. Häfele México, «Herrajes de unión». https://www.hafele.com.mx/es/products/herrajes-de-mueble-y-soluciones-para-la-vivienda/herrajes-de-uni-n-y-soportes-para-estantes/herrajes-de-uni-n/50/
22. Fine Woodworking, «Throw away your tape measure: go 32mm system». https://www.finewoodworking.com/2016/02/06/throw-away-your-tape-measure-go-32mm-system
23. Henkel / Resistol, «Ficha técnica Resistol 850 Profesional» (2018). https://cdn.homedepot.com.mx/productos/896112/896112-m.pdf
24. SWS Hardware, «How many Blum hinges will I need per door?». https://swshardware.com/help-and-advice/how-many-blum-hinges-per-door
25. Accuride, «3832EC quick reference and installation». https://www.accuride.com/media/amasty/amfile/attach/lsENsMwHMdlHk0OlD2EpkPTjq1u8ZoYw.pdf
26. Ducasse Industrial, «Corredera telescópica», ficha v01_1021. https://ducasseindustrial.com/wp-content/uploads/2022/05/Ficha_Original_Corredera_Telescopica_v01_1021.pdf
27. The Home Depot México, «Handy Home correderas de extensión 3.5 × 45 cm». https://www.homedepot.com.mx/p/handy-home-correderas-de-extension-niquel-35-x-45-cm-1761-106919
28. The Home Depot México, «Handy Home correderas de extensión total 39.5 cm». https://www.homedepot.com.mx/p/handy-home-correderas-de-extension-total-niquel-395-x-45-cm-plata-1743-246143
29. Luuna, «Medidas de camas en México: matrimonial, queen y king». https://luuna.mx/blog/tamanos-de-camas-y-colchones-en-mexico
30. † Mercado Libre, «Guía de colchones Simmons». https://www.mercadolibre.com.mx/blog/guia-de-colchones-simmons-caracteristicas-y-ventajas-clave
31. † Bebeglo, «Colchón para cuna 70 × 130 cm». https://bebeglo.mx/products/colchon-para-cuna-70-x-130-cm
32. Puffy, «How Far Apart Should Bed Slats Be?». https://puffy.com/blogs/best-sleep/how-far-apart-should-bed-slats-be-the-spacing-guide
33. † Eureka Ergonomic, «BIFMA Workstation Ergonomics». https://eurekaergonomic.com/blogs/eureka-ergonomic-blog/bifma-workstation-ergonomics-standards-guide
34. † Froy, «Dining Table Height, Bar Height, and Counter Height Guide». https://froy.com/blogs/tips/dining-table-height-bar-height-and-counter-height-guide
35. NKBA, «Kitchen Planning Guidelines with Access Standards». https://media.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf
36. Hunker, «What Is The Proper Height For Closet Rods & Shelves?». https://www.hunker.com/13413647/what-is-the-proper-height-for-closet-rods-shelves/
37. † Layoutr, «Standard Bookshelf Depth». https://layoutr.app/blog/standard-bookshelf-depth
38. † ADA, «Forward Reach Range». https://archive.ada.gov/frontr.htm
39. DEWALT Anchors & Fasteners, *Toggle Bolt – Technical Guide* (rev. C, 2023). https://anchors.dewalt.com/anchors/_documents/uploads/DWANF_ToggleBolt-TP-EN-rC_DDS1.pdf
40. fischer, *Expansion plug SX – technical data and loads* (2014). https://docs.rs-online.com/ddef/0900766b812cf8e7.pdf
41. Tablaroca.org, «Taquetes». https://www.tablaroca.org/taquetes/
42. Revista Ferrepat, «Qué taquete usar según el tipo de pared y cuánto peso soporta». https://www.revista.ferrepat.com/ferreteria/taquete-segun-tipo-de-pared/
43. Wikipedia, «French cleat». https://en.wikipedia.org/wiki/French_cleat
44. Comex, «Polyform Barniz 3000 Brillante», carta técnica, rev. 7 (2022). https://repositoriomdm.blob.core.windows.net/b2c/CartasTecnicas/Maderas/19A0260301.pdf
45. Canplast, «Todo lo que debes saber del cubrecanto». https://canplast.com.mx/blogs/news/todo-lo-que-debes-saber-del-cubrecanto
46. The Home Depot México, «Cubrecanto pre-engomado de madera 1500 × 1.6 cm» (Canplast, pino). https://www.homedepot.com.mx/p/canplast-cubrecanto-pre-engomado-de-madera-1500-x-16-cm-pino-838882

Los valores sin número de fuente vienen de práctica de taller o de cálculo; el razonamiento está en el documento de la columna «Ver».
