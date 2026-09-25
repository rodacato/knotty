# Triplay: el material

> Investigación para Knotty · consultado el 2026-09-25 · sistema métrico primero; la designación comercial en pulgadas va después, entre paréntesis.
>
> Nivel de confianza en cada afirmación importante: ✅ verificado en ≥ 2 fuentes · ⚠️ una sola fuente o práctica de taller · ❓ por validar.
> Los precios son **estimados**: se tomaron de páginas públicas en la fecha indicada, cambian por sucursal y semana, y no sustituyen la cotización en tienda.

---

## 1. Resumen para quien tiene prisa

- El triplay (contrachapado, *plywood*) es un tablero de chapas de madera (*veneers*) pegadas con la veta cruzada; siempre tiene un número **impar de capas** y la veta de las caras corre **a lo largo de la hoja** (el lado de 2440 mm) [15] ✅ [11].
- En México la hoja estándar es **1220 × 2440 mm** (4 × 8 pies); Home Depot MX lista el ancho real como **1218 mm** en el triplay BC y como 1210 mm en otro triplay de pino [2][3][6] ✅.
- Lo que en tienda se vende como “triplay de pino” para muebles suele ser **pino radiata** (“pino chileno”, marca AraucoPly, de Arauco) en grado **BC**; también hay pino *elliottii* (“Shop Grade”) y pino nacional [4][5][11][27] ✅.
- **Espesor real ≠ nominal**: una hoja de “18 mm” mide entre 17.1 y 18.1 mm según la norma europea EN 315 [19]; la de ¾" estadounidense mide en realidad 23/32" (18.26 mm) [14][42] ✅. En tiendas de México hay triplay vendido como **17.5 mm** [25] ⚠️.
- La rigidez con la veta **paralela** al claro del proyecto (E ≈ 6000 MPa) está **bien calibrada**; con la veta **perpendicular**, el valor de 3500 MPa es **optimista**: las fuentes dan de 850 a 2900 MPa para triplay de pino de 12–18 mm (sección 6) ✅.
- La fluencia (*creep*) bajo carga permanente puede **duplicar** la flecha en unos años [17][14] ✅; el proyecto usa ×1.5, que es la regla de la Sagulator [21] pero no el caso peor.
- **Nota de auditoría:** el valor canónico para Knotty (ver `10-auditoria.md` §2) es **E∥ = 4500 MPa en 18 mm** (5000 en 15 mm, 5500 en 12 y 9 mm) y **E⊥ = 2000 / 1500 / 1000 / 800 MPa** (18 / 15 / 12 / 9 mm), con **fluencia ×2 para toda carga que se queda puesta** y ×1 para cargas pasajeras. Los 6000 MPa de este documento son el E de APA para especies del **Grupo 1** (abeto Douglas, pino del sur); el triplay de tienda en México es radiata chileno, y su ficha medida (Eagon, 18 mm, 7 capas, EN 310) da **4742 MPa** (verificado en la ficha el 2026-09-25, ver `05-reglas-estructurales.md` [7]). 4500 es el valor **conservador**; 6000 es el optimista.

---

## 2. Qué es el triplay y cómo está hecho

El *Wood Handbook* del Forest Products Laboratory (USDA) lo define así: tablero hecho total o principalmente de chapas llamadas **capas** (*plies*), con un **número impar de capas** y la veta de las capas vecinas a 90°. Las capas exteriores se llaman **cara** y **contracara** (*face* y *back*); las interiores con la veta paralela a las caras se llaman **centros** (*centers*), y las que la llevan cruzada, **contrachapas** (*crossbands*). “Las capas exteriores y todas las impares tienen la veta paralela a la dimensión larga del tablero” [15] ✅.

Consecuencias prácticas:

| Propiedad | Por qué importa | Fuente |
|---|---|---|
| Resiste y es más rígido **a lo largo** de la hoja que a lo ancho | Una repisa cortada con la veta a lo largo de su claro se flexiona menos | [15][14][19] ✅ |
| Muy estable en su plano (casi no crece ni se encoge a lo largo o a lo ancho) | Se puede usar en piezas grandes sin juntas de dilatación | [15] ✅ |
| Casi no se raja al atornillar cerca del canto, porque las capas cruzadas lo impiden | Permite tornillos a 25 mm del extremo (R3) | [15] ✅ |
| Tiene huecos internos (*voids*) si el alma es de baja calidad | Un tornillo o un minifix puede caer en un hueco | [15] ✅, [41] ⚠️ |

**Adhesivo.** Hay dos familias: fenol-formaldehído (**fenólico**, PF), de color oscuro y resistente al agua hirviendo, usado en triplay estructural y exterior, y urea-formaldehído (UF), claro, solo para interiores [15] ✅. Todo el triplay de construcción norteamericano se pega hoy con adhesivo resistente al agua hirviendo [15]. El AraucoPly de pino radiata se fabrica con resina fenólica exterior [12] ✅; el “Shop Grade” de Home Depot anuncia “adhesivo fenólico resistente a la humedad” [5] ⚠️.

**Norma mexicana.** La NMX-C-438-ONNCCE (versión 2006, actualizada en 2014) clasifica el triplay de pino y otras coníferas por calidad de chapas, dimensiones y adhesivo; es de aplicación voluntaria y **no cubre** el triplay con caras de latifoliadas (caobilla, okume, abedul) [22] ⚠️ (solo se vio la ficha de venta, no el texto de la norma).

---

## 3. Tipos de triplay que se consiguen en México

| Tipo (nombre en tienda) | Especie / origen | Cara | Adhesivo | Uso típico | Confianza |
|---|---|---|---|---|---|
| **Triplay de pino BC** (AraucoPly Mueblería) | Pino radiata (Chile) | B lijada, sólida, con reparaciones sintéticas o de madera; contracara C con nudos abiertos [11] | Fenólico [12] | Muebles, carpintería, lambrín | ✅ [2][11][12] |
| **Triplay CDX / construcción / CD** | Pino radiata u otros | Nudos en ambas caras, **sin lijar** [4][23] | Fenólico (la X = exposición) | Obra, cimbra no aparente, muebles rústicos [4] | ✅ [4][23] |
| **Shop Grade** | Pino *elliottii* (Sudamérica) | Defectos en cantos; 7 capas en 18 mm [5] | Fenólico [5] | Tapiales, divisiones, tarimas [5] | ⚠️ [5] |
| **Pino nacional / pino chileno** (madererías) | Pino mexicano o radiata; hay madererías que venden pino chileno bajo el nombre “nacional” | Varía | Fenólico o resina | Muebles, puertas, cimbra | ⚠️ [27] |
| **Caobilla** (también *sapelli*, *meranti*, “lauan”) | Latifoliadas tropicales de Malasia e Indonesia | Veta y color parecidos a la caoba: rosa con veta café | Fenólico | Puertas, cocinas, muebles, lambrines | ⚠️ [28][29] |
| **Okume** (*okoumé*) | *Aucoumea klaineana* (África occidental) | Rojizo, blando, liviano | Fenólico/WBP en grado marino | Interiores livianos; **marino** con BS 1088 | ⚠️ [29], ✅ densidad [32] |
| **Abedul báltico / ruso** (*Baltic birch*) | Abedul (Letonia, Rusia, Finlandia) | Grados B, BB, CP, WG | Fenólico o UF | Muebles finos, cajones, CNC, láser; canto “de capas” | ✅ [19][25][26][30] |
| **Fenólico / film faced / Coverplay / HDO / MDO** | Pino o latifoliadas con película de papel fenólico | Película lisa (negra o café) | Fenólico | Cimbra aparente; exterior; **no** para barniz | ✅ [23][28] |
| **Marino** | Okume o meranti bajo BS 1088 | Cara sólida: ≤ 6 nudos sanos por pie² (≈ 65 por m²) | WBP (resistente al agua hirviendo) | Lanchas, exteriores exigentes | ⚠️ [31] |
| **Triplay de maderas finas** (nogal, encino, maple, parota) | Chapa fina sobre alma de otra madera | Chapa de la especie | Varía | Muebles de lujo | ⚠️ [28] |

Solo como comparación (no son triplay):

| Tablero | Qué es | Módulo de elasticidad en flexión | Humedad | Tornillo al canto |
|---|---|---|---|---|
| **MDF** (*medium density fiberboard*) | Fibras de madera prensadas con resina | 3590 MPa [16] | Se hincha; hay versión hidrófuga (RH) [37] | Malo al canto: pide tornillo de cuerpo recto y rosca completa ⚠️ [37] |
| **Aglomerado / MDP** (*particleboard*) | Partículas prensadas (el MDP con partículas finas en las caras) | 2760–4140 MPa [16] | Poco resistente; hay MDP RH | Pide tornillería específica [37] ⚠️ |
| **OSB** | Hojuelas orientadas | 4410–6280 MPa [16] | Aguanta la intemperie de obra | Bueno; cara rugosa [37] ⚠️ |
| **Triplay** | Chapas cruzadas | 6960–8550 MPa (triplay estructural) [16] | Mejor que MDF y aglomerado | Bueno, incluso cerca del canto [15] |

**Conclusión práctica:** a igual espesor, el triplay es cerca del **doble de rígido** que el MDF o el aglomerado [16] ✅. Una repisa de MDF de 18 mm se flexiona como una de triplay de unos 14 mm (misma E·I, porque la rigidez crece con t³) ⚠️ (cálculo propio).

---

## 4. Grados de cara

### 4.1 Grados de tipo estadounidense (A/B/C/D), los que usan Home Depot y Arauco

El grado se escribe **cara/contracara**: “BC” significa cara B y contracara C [1][11]. El sistema viene de la norma estadounidense PS 1, que el Panel Design Specification de APA resume así [14] ✅:

| Grado | Qué permite | Para qué |
|---|---|---|
| **A** | Lisa, se puede pintar o barnizar; reparaciones de madera o sintéticas limitadas | Caras vistas finas (poco común en México) |
| **B** | Sólida; reparaciones y nudos sanos pequeños permitidos | Cara vista de muebles pintados o barnizados |
| **C** | Nudos sanos y agujeros de nudo pequeños; lijado opcional | Contracara, interiores de mueble |
| **D** | Nudos y agujeros más grandes; solo para lugares ocultos | Obra (“CDX”) |
| **X** | No es una cara: indica adhesivo para exposición a la humedad (Exposure 1) | Construcción |

Los grados que se ven en tiendas mexicanas [23] ⚠️: **CDX** (nudos en ambas caras), **C+C** (pocos nudos, para cimbra), **Industrial** (nudos y defectos en cantos), **PTS** (una cara sin nudos), **BC** (“dos caras sin nudos”, según la tienda; en rigor la C sí admite nudos sanos [14]), **MDO/HDO/Film Face/Coverplay** (con película, para cimbra).

### 4.2 Grados del abedul báltico (B, BB, CP, WG)

| Grado | Cara | Uso |
|---|---|---|
| **B** (europeo II, S) | Una sola pieza, clara, sin defectos, color uniforme | Barniz transparente o tinte [19][30] ✅ |
| **BB** (III) | Admite de 3 a 6 parches ovalados del tamaño de un huevo, en color, y nudos sanos pequeños | Barniz o pintura; lo más común [19][30] ✅ |
| **CP** | Parches ilimitados y nudos sanos, sin defectos abiertos | Contracara, pintura [30] ⚠️ |
| **WG** (IV) | Donde la apariencia no importa | Contracara, estructura [19] ✅ |

Combinaciones típicas: **B/BB** (lo mejor), **BB/BB**, **BB/CP**, **CP/CP** [30] ⚠️.

---

## 5. Espesores, capas, medidas y peso

### 5.1 Espesores y número de capas

| Espesor nominal | Capas en abedul (Riga Ply) [19] | Tolerancia EN 315 (mín–máx) [19] | Pino radiata / pino | Equivalente en EUA [14] |
|---|---|---|---|---|
| 3 mm | — | — | 3 capas ⚠️ | ⅛" |
| 4 mm | 3 | 3.5–4.1 mm | — | — |
| 6 / 6.5 mm | 5 | 6.1–6.9 mm | 3 capas ⚠️ | ¼" |
| 9 mm | 7 | 8.8–9.5 mm | 5 capas ⚠️ | 11/32"–⅜" |
| 12 mm | 9 | 11.5–12.5 mm | 5 capas ⚠️ | 15/32"–½" |
| 15 mm | 11 | 14.3–15.3 mm | 5–7 capas ⚠️ | 19/32"–⅝" |
| 18 mm | 13 | 17.1–18.1 mm | **7 capas** en AraucoPly de 23/32" y en Shop Grade [5][12] ✅ | 23/32"–¾" |

- El abedul lleva **más capas y más delgadas** (≈ 1.45 mm cada una [19]); por eso su canto se ve parejo, tiene menos huecos y aguanta mejor el tornillo al canto ✅ [19][30].
- En pino, un espesor de 18 mm puede ser de 5, 7 o 9 capas; más capas dan más estabilidad y E⊥ más alto (sección 6) ⚠️ (cálculo propio con teoría de laminados).
- APA: la tolerancia del triplay **lijado** es ± 1/64" (± 0.4 mm) sobre el espesor designado; la del **sin lijar**, ± 1/32" (± 0.8 mm) [14] ✅.

**Espesor real contra nominal.** La hoja de ¾" de EUA mide 23/32" = 18.26 mm [14][42] ✅. El triplay métrico de 18 mm puede medir de 17.1 a 18.1 mm y seguir en norma [19] ✅. En México una maderería vende triplay de **17.5 mm** con ese nombre [25] ⚠️, y es práctica de taller medir con vernier antes de fresar un canal ⚠️. **Home Depot MX solo publica el espesor nominal** [2][3] ⚠️.

### 5.2 Medidas de hoja

| Medida | Dónde | Confianza |
|---|---|---|
| **1220 × 2440 mm** (4 × 8 pies), la estándar | Todas las tiendas [1][11][23][24] | ✅ |
| 1218 × 2440 mm (así la lista Home Depot para el triplay BC) | [2][3] | ✅ (D29) |
| 1210 × 2440 mm (triplay de pino CD de 18 mm, SKU 192835) | [6] | ⚠️ |
| **610 × 1220 mm** (¼ de hoja, AraucoPly BC de 9, 12, 15 y 18 mm) | [1] | ✅ |
| 600 × 1220 mm, 3 mm | [1] | ⚠️ |
| 1525 × 1525 mm (5 × 5 pies), abedul ruso | [25][26] | ✅ |

La veta de las caras siempre va a lo largo de la hoja (el lado de 2440) [15] ✅.

### 5.3 Densidad y peso por hoja

Densidades calculadas con el peso que publica Home Depot MX y la hoja de 2440 × 1218 mm (cálculo propio):

| Producto | Peso publicado | Densidad aparente | Fuente |
|---|---|---|---|
| Triplay BC pino, 18 mm | 28.14 kg | ≈ 526 kg/m³ | [2] ✅ |
| Triplay BC pino, 15 mm | 24.9 kg | ≈ 559 kg/m³ | [3] ✅ |
| Triplay CDX AraucoPly (radiata), 18 mm | 29 kg | ≈ 542 kg/m³ | [4] ✅ |
| Triplay Shop Grade (elliottii), 18 mm | 21 kg | ≈ 393 kg/m³ (dudoso) | [5] ❓ |
| MDF Arauco, 18 mm | 32.1 kg | ≈ 600 kg/m³ | [8] ⚠️ |
| Abedul (Riga) | — | 670–750 kg/m³ | [19] ✅ |
| Okume marino (BS 1088) | — | ≈ 450–500 kg/m³ | [32] ⚠️ |
| Triplay en general | — | 400–600 kg/m³ (gravedad específica 0.4–0.6) | [16] ✅ |

Regla rápida: **una hoja de triplay de pino de 18 mm pesa entre 28 y 29 kg**; una de abedul del mismo espesor, cerca de 38–40 kg (cálculo con 700 kg/m³) ⚠️.

---

## 6. Rigidez y resistencia: ¿está bien E = 6000 / 3500 MPa?

### 6.1 Lo que asume el proyecto

`src/domain/estructura/supuestos.ts` y la decisión D7 usan un solo par de valores para **todos** los espesores de triplay de pino: E = 6000 MPa con la veta paralela al claro y 3500 MPa con la veta perpendicular, más una fluencia de ×1.5.

### 6.2 Lo que dicen las fuentes

**a) APA, *Panel Design Specification* D510C (2012), tabla 9: triplay lijado del grupo 1 de especies (*Group 1*)** [14]. APA publica la rigidez por pie de ancho (EI, en lbf·in²/ft) y la inercia geométrica (I, tabla 12). Dividiendo EI entre I se obtiene el E efectivo del tablero (cálculo propio; 1 psi = 0.006895 MPa):

| Espesor (designación APA) | EI ∥ | EI ⊥ | I | **E ∥ efectivo** | **E ⊥ efectivo** |
|---|---|---|---|---|---|
| 12.7 mm (½") | 140 000 | 15 500 | 0.125 in⁴/ft | **≈ 7700 MPa** | **≈ 860 MPa** |
| 15.9 mm (⅝") | 230 000 | 48 500 | 0.244 | **≈ 6500 MPa** | **≈ 1370 MPa** |
| 18.3 mm (23/32") | 320 000 | 90 500 | 0.371 | **≈ 5950 MPa** | **≈ 1680 MPa** |
| 19.1 mm (¾") | 355 000 | 115 000 | 0.422 | **≈ 5800 MPa** | **≈ 1880 MPa** |

El grupo 1 incluye las especies más fuertes (abeto Douglas, pino del sur, abedul). Para especies de los grupos 2, 3 y 4, APA multiplica la rigidez por **0.83, 0.67 y 0.56** [14] ✅. El pino radiata no aparece en la tabla de especies de APA; la ficha de AraucoPly dice que cumple la PS 1 [12].

**b) *Wood Handbook* (USDA FPL), capítulo 12** [16] ✅: el triplay tiene E en flexión de **6960 a 8550 MPa**; en ensayos de triplay estructural, el de pino del sur dio 7700 MPa y el de abeto Douglas 7450 MPa. Son valores con la veta paralela.

**c) Manual de Riga Ply (abedul, Latvijas Finieris)** [19] ✅, 18 mm y 13 capas, lijado:

| | E ∥ | E ⊥ |
|---|---|---|
| Promedio (tabla 4.9) | 10 335 MPa | 7665 MPa |
| Promedio de control de producción (tabla 3.19) | 8993 MPa | 6898 MPa |
| Percentil 5 (tabla 3.18) | 7423 MPa | 5566 MPa |

En 12 mm (9 capas): 11 026 / 6974 MPa. El abedul es mucho más rígido **a lo ancho** porque tiene muchas capas delgadas.

**d) La madera de pino radiata sola** tiene E ≈ 9000–10 000 MPa con la veta [13] ✅ (Arauco MGP10: 10 000 MPa) y un resultado de búsqueda de SciELO que no se pudo abrir ⚠️.

**e) Teoría de laminados (cálculo propio, ❓).** Con capas iguales, E de la madera = 9000 MPa a lo largo y 1/20 de eso a lo ancho:

| Construcción | E ∥ | E ⊥ |
|---|---|---|
| 18 mm, 5 capas | 7200 | 2200 |
| 18 mm, 7 capas | 6500 | 2900 |
| 18 mm, 9 capas | 6100 | 3300 |
| 12 mm, 5 capas | 7200 | 2200 |
| 6 mm, 3 capas | 8700 | 770 |

El mismo modelo con abedul (E = 14 000 MPa) da 8900 / 5800 MPa en 18 mm y 13 capas, algo por debajo de lo medido por Riga (10 335 / 7665), así que es **conservador**.

### 6.3 Veredicto

| Supuesto actual | Veredicto | Valor sugerido |
|---|---|---|
| E ∥ = 6000 MPa para triplay de pino de 18 mm | ✅ **Correcto** (APA 5950; FPL 6960–8550; modelo 6100–7200) | Mantener 6000 para 18 mm; 6500 para 15 mm; 7000 para 12 mm |
| E ⊥ = 3500 MPa | ⚠️ **Optimista** para pino de 5 a 7 capas: APA da 1400–1900 MPa y el modelo 2200–2900 | **2000 MPa** en 15–18 mm y **1000 MPa** en 9–12 mm; 3500 solo si se sabe que tiene ≥ 9 capas |
| Un solo E para todos los espesores | ⚠️ Simplificación: en ⊥ el espesor cambia el valor de 860 a 1880 MPa | Tabla por espesor (sección 13) |
| El mismo E para abedul | ❌ No aplica | Abedul: 9000 ∥ / 6900 ⊥ (promedios de Riga en 18 mm) |
| Fluencia ×1.5 | ⚠️ Es la regla de la Sagulator [21]; el *Wood Handbook* dice que tras varios años la fluencia **puede igualar** la flecha inicial (×2) [17]; APA pide dividir EI entre 2 bajo carga permanente [14] | **×2 para carga pesada permanente** (libros); ×1.5 para ligera o media |

> **Nota de auditoría (reconciliación con `05-reglas-estructurales.md`):** este veredicto se tomó comparando con APA Grupo 1. El pino radiata es menos rígido que las especies del Grupo 1 (su madera aserrada ronda 8000–10 000 MPa contra 12 000–13 700 del pino del sur y el abeto Douglas), así que el E∥ de APA escalado para radiata (≈ ×0.75) da ≈ 4500 MPa en 18 mm, igual que la ficha medida de Eagon (4742). La tabla canónica queda: **18 mm → 4500 ∥ / 2000 ⊥; 15 mm → 5000 / 1500; 12 mm → 5500 / 1000; 9 mm → 5500 / 800**, fluencia ×2 en carga sostenida. El E⊥ de 2000 en 18 mm queda entre APA (1680, construcción mínima de 5 capas) y Eagon (3912, 7 capas); es conservador para el AraucoPly de 7 capas. Con esos valores las flechas de la tabla siguiente suben ≈ 78 % respecto a «Hoy» (E 6000, ×1.5).

Por qué importa, con el ejemplo de la §5 de `PROPUESTA.md` (18 mm, fondo 300 mm, libros 150 kg/m²; cálculo propio):

| Caso | Claro 600 mm | Claro 800 mm |
|---|---|---|
| Hoy: E 6000, ×1.5, t = 18 | 1.28 mm → OK (L/360 = 1.67) | 4.04 mm → crítico |
| E 6000, **×2**, t = 18 | 1.70 mm → recomendación (apenas) | 5.38 mm → crítico |
| E 6000, ×2, **t = 17.5 real** | 1.85 mm → recomendación | 5.86 mm → crítico |
| Veta ⊥, hoy (E 3500, ×1.5) | 2.19 mm → recomendación | — |
| Veta ⊥, **E 2000**, ×1.5 | 3.83 mm → **crítico** | 12.1 mm → crítico |

Para comparar: la Sagulator sugiere como meta **1.7 mm por metro** de claro (0.02" por pie, ≈ L/590) y dice que el ojo nota **2.5 mm por metro** (1/32" por pie, ≈ L/400) [21] ⚠️. El umbral de L/360 del proyecto es razonable como “recomendación”.

**Cómo calibrarlo en casa (❓, sugerencia para una guía):** cortar una tira de 100 × 900 mm, apoyarla sobre dos listones separados L = 800 mm, colgar al centro una carga P conocida (por ejemplo 10 kg = 98 N), medir la flecha δ con un vernier o una regla y calcular E = P·L³ / (48·δ·I), con I = 100·t³/12 (t medido). Repetir con una tira cortada a lo ancho de la hoja para obtener E ⊥.

---

## 7. Dirección de la veta

- La veta de la cara va a lo largo de la hoja (2440 mm) [15] ✅, así que el acomodo de Knotty (“la veta va sobre el lado de 2440”) es correcto.
- **Repisas y cubiertas:** cortarlas con la veta **a lo largo del claro**. Con la veta cruzada se flexionan de 3 a 9 veces más en triplay de pino (relación E∥/E⊥ de APA: 3.2 a 9) [14] ✅. La regla R8 debería ser **recomendación** y no “detalle” cuando la pieza trabaja a flexión (hoy R1 ya usa el E menor, pero con 3500 subestima el efecto).
- **Laterales y puertas altas:** veta vertical, por apariencia y porque una puerta alta con veta horizontal se alabea más ⚠️ (práctica de taller).
- **Frentes de cajón y puertas contiguas:** que la veta siga de una pieza a la otra (“veta corrida”) ⚠️; es estético y afecta el acomodo, porque las piezas ya no pueden girar.
- El abedul, con E⊥/E∥ ≈ 0.75, casi no es sensible a la dirección de la veta [19] ✅.

---

## 8. Humedad y clima en México

La madera se equilibra con la humedad relativa (HR) del aire; su contenido de humedad de equilibrio (CHE, *EMC*) sigue aproximadamente esta tabla, válida con ± 1 punto entre 2 y 38 °C [20] ✅:

| HR del aire | 20 % | 30 % | 50 % | 66 % | 75 % | 80 % |
|---|---|---|---|---|---|---|
| CHE de la madera | 4 % | 6 % | 9 % | 12 % | 14 % | 16 % |

Humedad relativa media anual en algunas ciudades (Wikipedia, tablas climáticas del SMN o NOAA) y el CHE que corresponde (interpolado):

| Ciudad | HR media anual | Rango mensual | CHE aproximado | Fuente |
|---|---|---|---|---|
| Guadalajara | 61 % | 46 % (abr) – 72 % (ago) | ≈ 11 % | [39] ⚠️ |
| Monterrey | 66.9 % | 63 % (abr) – 72 % (oct) | ≈ 12 % | [38] ⚠️ |
| Mérida | 72 % | 65 % (abr) – 78 % (sep) | ≈ 13 % | [40] ⚠️ |
| Ciudad de México | ❓ sin dato verificado | temporada de lluvias de junio a septiembre | ≈ 9–11 % (estimado) | ❓ |

- El *Wood Handbook* recomienda instalar la madera de interiores con **8 %** de humedad en promedio (6–10 % por pieza) en la mayor parte de EUA, 6 % en zonas secas y 11 % en costas húmedas y cálidas [18] ✅. AraucoPly sale de fábrica con **8 %** [11] ⚠️. En Mérida o en la costa, el triplay va a ganar humedad después de comprarlo.
- El triplay casi no cambia de medida en su plano [15] ✅, pero **sí** se alabea si una cara está sellada y la otra no, o si se guarda recargado en la pared ⚠️. Regla de taller: sellar o barnizar **las dos caras y los cantos** con el mismo número de manos ⚠️.
- **Aclimatar**: dejar la hoja de 2 a 7 días, acostada sobre separadores, en el cuarto donde se va a armar ⚠️ (práctica de taller; no se encontró fuente primaria).
- Baños y cocinas: preferir adhesivo fenólico y canto sellado; el MDF o el aglomerado estándar se hinchan al mojarse [37] ⚠️.

---

## 9. Corte

### 9.1 Astillado (*tearout*)

El astillado aparece donde el diente **sale** de la madera [33] ✅:

| Herramienta | Cara buena | Recomendación [33] |
|---|---|---|
| Sierra de mesa (*table saw*) | **Hacia arriba** (el diente baja) | Disco de 60–80 dientes de carburo con dientes alternados (ATB o Hi-ATB); el disco apenas sobre la madera; inserto de claro cero (*zero-clearance*) |
| Sierra circular (*circular saw*) | **Hacia abajo** (el diente sube) | Disco de 40–60 dientes en 184 mm (7¼"); apoyar toda la hoja sobre espuma rígida; guía o riel |
| Sierra de riel (*track saw*) | Hacia abajo | Protector contra astillado del riel |
| Router y CNC | — | Broca de espiral descendente (*down-cut*) o de compresión; tabla de sacrificio |

Trucos de todas: marcar el corte con **cúter** antes de cortar, poner **cinta de pintor** sobre la línea y hacer una primera pasada poco profunda que solo corte la chapa [33] ✅.

### 9.2 Corte en tienda

- Home Depot MX tiene un servicio de corte (“Sala de cortes”) para madera y puertas [44] ⚠️; **no publica** el precio por corte, la tolerancia ni los cortes gratuitos (❓, preguntar en sucursal).
- Las madererías ofrecen “corte a medida” y optimización del corte [27] ⚠️.
- Práctica de taller ⚠️: las sierras de tienda (seccionadoras de panel verticales) cortan con una tolerancia de ± 1–2 mm y **no garantizan escuadra**; conviene pedir los cortes largos (tiras) en tienda y hacer los cortes finales en casa. *Nota de auditoría:* una seccionadora bien calibrada corta a décimas de milímetro (`09-fabricacion-y-armado.md` [30]); la tolerancia real depende del estado de la máquina de cada sucursal, así que conviene medir las primeras piezas en el mostrador. Llevar la lista ordenada por tiras, que es justo lo que produce un acomodo en guillotina.

### 9.3 Grosor del corte

El proyecto usa **4 mm** de corte de sierra (`acomodo.sierra`). Un disco de carburo común de 254 mm (10") corta unos 3 mm (⅛") y uno de 184 mm (7¼") entre 2.4 y 2.8 mm ⚠️ (práctica de taller; no se verificó en fuente). 4 mm es un margen conservador razonable para sierras de tienda.

---

## 10. Qué espesor para qué pieza

Combinando las reglas R2 y R5 del proyecto con la práctica de taller (⚠️ salvo donde se indica):

| Pieza | Espesor típico | Mínimo | Por qué |
|---|---|---|---|
| Laterales (costados) | 15–18 mm | 15 mm | Reciben tornillo al canto, minifix, soportes de repisa de 5 mm (R2) |
| Techo y piso del casco | 15–18 mm | 15 mm | Igual que los laterales |
| Repisa fija o móvil | 18 mm | 15 mm con claro corto | Pandeo (R1); ver la tabla de la §6.3 y `05-reglas-estructurales.md` §1.6 |
| Cubierta de escritorio o mesa | 18 mm o doble de 18 mm (36 mm) | 18 mm | Rigidez y aspecto |
| Puerta con bisagra de cazoleta de 35 mm | 18 mm | 16 mm; 15 mm con aviso | La cazoleta se perfora a 11–13 mm de profundidad (Blum: 13 mm) ✅ `02-uniones-y-herrajes.md` §6.1; en 15 mm quedan solo 2–4 mm de cara. *Nota de auditoría: antes decía «mínimo 15 mm (R2)»* |
| Frente de cajón | 15–18 mm | 12 mm | |
| Costados de cajón | 12–15 mm | 12 mm | Tornillo de bolsillo o tarugo |
| Fondo de cajón | 6–9 mm | 6 mm (el proyecto ya lo exige) | Con 3 mm solo cajones de menos de 300 mm de ancho (`05-reglas-estructurales.md` §4.3; *nota de auditoría: antes decía 450*) |
| Trasera que escuadra | 6 mm fijada en todo el perímetro, o 3 mm en rebaje con pegamento (R5) | 3 mm | |
| Zoclo | 15–18 mm | 12 mm | |
| Cajas decorativas, divisores ligeros | 9–12 mm | 6 mm | |

---

## 11. Precios aproximados en México (estimados)

Consultados el **2026-09-25** en páginas públicas; Home Depot muestra el precio sin punto decimal (“99900” = $999.00). Hoja de 1220 × 2440 mm salvo que se diga otra cosa.

| Producto | Precio | Tienda | Fuente |
|---|---|---|---|
| Triplay BC pino 9 mm | $629 | Home Depot MX | [1] |
| Triplay BC pino 12 mm | $699 | Home Depot MX | [1] |
| Triplay BC pino 15 mm | $855 | Home Depot MX | [1][3] |
| Triplay BC pino 18 mm | $999 | Home Depot MX | [1][2] |
| Triplay pino CD 18 mm (1210 mm de ancho) | $735 | Home Depot MX | [1][6] |
| Triplay 12 mm (sin grado) | $499 | Home Depot MX | [1] |
| Triplay CDX Marini 15 mm | $619 | Home Depot MX | [1] |
| Triplay construcción CD 15 mm | $719 | Home Depot MX | [1] |
| Triplay construcción 6 mm | $315 | Home Depot MX | [1] |
| Triplay pino 3 mm | $249 | Home Depot MX | [1][7] |
| Shop Grade 18 mm | $685 | Home Depot MX | [5] |
| AraucoPly BC 18 mm, **610 × 1220** (¼ de hoja) | $329 | Home Depot MX | [1] |
| MDF Arauco 18 mm | $615 | Home Depot MX | [8] |
| Triplay pino 3 / 9 / 12 / 15 / 18 mm | $400 / $675 / $780 / $950 / $1115 (con IVA) | Maderería Aztecas | [24] |
| Triplay sapelli/caobilla 15 / 18 mm | $750 / $900 (con IVA) | Maderería Aztecas | [24] |
| Triplay listón caobilla 18 mm | $601.12 | Total Market | [43] ⚠️ |
| Triplay ruso (abedul) BC 12 / 15 / 18 mm | $730 / $832 / $968 **+ IVA** | Tableros de México | [25] |
| Triplay ruso BC 18 mm, 1500 × 1500 | $520 + IVA | Tableros de México | [25] |
| Cubrecanto de madera de pino preencolado, 16 mm × 15 m × 2 mm | $145 | Home Depot MX | [9] |
| Cubrecanto de melamina preencolado, 16 mm × 15 m × 1 mm | $58 (la búsqueda mostró $119) | Home Depot MX | [10] ⚠️ |

Comparación con `public/catalogo/catalogo.json`:

| Material del catálogo | Precio en catálogo | Referencia más cercana | Diferencia |
|---|---|---|---|
| T12 “Triplay de pino 12 mm” | $720 | BC 12 mm en HD: $699 | ✅ razonable |
| T15 | $860 | BC 15 mm en HD: $855 | ✅ |
| T18 | $1050 | BC 18 mm en HD: $999; CD: $735; Aztecas: $1115 | ✅ razonable, pero **sin grado** |
| TR3 (3 mm) | $330 | HD: $249; Aztecas: $400 | ⚠️ |
| TR6 (6 mm) | $480 | HD 6 mm construcción: $315 | ⚠️ alto |
| cubrecanto-19, $12/m | $12/m | pino preencolado 16 mm: $9.67/m | ⚠️ **HD solo lo vende de 16 mm**: no cubre un canto de 18 mm |

---

## 12. Tratamiento de cantos

El canto del triplay enseña las capas y los huecos del alma, absorbe acabado de más y se despostilla. Opciones:

| Tratamiento | Cómo se pone | Ventajas | Desventajas | Fuente |
|---|---|---|---|---|
| **Cubrecanto preencolado** (*iron-on edge banding*) de chapa de madera, melamina o PVC | Plancha doméstica a temperatura media o pistola de calor; rodillo de hule inmediatamente después; recortar con cúter, cepillo o recortador | Rápido, barato, sin herramienta especial | No aguanta calor ni uso rudo: no sirve para cantos de mesa ni junto a una estufa | [34][35] ✅ |
| **Cubrecanto sin adhesivo con termofusible** (*hot melt*) | Enchapadora (*edgebander*) automática o manual con pegamento caliente | Más resistente; es el acabado de fábrica | Requiere máquina; en México lo ofrecen las tiendas de tableros por pieza | [35][36] ⚠️ |
| **Cubrecanto de PVC** (0.45, 1 y 2 mm) | Termofusible o preencolado | Resiste golpes y humedad; más de 100 colores | Se ve plástico en triplay natural | [35][36] ⚠️ |
| **Canto macizo** (*solid wood edging*), tira de madera | Pegamento blanco más cinta o clavo sin cabeza; tira ≈ 3 mm (⅛") **más ancha** que el espesor del tablero; al secar, rebajar a ras con cepillo o router con broca de copiar (*flush trim*) | Muy durable; se puede perfilar (redondear, chaflán); **suma rigidez** al frente de una repisa | Más trabajo | [34] ✅ |
| Canto macizo en V, lengüeta y ranura o con galleta (*spline*) | Router con juego de brocas | Muy fuerte, casi invisible | Requiere pruebas | [34] ⚠️ |
| **Canto expuesto lijado** (estilo “de capas”) | Lijar 120 → 180, redondear 1–3 mm, sellar | Estética contemporánea; lucida en abedul | En pino muestra huecos y capas disparejas | ⚠️ taller; [19] para el alma pareja del abedul |

Consejos prácticos ✅ [34]: poner el canto macizo **antes** de cortar el ancho final de la pieza; poner cinta de pintor en las caras antes del pegamento para limpiar fácil.

**Ancho del cubrecanto:** comprarlo un poco más ancho que el espesor del tablero y recortar el sobrante [35] ✅. Para triplay de 18 mm hace falta cubrecanto de 19 o 22 mm; el de 16 mm (el que vende Home Depot preencolado) **no alcanza** (conclusión propia a partir de [9][10]).

**Tiras de canto macizo como refuerzo:** una tira de 20 mm de peralte pegada al frente de una repisa de 18 mm funciona como viga en “L” y reduce la flecha de forma notable ⚠️ (Knotty podría modelarlo como una pieza extra que suma inercia). *Nota de auditoría:* el cálculo de `05-reglas-estructurales.md` §1.7 con una tira de pino de 18 × 40 mm pegada en toda su longitud da **I × 3** (claro × 1.45); esa es la medida canónica de la «tira de refuerzo al frente».

---

## 13. Defectos comunes y cómo elegir la hoja en tienda

| Defecto | Cómo se ve | Cómo revisarlo | Fuente |
|---|---|---|---|
| **Alabeo** (*warp*: arqueo, torcedura) | La hoja no apoya plana | Mirar a lo largo de los cantos (“apuntar” la hoja); apoyarla en el piso | [41] ⚠️ |
| **Huecos internos** (*voids*) | Agujeros en el canto | Revisar los cuatro cantos; con linterna | [41] ⚠️, [15] |
| **Deslaminado** (*delamination*) | Capas separadas; cantos esponjados; burbujas o bultos en la cara; suena hueco al golpear | Golpear con los nudillos; revisar las esquinas | [41] ⚠️ |
| Cara lijada de más (se transparenta la capa de abajo) | Manchas oscuras, “sombra” de la veta cruzada | Mirar la cara a contraluz | ⚠️ taller |
| Parches y reparaciones sintéticas | Óvalos o masilla | Normales en BC y BB; elegir la cara que se va a ver | [11][30] |
| Golpes en esquinas | Esquina aplastada | Se va con el refilado (D29) si es chico | ⚠️ |

**Lista para elegir en tienda** (práctica de taller ⚠️):

1. Pedir hojas **de en medio** de la pila (las de arriba y abajo se golpean y alabean).
2. Revisar que esté plana, los cantos y las cuatro esquinas.
3. Escoger la mejor cara para lo visible; marcarla con lápiz.
4. Medir el espesor real con vernier en tres puntos.
5. Llevarla **acostada** y guardarla acostada sobre separadores.

---

## 14. Para Knotty: qué se puede volver regla o dato

### 14.1 Correcciones a lo que el proyecto asume hoy

| Dónde | Hoy | Propuesta | Confianza |
|---|---|---|---|
| **D7** y `supuestos.ts → moduloElasticidad.perpendicular` | 3500 MPa | Tabla por espesor: **2000** (18), **1500** (15), **1000** (12), **800** (9) — valor canónico de la auditoría | ✅ APA [14], Eagon y modelo |
| `moduloElasticidad.paralela` | 6000 MPa, fijo | *Nota de auditoría:* canónico **4500** (18), **5000** (15), **5500** (12 y 9), por ser radiata y no Grupo 1; la propuesta original de este documento era 6000 / 6500 / 7000 | ✅ [14][16] + Eagon (`05` [7]) |
| `fluencia` | 1.5 | **2.0 para toda carga sostenida** (NDS K_cr = 2.0 para tableros no depende del nivel de carga); 1.0 para cargas pasajeras (persona, asiento). *Nota de auditoría: antes proponía 1.5 para carga ligera o media* | ✅ [14][17][21] |
| Cálculo de la flecha (R1) | Usa el espesor nominal | Usar el **espesor real** del material (18 → 17.5 por defecto en pino, editable) | ⚠️ [19][25] |
| R8 (veta) | “detalle” | **Recomendación** si la pieza trabaja a flexión (repisa, cubierta) con veta ⊥ | ✅ [14] |
| **D29** | Hoja de 2440 × 1218 y refilado de 15 mm | Mantener, pero guardar el ancho **por material** (hay 1210 mm [6]) | ✅ |
| **§6 de PROPUESTA** | Dice “refilado (10 mm)” | El catálogo y D29 usan 15 mm: corregir el texto | ✅ (inconsistencia interna) |
| **Catálogo** | “Triplay de pino” sin grado ni especie | Agregar `grade` (BC, CD, CDX), `species` y `actualThickness`; T18 debería decir “BC” | ✅ [1] |
| Catálogo: traseras | TR6 a $480 | Revisar (HD: $315) | ⚠️ |
| Catálogo: `cubrecanto-19` | $12/m, 19 mm | Existe de 16 mm en HD ($9.67/m) y **no cubre** 18 mm; indicar que el de 19–22 mm se consigue en tiendas de tableros | ⚠️ |
| Catálogo: formatos | Solo hoja completa | Agregar ¼ de hoja (610 × 1220) de AraucoPly BC: útil para muebles chicos aunque cuesta ≈ 32 % más por m² | ✅ [1] |
| Peso | No se calcula | Calcular peso del mueble con la densidad (≈ 540 kg/m³ pino) | ✅ [2][3][4] |

### 14.2 Constantes

```ts
// Densities in kg/m³ (apparent, at ~8–12 % moisture content).
export const DENSITY_KG_M3 = {
  pinePlywood: 540,     // Home Depot MX weights: 526–559
  birchPlywood: 700,    // Riga: 670–750
  okoumePlywood: 480,   // BS 1088: 450–500
  mdf: 700,             // FPL: SG 0.7–0.9; HD listing gives ~600 → verify
  particleboard: 650,   // FPL: SG 0.6–0.8
} as const

/** Bending MOE in MPa by thickness, face grain parallel / perpendicular to span. Pine (APA Group 1 sanded, derived EI/I; conservative). */
// Audit note: canonical values (docs/investigacion/10-auditoria.md §2). Radiata pine, not APA Group 1: conservative.
export const PINE_PLYWOOD_MOE_MPA: Record<number, { parallel: number; perpendicular: number }> = {
  6: { parallel: 6000, perpendicular: 700 },
  9: { parallel: 5500, perpendicular: 800 },
  12: { parallel: 5500, perpendicular: 1000 },
  15: { parallel: 5000, perpendicular: 1500 },
  18: { parallel: 4500, perpendicular: 2000 },
}

/** Riga Ply 18/13 average (sanded). */
export const BIRCH_PLYWOOD_MOE_MPA = { parallel: 9000, perpendicular: 6900 } as const

/** Final / initial deflection: 2.0 for any sustained load (NDS K_cr for wood structural panels), 1.0 for transient loads. */
export const CREEP_FACTOR = { sustained: 2.0, transient: 1.0 } as const

/** Visual reference: Sagulator target 1.7 mm per metre of span (≈ L/590). */
export const SAG_TARGET_MM_PER_M = 1.7

/** Default real thickness offset for pine plywood when the user has not measured. */
export const PINE_ACTUAL_THICKNESS_OFFSET_MM = -0.5
```

### 14.3 Reglas nuevas posibles

| Código | Regla | Severidad sugerida |
|---|---|---|
| M1 | Canal o rebaje: el ancho se calcula con el **espesor real** de la pieza que entra, no con el nominal | Detalle, con texto «mide tu triplay con vernier» |
| M2 | Pieza con canto visible y `edge = none` en pino → sugerir cubrecanto o canto macizo | Detalle |
| M3 | Cubrecanto más angosto que el espesor | Error de lista de compra |
| M4 | Repisa con claro > 800 mm y canto macizo de ≥ 20 mm de peralte → recalcular la flecha con sección en “L” | (mejora de R1) |
| M5 | Mueble para baño o exterior con MDF o aglomerado estándar | Recomendación: triplay fenólico o MDF RH |
| M6 | Veta cruzada entre puertas o frentes contiguos (`grainMatch`) | Detalle; el acomodo deja de rotar esas piezas |
| M7 | Material de abedul: permitir tornillo al canto desde 12 mm (más capas) | Ajuste a R2, por validar ❓ |

*Nota de auditoría:* los códigos M1–M7 no chocan con R1–R24 (ver `10-auditoria.md` §4). M3 y M5 son revisiones de lista de compra y de material, no reglas estructurales.

### 14.4 Bosquejo de tipos (Zod 4)

```ts
import { z } from 'zod'

export const PlywoodSpecies = z.enum([
  'radiata-pine',   // «pino radiata (chileno)»
  'mexican-pine',   // «pino nacional»
  'elliottii-pine', // «pino elliottii (Shop Grade)»
  'caobilla',       // «caobilla / sapelli / meranti»
  'okoume',         // «okume»
  'birch',          // «abedul báltico o ruso»
])

/** Face/back grade as printed in Mexican stores (US-style) or Baltic birch style. */
export const PlywoodGrade = z.enum(['BC', 'CD', 'CDX', 'shop', 'B/BB', 'BB/BB', 'BB/CP', 'CP/CP', 'film'])

export const GlueType = z.enum(['phenolic', 'urea', 'unknown'])

export const SheetSpec = z.object({
  id: z.string(),
  name: z.string(),                     // «Triplay de pino BC 18 mm» (texto para la persona)
  kind: z.enum(['plywood', 'back', 'mdf', 'particleboard']),
  species: PlywoodSpecies.optional(),
  grade: PlywoodGrade.optional(),
  glue: GlueType.default('unknown'),
  nominalThickness: z.number().int().positive(),     // mm
  actualThickness: z.number().positive().optional(), // mm, measured; may be 17.5
  plies: z.number().int().positive().optional(),
  sheet: z.object({ length: z.number().int(), width: z.number().int() }), // mm; grain runs along length
  densityKgM3: z.number().positive().optional(),
  moeMPa: z.object({ parallel: z.number(), perpendicular: z.number() }).optional(),
  sku: z.string().nullable(),
  price: z.number().nonnegative(),
  priceSource: z.object({ store: z.string(), checkedOn: z.string() }).optional(), // «Home Depot MX», '2026-09-25'
})

export const EdgeTreatment = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('exposed-sanded'), radius: z.number().int().min(0).max(6) }), // mm
  z.object({
    kind: z.literal('banding'),
    material: z.enum(['wood-veneer', 'melamine', 'pvc']),
    adhesive: z.enum(['preglued', 'hot-melt']),
    width: z.number().int(),      // mm, must be ≥ actualThickness
    thickness: z.number(),        // mm: 0.45, 1, 2
  }),
  z.object({ kind: z.literal('solid-strip'), thickness: z.number().int(), depth: z.number().int() }), // mm
])
```

### 14.5 Textos para la persona (ejemplos)

- «Tu triplay de 18 mm probablemente mide 17.5 mm. Mídelo con vernier antes de hacer el canal.»
- «Esta repisa tiene la veta a lo ancho: se pandea unas tres veces más. Gírala en la hoja o pégale una tira de madera al frente.»
- «El cubrecanto de 16 mm no alcanza a tapar un canto de 18 mm. Busca uno de 19 o 22 mm.»

---

## 15. Preguntas frecuentes

1. **¿Qué triplay compro para un mueble que voy a barnizar?** Triplay de pino **BC** (la cara B va a la vista). Si quieres el canto de capas a la vista o más rigidez, abedul BB/BB. ✅ [11][19]
2. **¿Mide 18 mm la hoja de 18 mm?** No siempre: puede medir de 17.1 a 18.1 mm. Mídela antes de cortar canales. ✅ [19][25]
3. **¿Cuánto pesa una hoja?** El pino de 18 mm pesa unos 28–29 kg; el de 15 mm, unos 25 kg. ✅ [2][3][4]
4. **¿Hacia dónde va la veta?** A lo largo de la hoja (el lado de 2440 mm). Corta las repisas con la veta a lo largo. ✅ [15]
5. **¿MDF o triplay?** Para piezas que cargan o llevan tornillo al canto, triplay: es cerca del doble de rígido y aguanta mejor la humedad. El MDF es mejor para pintar liso. ✅ [16][37]
6. **¿El triplay de construcción (CDX) sirve para muebles?** Para muebles rústicos o de taller sí; no viene lijado y tiene nudos abiertos. ✅ [4][23]
7. **¿Cómo evito que se astille al cortar?** Disco de muchos dientes, cinta de pintor, marcar con cúter y la cara buena hacia el lado donde entra el diente. ✅ [33]
8. **¿Qué cubrecanto uso?** Preencolado de chapa de madera para triplay barnizado; canto macizo si el canto se va a golpear o es una cubierta. ✅ [34][35]
9. **¿Qué es el triplay marino?** Triplay de latifoliadas pegado con adhesivo resistente al agua hirviendo y con caras sin huecos, bajo la norma BS 1088. Es caro y solo se justifica en exteriores muy exigentes. ⚠️ [31]
10. **¿Aclimato la hoja?** Sí: déjala unos días acostada en el cuarto donde se va a usar, sobre todo si vives en la costa. ⚠️ [18][20]

---

## 16. Dudas abiertas

- ❓ Número de capas real del triplay BC de Home Depot en 12 y 15 mm (define el E⊥).
- ❓ E real del triplay de pino que se vende en México: hacer la prueba casera de la §6.3 con dos o tres hojas.
- ❓ Humedad relativa media de la Ciudad de México con fuente del SMN.
- ❓ Precio, tolerancia y cortes gratuitos del servicio de corte de Home Depot MX.
- ❓ Texto completo de la NMX-C-438-ONNCCE (grados de chapa mexicanos).
- ❓ Grosor real de corte (*kerf*) de las seccionadoras de las tiendas.

---

## Fuentes

1. The Home Depot México, «Triplay: madera contrachapada», listado de categoría (consultado 2026-09-25). https://www.homedepot.com.mx/b/materiales-de-construccion/terciada-triplay
2. The Home Depot México, «Triplay BC 1.22 x 2.44 m 18 mm», SKU 554283. https://www.homedepot.com.mx/p/triplay-bc-122-x-244-m-18mm-554283-554283
3. The Home Depot México, «Triplay BC 1.22 x 2.44 m 15 mm», SKU 547727. https://www.homedepot.com.mx/p/triplay-bc-122-x-244-m-15mm-547727-547727
4. The Home Depot México, «Triplay construcción CDX 18 mm 122x244 AraucoPly», SKU 532366. https://www.homedepot.com.mx/p/triplay-construccion-cdx-18-mm-122x244-araucoply-532366
5. The Home Depot México, «Triplay Shop Grade 18 mm 122 x 244», SKU 165704. https://www.homedepot.com.mx/p/triplay-shop-grade-18mm-122-x-244-165704
6. The Home Depot México, «Triplay madera de pino 2.44 x 1.21 m x 18 mm», SKU 192835. https://www.homedepot.com.mx/p/triplay-madera-de-pino-244-x-121-m-x-18-mm-192835
7. The Home Depot México, «Triplay de pino 1.22 x 2.44 m» (3 mm), SKU 434782. https://www.homedepot.com.mx/p/triplay-de-pino-122-x-244-m-434782-434782
8. The Home Depot México, «Panel de MDF 18 mm 1.22 x 2.44 m», SKU 287130. https://www.homedepot.com.mx/p/panel-de-mdf-18-mm-122-x-244-m-287130-287130
9. The Home Depot México, «Cubrecanto pre engomado de madera 1500 x 1.6 cm» (Canplast, pino). https://www.homedepot.com.mx/p/canplast-cubrecanto-pre-engomado-de-madera-1500-x-16-cm-pino-838882
10. The Home Depot México, «Cubrecanto pre-engomado de melamina 1500 x 1.6 cm» (Canplast). https://www.homedepot.com.mx/p/canplast-cubrecanto-pre-engomado-de-melamina-1500-x-16-cm-10672-162769
11. ARAUCO México, «AraucoPly», ficha de producto. https://mx.arauco.com/c/products/ct-triplay/br-arply
12. Aetna Plywood / ARAUCO, «AraucoPly Radiata Pine Plywood» (ficha, enero 2023). https://www.aetnaplywood.com/wp-content/uploads/2022/12/Radiata-Pine-Plywood-January-2023.pdf
13. ARAUCO Chile, «Ficha técnica madera estructural MGP10». https://arauco.com/chile/wp-content/uploads/sites/14/2021/08/4354_FICHA__TECNICA_MADERA_ESTRUCTURAL_MGP10_CHILE_04Jun_21_E02.pdf
14. APA – The Engineered Wood Association, *Panel Design Specification*, Form D510C (2012), tablas 1, 6, 9, 10 y 12. http://design.medeek.com/resources/structural/D510C_2012.pdf
15. USDA Forest Products Laboratory, *Wood Handbook* (FPL-GTR-282), cap. 11 «Wood-Based Composite Materials». https://research.fs.usda.gov/download/treesearch/62258.pdf
16. USDA FPL, *Wood Handbook* (FPL-GTR-282), cap. 12 «Mechanical Properties of Wood-Based Composite Materials», tablas 12-1 y 12-2. https://research.fs.usda.gov/download/treesearch/62260.pdf
17. USDA FPL, *Wood Handbook* (FPL-GTR-282), cap. 5 «Mechanical Properties of Wood», sección «Creep and Relaxation». https://research.fs.usda.gov/download/treesearch/62244.pdf
18. USDA FPL, *Wood Handbook* (FPL-GTR-190), cap. 13 «Drying and Control of Moisture Content», tabla 13-2 (copia). http://www.woodbodger.com/wp-content/uploads/2012/02/Wood-Handbook-Chapter-13-Drying-and-Control-of-Moisture-Content.pdf
19. Latvijas Finieris, *Riga Plywood Handbook* (tablas 2.2, 2.6, 3.18, 3.19, 4.9). https://www.dhhpanelproducts.co.uk/wp-content/uploads/2023/01/Riga-Plywood-Handbook.pdf
20. P. Mitchell, NC State University, «Calculating the Equilibrium Moisture Content for Wood Based on Humidity Measurements», tabla 1. https://sites.cnr.ncsu.edu/wpe/wp-content/uploads/sites/35/2017/11/Calculating-the-Equilibrium-Moisture-Content-of-Wood-Instructions.pdf
21. WoodBin, «The Sagulator». https://woodbin.com/calcs/sagulator/
22. ONNCCE, NMX-C-438-ONNCCE, «Tableros contrachapados de madera de pino y otras coníferas – Clasificación y especificaciones» (ficha). https://www.onncce.org.mx/tienda?view=item&mc=65&mi=207
23. Triplay México, «Tipos de triplay». https://triplaymexico.com.mx/tipos_de_triplay
24. Maderería Aztecas, «Triplay» (lista de precios). https://madereriaaztecas.com.mx/triplay
25. Tableros de México, «Triplay ruso» (lista de precios). https://tableros.com.mx/triplay-ruso/
26. Triplay VIC, «Triplay de abedul ruso». https://www.triplayvic.com/producto/triplay-de-abedul-ruso/
27. Todo en Tableros, «Triplay pino chileno» y «Triplay pino nacional». https://todoentableros.mx/producto/triplay-de-pino-chileno/ · https://todoentableros.mx/producto/triplay-de-pino-nacional-2/
28. Triplay Carpisur, «Preguntas frecuentes». https://carpisur.com.mx/preguntas-frecuentes/
29. COMATESA, «Triplay de caobilla» (resultado de búsqueda; describe caobilla y okume). https://comatesa.com.mx/producto/triplay-de-caobilla
30. Woodworkers Source, «Ultimate Guide to Baltic Birch Plywood» (resultado de búsqueda con los grados B/BB, BB/BB, BB/CP, CP/CP). https://www.woodworkerssource.com/blog/woodworking-101/tips-tricks/your-ultimate-guide-to-baltic-birch-plywood-why-its-better-when-to-use-it/
31. Wikipedia, «BS 1088». https://en.wikipedia.org/wiki/BS_1088
32. Winwood Products, «BS 1088 Gaboon/Okoume Marine Plywood» (resultado de búsqueda: 450–500 kg/m³). https://www.winwood-products.com/eng/timber-products/plywood/okoume-plywood.htm
33. ToolsToday, «How to Prevent Plywood Tearout». https://toolstoday.com/learn/how-to-prevent-plywood-tearout
34. Woodcraft, «Getting the Edge: Plywood Edge Treatments». https://www.woodcraft.com/blogs/wood/getting-the-edge-plywood-edge-treatments
35. Canplast, «Todo lo que debes saber del cubrecanto». https://canplast.com.mx/blogs/news/todo-lo-que-debes-saber-del-cubrecanto
36. Tabylam, «Cómo elegir cubrecanto» (resultado de búsqueda). https://tabylam.mx/blog/como-elegir-cubrecanto/
37. Doctor Mueble, «Diferentes tipos de tableros de madera: MDF / triplay / aglomerado / OSB». https://www.doctormueble.com.mx/diferentes-tipos-de-tableros-de-madera-mdf-triplay-aglomerado-osba04f2852
38. Wikipedia, «Monterrey» (tabla climática). https://en.wikipedia.org/wiki/Monterrey
39. Wikipedia, «Guadalajara» (tabla climática). https://en.wikipedia.org/wiki/Guadalajara
40. Wikipedia, «Mérida, Yucatán» (tabla climática). https://en.wikipedia.org/wiki/M%C3%A9rida,_Yucat%C3%A1n
41. Royale Touche, «Common Plywood Defects and How to Identify Them Before Buying» (resultado de búsqueda). https://plywood.royaletouche.com/blogs/plywood-defects-and-how-to-identify-them
42. Inch Calculator, «Actual Plywood Thickness and Size» (resultado de búsqueda). https://www.inchcalculator.com/actual-plywood-thickness-size/
43. Total Market, «Triplay listón caobilla 18 mm» (resultado de búsqueda). https://www.totalmarket.com.mx/product/triplay-liston-caobilla-18-mm/
44. The Home Depot México, «Sala de cortes». https://www.homedepot.com.mx/sala-cortes
