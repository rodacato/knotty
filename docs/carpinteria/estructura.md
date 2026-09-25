# Estructura de muebles de triplay

> Cuánto se pandea una repisa, cómo se escuadra un casco, dónde se puede ahorrar material sin perder resistencia, cajones, puertas, vuelco, anclaje al muro, asientos y camas. Consultado el 2026-09-25. Todo en milímetros y kilogramos; cuando algo se vende en pulgadas se da primero el valor métrico y después la designación comercial, p. ej. 32 mm (1¼").
>
> **Confianza.** ✅ dos o más fuentes independientes coinciden, o se verificó en la fuente primaria · ⚠️ una sola fuente o práctica de taller · ❓ supuesto o cálculo propio por validar (con la prueba casera del §1.8 o la ficha del fabricante).
>
> **Notación.** `L` claro libre, `b` fondo de la repisa, `t` espesor, `q` carga por área (kg/m²), `w` carga por longitud (N/mm), `E` módulo de elasticidad (modulus of elasticity, MOE), `I` momento de inercia, `δ` pandeo (en ingeniería, «flecha»; deflection), `k` factor de fluencia (creep). Las referencias `[n]` están en «Fuentes».

---

## Resumen

1. **El pandeo de una repisa se calcula con la fórmula de viga simplemente apoyada con carga uniforme** (§1.1). La fórmula es de manual; lo que decide el resultado son tres supuestos: la rigidez del triplay, la fluencia y la carga. ✅
2. **Los valores que circulan en calculadoras y tablas de taller son optimistas.** E = 6 000 MPa es el de APA para especies del Grupo 1 (abeto Douglas, pino del sur); el triplay de pino radiata medido da 4 742 MPa [7]. Con la veta atravesada, un triplay de 5 capas baja a ≈ 1 700–1 900 MPa [6]. Y la fluencia de los tableros no es 1.5 (madera maciza) sino ≈ 2.0: NDS [8], Eurocódigo 5 [9] y Wood Handbook [10] coinciden.
3. Con valores realistas (E∥ 4 500, E⊥ 2 000, fluencia 2.0), **una repisa de 18 mm con libros no debería pasar de ≈ 540 mm sin apoyo si quieres que se vea recta**, y a partir de **≈ 830 mm** se ve claramente pandeada (≈ L/100). La regla de taller «18 mm, no más de 80–90 cm» y el Sagulator (813 mm [2]) marcan el límite de lo *aceptable*, no el de lo *invisible*: ignoran la fluencia o usan un E alto.
4. **Una tira de refuerzo de madera maciza de 18 × 40 mm pegada al frente triplica la rigidez** (`I` × 3.0): la repisa de 18 mm con libros pasa de 540 a 780 mm. Es la solución más barata antes de subir de espesor (§1.7).
5. **Una cómoda de triplay de 90 cm se vuelca sola** si se abren todos los cajones llenos de ropa, sin necesidad de que un niño se suba (cálculo propio con la prueba de ASTM F2057-23 [12]). La norma aplica desde 686 mm (27") de alto: **toda cajonera de esa altura o más va anclada al muro** (§6).
6. En México **no encontré una NOM vigente de estabilidad de muebles**; solo las NMX-Q-038 a 044 de 1981–1982 (muebles domésticos) [24]. La «NOM-167-SCFI-2009» que cita un blog [25] no aparece en el DOF. ❓
7. Además del pandeo, el documento cubre la capacidad de las correderas, el espesor del fondo del cajón, el peso de las puertas, el anclaje según el tipo de muro, las repisas flotantes, la resistencia de asientos y camas, y dónde ahorrar material oculto.

---

## 1. Pandeo de repisas

### 1.1 La fórmula

Repisa (shelf; en taller también «entrepaño») apoyada en sus dos extremos, con carga repartida:

```
w = q · g · b / 10⁶            [N/mm]    (q en kg/m², b en mm)
I = b · t³ / 12                 [mm⁴]
δ_inst = 5 · w · L⁴ / (384 · E · I)
δ_final = k · δ_inst
```

Es la fórmula de viga que usan el Sagulator [1] y los manuales de ingeniería. ✅

**Dos consecuencias útiles:**

- Si la carga es por área (`q` en kg/m²), **el fondo `b` se cancela**: `w ∝ b` e `I ∝ b`. El claro máximo **no depende del fondo** de la repisa. Solo depende de él cuando la carga es por metro lineal (una fila de libros pesa lo mismo en una repisa de 250 que en una de 400).
- `δ ∝ L⁴ / t³`: duplicar el claro multiplica el pandeo por 16; subir de 15 a 18 mm lo divide entre 1.73.

**Apoyo simple vs empotrado.** El cálculo supone apoyo simple (extremos libres para girar). Una repisa fija metida en ranura y pegada gira menos. WOODWEB reporta que fijar los extremos deja el pandeo en ≈ 1/3 del de extremos libres [3] ⚠️; en teoría, un empotramiento perfecto lo deja en 1/5. Suponer apoyo simple es conservador y es lo correcto para repisas móviles sobre soportes. ✅

**Ejemplos** (18 mm, fondo 300, libros = 150 kg/m², E = 6 000, k = 1.5, es decir, con los valores optimistas): claro 600 → 1.28 mm; claro 900 → 6.47 mm; 900 con un divisor al centro (2 × 441) → 0.37 mm; 15 mm con claro 600 → 2.21 mm. Con los valores recomendados del §1.2 y §1.3, cada pandeo crece ≈ 1.8 veces.

### 1.2 Módulo de elasticidad del triplay

El triplay (plywood) alterna la veta de sus chapas (veneers). En flexión, las chapas de las caras son las que más trabajan, así que el `E` efectivo depende de la dirección de la veta de las caras respecto al claro y del número de capas.

| Fuente | Tablero | E∥ (veta de la cara a lo largo del claro) | E⊥ | Confianza |
|---|---|---|---|---|
| Ficha Eagon (Chile), EN 310 [7] | Pino radiata 18 mm, 7 capas, 500 kg/m³ | **4 742 MPa** | **3 912 MPa** | ✅ medido |
| APA Panel Design Spec., tabla 4B [6] | Lijado Grupo 1, 23/32" (18.3 mm) | EI = 320 000 lb·in²/ft → **≈ 5 940 MPa** | EI = 90 500 → **≈ 1 680 MPa** | ✅ |
| APA [6] | Lijado Grupo 1, 3/4" (19 mm) | 355 000 → ≈ 5 800 MPa | 115 000 → ≈ 1 880 MPa | ✅ |
| APA [6] | Lijado Grupo 1, 5/8" (15.9 mm) | 230 000 → ≈ 6 500 MPa | 48 500 → ≈ 1 370 MPa | ✅ |
| APA, tabla 4C [6] | Pinos del Grupo 4 (ponderosa, blanco) | × 0.56 → ≈ 3 300 MPa | ≈ 940 MPa | ✅ |
| Forests (MDPI), 2025 [27] | Pino radiata, en el plano | «cerca de 5 GPa» | — | ⚠️ |

*Conversión APA:* `E = EI / I`, con `I = 12 in · t³ / 12 = t³` por pie de ancho. Para 23/32": `I = 0.3713 in⁴/ft`, `E = 320 000 / 0.3713 = 861 800 psi = 5 942 MPa`.

**Lectura:**

- El Grupo 1 de APA incluye abeto Douglas y pino del sur, más rígidos que el pino radiata o el pino mexicano. El triplay de pino de Home Depot MX y de las madererías suele ser radiata chileno o pino nacional; la ficha Eagon es la referencia más cercana, aunque es de un fabricante chileno distinto de Arauco: confirma el orden de magnitud, no el tablero exacto. ⚠️
- El `E⊥` varía mucho según las capas: con 5 capas el núcleo cruzado aporta poco (≈ 1 700 MPa); con 7 capas balanceadas sube a ≈ 3 900 MPa. Como casi nunca se sabe cuántas capas tiene la hoja, conviene suponer lo peor.
- En México también se vende **caobilla de 15 y 18 mm «listonado»** (blockboard: núcleo de listones macizos con chapas encima) [23]. Es mucho más rígido en la dirección de los listones y muy débil en la otra. ❓ No le apliques los valores del triplay.

**Valores recomendados para triplay de pino radiata** (conservadores; calibrables con la prueba casera del §1.8). En los tableros delgados las chapas de la cara pesan más en la inercia, por eso E∥ sube al bajar el espesor:

| Espesor | E∥ | E⊥ |
|---|---|---|
| 18 mm | **4 500 MPa** | **2 000 MPa** |
| 15 mm | 5 000 MPa | 1 500 MPa |
| 12 mm | 5 500 MPa | 1 000 MPa |
| 9 mm | 5 500 MPa | 800 MPa |
| 6 mm | — | 700 MPa |
| Referencia optimista, 18 mm (APA Grupo 1; Eagon ⊥) | 6 000 MPa | 3 900 MPa |
| Abedul báltico 18 mm (ver [triplay.md](triplay.md)) | 9 000 MPa | 6 900 MPa |

Las fuentes discrepan: la ficha medida de radiata da 4 742 y APA Grupo 1 ≈ 5 900. Se adopta 4 500 como valor conservador hasta medir el triplay que se vende en México; con 5 000 los claros suben ≈ 4 %. La tabla del §1.6 usa 4 500 en todos los espesores, así que en 12 y 15 mm queda del lado seguro (≈ 3–7 % de claro de más si se usa el valor por espesor). Resistencia a la flexión (MOR): Eagon mide 44.2 ∥ / 39.9 ⊥ MPa [7]; para diseñar se toma **40 MPa** con σ ≤ MOR / 3.

### 1.3 Fluencia (creep)

| Fuente | Factor de pandeo final / inicial |
|---|---|
| Wood Handbook (FPL): «después de varios años, la deformación adicional por fluencia puede ser aproximadamente igual a la deformación elástica inicial» [10] | ≈ 2.0 |
| NDS 2018 (AWC), ec. 3.5-1: `K_cr = 1.5` madera seca y glulam; **`K_cr = 2.0` tableros estructurales (wood structural panels)** en servicio seco [8] | 2.0 |
| Eurocódigo 5, tabla de `k_def`: triplay EN 636, clase de servicio 1 → 0.80; clase 2 → 1.00 [9] | 1.8 – 2.0 |
| Sagulator: «las repisas se pandean un 50 % adicional con el tiempo» [1] | 1.5 |

**Recomendación:** `k = 2.0` para triplay bajo carga permanente (libros, platos, ropa, televisión). ✅ (3 fuentes). El 1.5 del Sagulator es el de la madera maciza. Para cargas que no se quedan puestas (un asiento, una persona que se sube a la cama) va `k = 1.0`. El Wood Handbook añade que un aumento de ≈ 28 °C puede duplicar o triplicar la fluencia [10]: en cocinas junto a la estufa o en repisas al sol, 2.0 se queda corto. ⚠️

### 1.4 Cargas

| Uso | Dato de la fuente | En kg/m² (fondo 300 mm) | Confianza |
|---|---|---|---|
| Libros, librero lleno | 9–18 kg por pie lineal = **30–59 kg/m** [1] | 100–197 | ✅ |
| Libros | 20–25 lb/pie = 30–37 kg/m [2]; 20 lb/pie² = 98 kg/m² [2] | 98–123 | ✅ |
| Libreros de escuela, hospital o biblioteca | 50 lb/pie² = **244 kg/m²** (norma AWS) [4] | 244 | ✅ |
| Otras repisas (AWS) | 40 lb/pie² = **195 kg/m²**; nunca más de 90.7 kg por repisa [4] | 195 | ✅ |
| Gabinete de cocina (prueba KCMA A161.1) | 15 lb/pie² = **73 kg/m²** durante 7 días, en repisas, pisos y cajones [11] | 73 | ⚠️ |
| Ropa en cajones | 8.5 lb/pie³ = **136 kg/m³** (densidad de relleno de ASTM F2057-23) [12] | Pila de 350 mm ≈ 48 | ✅ |
| Platos y despensa | Entre KCMA (73) y AWS (195) | ≈ 100–150 | ❓ |
| Televisión | Peso de la ficha del aparato; 2 cargas puntuales en sus patas | — | ❓ |
| Una persona (asiento, cama) | 110 kg, factor dinámico × 2, sin fluencia (§7.2) | — | ❓ |

**Cargas de diseño de referencia:** ligera 50 kg/m², media 100, libros 150; biblioteca o archivo 244. Quedan dentro de los rangos de las fuentes. ✅

### 1.5 Cuánto pandeo es aceptable: L/360, L/200, L/144…

| Fuente | Criterio | Equivale a |
|---|---|---|
| Sagulator [1] | Meta: 0.02"/pie (1.7 mm/m) **instantánea**; el ojo nota 1/32"/pie | L/600 inicial ≈ **L/400 final** (con su 1.5) |
| WoodBin, «Shelves» [2] | El ojo nota 1/32"/pie | **L/384** |
| AWS (AWI/AWMAC/WI) [4] | «L/144 es el estándar de la industria para la flecha máxima aceptable» (6.4 mm en 914 mm), sin contar la fluencia | L/144 instantánea |
| WOODWEB [3] | Fabricantes de aglomerado y MDF: ≈ L/240; «la gente del triplay»: L/180 | — |

**Lectura:**

- **L/360 sobre el pandeo final** coincide con el límite de lo visible (L/384–L/400 [1][2]). Por debajo de eso, la repisa se ve recta. ✅
- **L/100 sobre el pandeo final** es el límite de «claramente pandeada». Sale de la AWS: su L/144 instantánea con 244 kg/m² equivale, con libros de 150 kg/m² y fluencia 2, a `δ_final = δ_AWS × 150/244 × 2 = 1.23 · δ_AWS` → L/117; redondeado a L/100. ⚠️ Con este criterio, la repisa de 18 mm con libros llega al límite en ≈ 830 mm, que es justo donde la regla de taller dice «ya no» (80–90 cm) [2][3]. Si se prefiere más margen, L/120 lo lleva a ≈ 780 mm.
- L/200 como límite resulta demasiado estricto con valores realistas: marcaría como inaceptable una repisa de 18 mm con libros desde 680 mm, cuando la industria (AWS) acepta L/144 instantánea con 244 kg/m².
- **Un pandeo es un problema de apariencia, no de seguridad**, salvo cuando la pieza carga personas (asientos, camas: §7), donde además se revisa la resistencia.

**Resistencia de una repisa: casi nunca manda.** 18 mm, claro 900, libros: `M = w·L²/8`, `σ = M / (b·t²/6) = 2.8 MPa`, contra un MOR de 40–44 MPa [7]. Factor ≈ 15. En repisas manda el pandeo; en asientos y camas no (§7).

### 1.6 Tabla de claros máximos recomendados

Supuestos: triplay de pino con la veta de las caras a lo largo del claro, `E = 4 500 MPa`, `k = 2.0`, apoyo simple, carga repartida. Cada celda es **claro sin pandeo visible (L/360) / claro límite (L/100)**, en mm, redondeado a 10. Vale para cualquier fondo (§1.1). ❓ Cálculo propio con [1][6][7][8].

| Espesor | Ligera 50 kg/m² | Media 100 | Libros 150 | Biblioteca (AWS) 244 |
|---|---|---|---|---|
| 12 mm | 520 / 800 | 410 / 630 | 360 / 550 | 310 / 470 |
| 15 mm | 650 / 1 000 | 520 / 790 | 450 / 690 | 380 / 590 |
| 18 mm | 780 / 1 200 | 620 / 950 | **540 / 830** | 460 / 710 |
| 2 × 18 mm laminado y pegado (36) | 1 560 / 2 390 | 1 240 / 1 900 | 1 080 / 1 660 | 920 / 1 410 |
| 15 mm + tira de refuerzo 18 × 40 | 1 100 / 1 690 | 880 / 1 340 | 760 / 1 170 | 650 / 1 000 |
| 18 mm + tira de refuerzo 18 × 40 | 1 130 / 1 730 | 900 / 1 370 | **780 / 1 200** | 670 / 1 020 |

- **Con la veta atravesada** (`E⊥ = 2 000`), la repisa de 18 mm con libros baja a 410 mm. Por eso la veta de las caras va siempre a lo largo del claro. ✅
- **Comparación con las fuentes:** WoodBin da 813 mm (32") para 3/4" de triplay [2]. Se reproduce con `E = 6 000`, sin fluencia y a L/384 (cálculo: 847 mm). Las reglas de taller de 60–90 cm [3][28] son del mismo orden. La tabla es más conservadora porque incluye la fluencia y un E de pino radiata.
- **Laminar dos hojas solo sirve si van pegadas en toda la cara**: pegadas, `I` se multiplica por 8 y el claro por 2. Solo atornilladas, cada hoja trabaja sola: `I` × 2 y el claro × 1.26. WOODWEB: «arriba de 34" laminamos dos capas de 3/4" con canto de 1½"» [3]. ⚠️

### 1.7 La tira de refuerzo al frente

Una tira de refuerzo (edge band, cleat) de madera maciza pegada al frente, más alta que el espesor de la repisa, funciona como una viga en T. WoodBin la recomienda («un listón de 1 a 2 pulgadas al frente o atrás» [2]) y da 813 → 1 067 mm (32 → 42") con un listón y 1 219 mm (48") con dos [2]; WoodCalcs dice que «efectivamente duplica la rigidez» [28]. ✅

**Cálculo de la sección compuesta** (repisa de 300 × 18 de triplay con E = 4 500; tira de pino macizo de 18 de grueso × 40 de alto, al ras por arriba, con E = 8 000 MPa, conservador frente a los 8 900 MPa del pino ponderosa [10]):

```
n = E_tira / E_triplay = 8 000 / 4 500 = 1.78           (sección transformada)
Triplay: A1 = 300·18 = 5 400 mm²,         y1 = 9 mm  (desde la cara de arriba)
Tira:    A2 = 1.78·18·40 = 1 280 mm²,     y2 = 20 mm
Eje neutro: ȳ = (5 400·9 + 1 280·20) / 6 680 = 11.1 mm
I = 300·18³/12 + 5 400·(9 − 11.1)² + 1.78·18·40³/12 + 1 280·(20 − 11.1)²
  = 145 800 + 23 800 + 170 900 + 101 200 ≈ 441 700 mm⁴
I / I₀ = 441 700 / 145 800 = 3.03
```

- El claro sube en `∛3.03 = 1.45` veces: de 540 a 780 mm con libros. ✅ Del orden de lo que dice WoodBin (×1.31 con un listón, ×1.5 con dos [2]).
- **Condiciones:** la tira va **pegada en toda su longitud** (y con clavo sin cabeza mientras seca); si solo se atornilla cada 20 cm, se desliza y aporta mucho menos. Una tira de triplay de 18 × 40 aporta menos (n ≈ 1). La veta de la tira va a lo largo. ⚠️
- **Más barato que subir de espesor:** una tira de 18 × 40 de 1 m son ≈ 0.00072 m³ de pino; la repisa sigue siendo de 18. La tira también sirve de cubrecanto visible.

**Televisión de 20 kg sobre repisa de 1 200 mm** (2 patas a L/3, fondo 400, k = 2): 18 mm sola → 13.8 mm (L/87, mal); con tira de refuerzo 18 × 40 → 5.4 mm (L/223); 2 × 18 laminado → 1.7 mm (L/698). ❓ Cálculo propio.

**Qué hacer cuando una repisa no da el claro**, de lo más barato a lo más caro: tira de refuerzo 18 × 40 al frente; un divisor al centro; el siguiente espesor; laminar 2 × 18 pegado; acortar el claro.

### 1.8 Prueba casera para medir el E de tu triplay

1. Corta una tira de 100 × 1 000 mm del triplay, con la veta de las caras a lo largo.
2. Apóyala sobre dos listones separados `L = 900 mm`.
3. Cuelga al centro una cubeta con `P = 10 kg` de agua (10 litros) y mide el pandeo `δ` con una regla o un calibrador, al minuto.
4. `E = P·g·L³ / (48·δ·I)`, con `I = 100·t³/12`. Ejemplo: 18 mm, δ = 4.0 mm → `I = 48 600`, `E = 98.1·900³ / (48·4.0·48 600) = 7 660 MPa`. Si δ = 6.8 mm → E ≈ 4 500 MPa.
5. Repite con la tira cortada a lo ancho para obtener `E⊥`. Deja la carga una semana y vuelve a medir para estimar la fluencia.

---

## 2. Rigidez y escuadrado (racking)

Un casco (carcass) sin nada que lo triangule se deforma como un paralelogramo cuando se empuja de lado. Lo que lo impide, de más a menos eficaz:

| Solución | Cómo trabaja | Cuándo basta | Confianza |
|---|---|---|---|
| **Trasera (back) de 5.5–6 mm clavada y pegada** a laterales, piso y techo, con clavo o grapa cada 100–150 mm | Diafragma de cortante (como un muro de triplay en una casa) | Cualquier casco hasta 2.4 m. La opción por defecto | ✅ [26] y práctica |
| **Trasera de 2.5–3 mm pegada en rebaje o ranura** (rabbet/dado) | Mismo diafragma; el rebaje la escuadra y el pegamento evita que se deslice | Cascos medianos. Solo clavada, sin pegamento, el clavo se sale del tablero delgado | ⚠️ [26] |
| Trasera de 3 mm solo clavada por fuera | Poco: el clavo desgarra la chapa | Muebles bajos (< 600 mm) o con otro sistema | ⚠️ |
| **Travesaño (rail, stretcher) superior trasero + zoclo (kick) + repisa fija**, con bolsillo o tarugo y pegamento | Marco rígido por uniones que resisten momento | Muebles sin trasera o con trasera removible | ⚠️ |
| **Escuadras metálicas** (brackets) en las esquinas | Rigidizan cada esquina | Solo como refuerzo: el tornillo en el canto del triplay afloja con el uso | ⚠️ |
| **Cartela** (gusset) de triplay en la esquina interior | Triángulo pequeño pegado | Mesas y bastidores | ⚠️ |
| **Diagonal** (tirante) de madera o cable | Triangula el vano | Estructuras abiertas (anaqueles de taller) | ✅ principio de estática |

**Recomendaciones de oficio:**

- Un casco queda escuadrado con cualquiera de estas: trasera de 6 mm unida a por lo menos 3 piezas del perímetro; trasera de 3 mm pegada en rebaje o ranura; o un marco con al menos 2 travesaños rígidos, uno de ellos el travesaño trasero de arriba o el zoclo. ✅
- A partir de ≈ 600 mm de alto, un casco sin nada de lo anterior se tuerce de forma notable. ⚠️ Umbral de taller, sin fuente.
- Una **repisa fija en ranura y pegada** también rigidiza, aunque no sea travesaño ni zoclo. ⚠️
- **La trasera de 3 mm clavada sin pegamento casi no escuadra**: el clavo desgarra la chapa. Si es de 3, va pegada. ⚠️
- Un librero **abierto por detrás** (sin trasera, como separador de espacios) necesita travesaños atrás, arriba y abajo, y si mide más de 1 200 mm, cartelas o una diagonal. ❓

### 2.1 Mesas y escritorios: patas, faldón y bamboleo

El bamboleo (wobble) de una mesa viene de la **unión pata–cubierta**, no de la pata. Una pata atornillada solo a la cubierta, en su canto, gira como una bisagra. El **faldón** (apron) de 80–120 mm de alto, unido a las patas, crea un marco que resiste el momento. ⚠️ práctica de taller.

**Cálculo de una pata de triplay laminado** (2 × 18 = 36 × 72 mm, E = 4 500, alto libre bajo el faldón 650 mm, empujón lateral de 100 N ≈ 10 kg repartido en 4 patas):

```
I (eje débil) = 72·36³/12 = 279 936 mm⁴
Con faldón rígido (pata empotrada abajo y guiada arriba): δ = P·h³/(12·E·I) = 25·650³/(12·4 500·279 936) = 0.45 mm
```

Con faldón, una pata de 36 × 72 sobra. ❓ Sin faldón la pata trabaja como un voladizo desde una unión que cede; el bamboleo lo pone la unión (tornillos en el canto), no la sección.

**Recomendación:** una mesa o escritorio con patas lleva faldón o travesaños; sin ellos va a bambolear, y en una mesa de más de 600 mm de alto con cubierta de más de 1 200 mm el bamboleo será serio. El escritorio con cajonera a un lado y panel al otro (dos laterales de triplay) necesita un **travesaño o panel trasero de 100–150 mm** (modesty panel) o un panel trasero parcial. ⚠️

### 2.2 Muebles bajos con cubierta: dos travesaños en vez de techo

En un mueble bajo (base de cocina, credenza) que llevará cubierta (countertop), el techo completo no se ve ni carga nada: basta con **dos travesaños de 100 mm**, uno al frente y otro atrás, con bolsillo o tarugo. Es la práctica de los gabinetes europeos sin marco (frameless). ⚠️ Ahorro en el §3.

---

## 3. Ahorro de material sin perder estructura

**El ahorro solo es real si baja el número de hojas** o si el sobrante sirve para otro proyecto. Una hoja de 2 440 × 1 218 mide 2.97 m²; ahorrar 0.3 m² en un mueble que de todas formas usa dos hojas completas no ahorra nada.

| Medida | Ejemplo | Ahorro | Límite | Confianza |
|---|---|---|---|---|
| **Techo → dos travesaños de 100 mm** en un mueble bajo con cubierta | 800 × 560: 0.448 m² de triplay de 18 → 0.16 m² | **0.29 m² de 18 mm (64 %)**, ≈ 1/10 de hoja | Solo si la cubierta va encima y atornillada a los travesaños; no en muebles donde el techo se ve | ⚠️ |
| **Trasera de 3 mm pegada en rebaje** en vez de 6 mm clavada | 800 × 900 | 0.72 m² pasan de 6 a 3 mm (la mitad del volumen, hoja más barata) | Requiere router o sierra para el rebaje; no sirve para colgar | ⚠️ |
| **Costados y trasera de cajón de 12** en vez de 15/18 | 4 cajones, ≈ 0.98 m² | Un tercio menos de volumen que en 18; además gana 12 mm de ancho útil por cajón | El tornillo al canto de 12 mm agarra mal: usar clavo y pegamento, tarugo o rebaje. Blum Movento pide costado ≤ 16 mm [16] | ⚠️ |
| **Fondo de cajón de 6** (no de 12 ni 18) | — | — | 3 mm solo en cajones angostos (§4.3) | ❓ cálculo |
| **Laminar 2 × 18 solo en el canto visible** (cubierta que *parece* de 36) | Escritorio 1 200 × 600: tiras de 80 mm en el perímetro de abajo | La segunda capa baja de 0.72 m² a ≈ 0.28 m²: **0.44 m² de 18 mm** | La rigidez es la de 18 + faldón perimetral (no la de 36), pero suficiente con patas o faldón | ⚠️ |
| **Tapas ocultas en triplay de menor grado** (cara C o «de segunda») | Pisos detrás de puertas, traseras, bases | Depende del precio local | Solo caras que no se ven; evitar hojas con huecos en el núcleo donde van tornillos | ❓ |
| **Marco en vez de panel** (bastidor de tiras de 70–100 mm) | Laterales ocultos entre muebles, fondos de clóset | 40–60 % del área | Rigidiza menos que un panel; necesita uniones con momento (bolsillo, tarugo) | ⚠️ |
| **Zoclo como travesaño** en vez de piso doble | — | — | El zoclo también escuadra (§2) | ⚠️ |

---

## 4. Cajoneras

### 4.1 La caja del cajón

- **Construcción típica en triplay:** caja de 4 lados (contrafrente, 2 costados, trasera) de 12–15 mm y fondo de 6 mm en ranura a 10–12 mm del borde inferior, o clavado y pegado por debajo. El frente del cajón va aparte, atornillado desde dentro. ⚠️ práctica (la norma AWS lo describe, pero su parte de cumplimiento es de pago [5]).
- **Holgura lateral según la corredera:**

| Corredera | Holgura por lado | Tolerancia | Capacidad | Fuente |
|---|---|---|---|---|
| Telescópica de balines, montaje lateral (Accuride 3832 y similares) | **12.7 mm (½")** | **+0.8 mm (1/32"), nunca menos**: «puede no funcionar si el espacio es menor de 12.7 mm» | 45.5 kg por par | ✅ [14] |
| Oculta bajo el cajón (Blum Movento) | Ancho interior del cajón = hueco − 42 mm (+0 / −1.5) | Costado ≤ 16 mm | 40 kg (según modelo) | ✅ [15][16] |
| Handy Home 35 mm de ancho, 45 cm (Home Depot MX) | 12.7 mm típico | — | **20 kg** | ⚠️ [17] |
| Handy Home 45 mm, extensión total, 39.5 cm (Home Depot MX) | 12.7 mm típico | — | **30 kg** | ⚠️ [17] |

**La tolerancia es asimétrica:** el hueco puede quedar hasta 0.8 mm **mayor** que lo que pide la corredera, **nunca menor**. ✅ [14] Por eso conviene **hacer la caja 26 mm más angosta que el hueco** (13 mm por lado, al centro de la tolerancia): así medio milímetro de error de corte no la deja fuera. Accuride sugiere 27 mm [14], que queda justo en el límite. ⚠️

- **Profundidad útil:** largo de la corredera ≤ fondo interior − espesor del frente (si va embutido) − ≈ 10 mm. Blum: largo del cajón = largo nominal − 10 [15]. En Home Depot MX hay correderas de 30, 40 y 45 cm [17]. ✅
- **Altura:** la caja mide 20–40 mm menos que el hueco, para meterla y sacarla con la corredera. ⚠️
- **Separación entre frentes sobrepuestos:** 2–3 mm. ⚠️
- **¿Travesaño entre cajones?** Con correderas laterales en un casco de triplay no hace falta: la corredera se atornilla al lateral. Sí hace falta con correderas de madera, con cajones sobre guías o en muebles con marco (face frame). ⚠️
- **Topes:** las correderas de balines traen tope y retén. Las de madera necesitan un tope trasero y un retén para que el cajón no se salga. ⚠️

### 4.2 Cajones anchos, altos o pesados

| Caso | Riesgo | Recomendación | Confianza |
|---|---|---|---|
| Ancho > 600 mm | La caja se tuerce y las correderas se traban; el fondo se pandea | Fondo de 6 mm como mínimo (9 si lleva carga pesada); costados de 15; correderas de 45 kg | ⚠️ |
| Ancho > 900 mm | Se atora al jalarlo de una jaladera descentrada | Dividir en dos cajones o poner dos jaladeras | ❓ |
| Frente > 300 mm de alto | Pesa y palanquea las correderas | Correderas de extensión total de 45 kg o más | ❓ |
| Cajón de archivo (carpetas) o de herramientas | Carga pesada | Carga de diseño ≥ 150 kg/m² de fondo del cajón; correderas ≥ 45 kg; fondo de 9 mm o de 6 con travesaño | ❓ |
| Carga del cajón > capacidad de la corredera | Se vencen los balines | Calcula la carga (carga por área × área del fondo, o 136 kg/m³ × volumen si es ropa); si pasa de la capacidad, usa la corredera siguiente | ✅ datos [14][17] |

*Ejemplo:* un cajón de 730 × 400 con ropa (136 kg/m³ [12], 140 mm de ropa) carga 5.6 kg: cualquier corredera sirve. El mismo cajón con libros de pie (150 kg/m² × 0.29 m² = 44 kg) supera la Handy Home de 20–30 kg [17]. ❓ Cálculo propio.

### 4.3 Fondo de cajón: 3 contra 6 mm

Una placa apoyada en sus cuatro lados (fondo en ranura), con la carga de prueba KCMA de 73 kg/m² [11] y `E = 4 500`. Calculado con la solución de Navier, sin fluencia:

| Ancho × 400 de fondo | 3 mm | 6 mm | 9 mm |
|---|---|---|---|
| 300 | 3.5 mm | 0.4 | 0.1 |
| 450 | 8.3 | 1.0 | 0.3 |
| 600 | 12.7 | 1.6 | 0.5 |
| 800 | 16.7 | 2.1 | 0.6 |

Con 150 kg/m² (archivo, libros) y 6 mm: 2.8 mm a 450 de ancho, 4.5 a 600, 6.2 a 800; con 9 mm: 0.8 / 1.3 / 1.9. ❓ Cálculo propio.

**Recomendación:** fondo de 6 mm como estándar; **3 mm solo en cajones de menos de 300 mm de ancho** con carga ligera; 9 mm (o 6 con un travesaño debajo) cuando el cajón lleva carga pesada y mide más de 600 de ancho. ⚠️ cálculo.

---

## 5. Puertas

- **Peso:** triplay de 18 mm a ≈ 540 kg/m³ (peso real de las hojas que se venden en México; la ficha Eagon da 500 [7]) → **≈ 9.7 kg/m²**. Una puerta de 600 × 2 000 pesa ≈ 11.7 kg; una de 450 × 700, ≈ 3.1 kg. ❓ Cálculo propio.
- **Número de bisagras: por alto y por peso, lo que pida más.** La norma AWS remite al fabricante («siga las recomendaciones del fabricante de bisagras sobre número y separación» [4]). La tabla de Blum (detalle en [uniones-y-herrajes.md](uniones-y-herrajes.md)):

| Alto de la puerta hasta | Peso hasta | Bisagras |
|---|---|---|
| 900 mm | 6 kg | 2 |
| 1 600 mm | 12 kg | 3 |
| 2 000 mm | 18 kg | 4 |
| 2 400 mm | 22 kg | 5 |

  Si la hoja mide 601–650 mm de ancho, una bisagra más. ✅
- **Ancho máximo:** 600 mm, práctica de taller en gabinetes sin marco (601–650 con una bisagra más; más ancho, dos hojas). ⚠️ Además, una puerta ancha barre mucho espacio y cuelga de un solo lado.
- **Alabeo (warp) en puertas altas:** el triplay es más estable que la madera maciza, pero una puerta de más de ≈ 1 800 mm puede arquearse si una cara recibe más humedad o más acabado que la otra. Remedios de taller: la veta a lo largo; **el mismo acabado en las dos caras** (acabado balanceado); **4 bisagras o más**, que la mantienen recta; o un enderezador de puerta. ⚠️
- **Espesor para bisagra de cazoleta de 35 mm:** la cazoleta estándar mide 13 mm de hondo, así que la puerta debe ser de **16 mm o más** (18 es lo ideal). En 15 mm funciona, pero queda poco material bajo la cazoleta. Por debajo de 14 mm hace falta una bisagra especial para puerta delgada: Blum admite puertas de 8 a 24 mm según el modelo [29], y el 8 es solo para esa bisagra especial (8–14 mm). Las fuentes de taller hablan de 15 mm como mínimo; aquí se pide 16 por la profundidad de la cazoleta. ✅
- **Puertas corredizas:** en triplay de 18 son pesadas (≈ 10 kg/m²) y el riel inferior junta polvo. Para hojas de más de 1 200 mm de alto conviene riel colgado arriba y guía abajo; traslape entre hojas de 20–30 mm. ⚠️ **Puertas abatibles hacia abajo** (secreter): necesitan compás o tirante con tope que aguante una persona recargada (≈ 25 kg en la orilla). ❓

---

## 6. Vuelco y anclaje

### 6.1 Normas

| Norma | Qué exige | Confianza |
|---|---|---|
| **ASTM F2057-23**, obligatoria en EE.UU. desde el 1-sep-2023 por la **ley STURDY** (CPSC) [12][13] | Aplica a muebles de guardado de ropa (cómodas, roperos, burós, armarios) **≥ 686 mm (27") de alto, ≥ 13.6 kg y ≥ 90.6 L** de volumen cerrado. No deben volcarse con **todas las puertas y cajones abiertos**, con cajones llenos (**136 kg/m³**), sobre un calce de **10.9 mm (0.43")** que simula la alfombra, y con **27.2 kg (60 lb)** en la orilla de un cajón abierto. Fuerza horizontal de 44.5 N (10 lb) en jaladeras de hasta 1 422 mm (56") de alto. Etiqueta de advertencia. Valores verificados en el Federal Register [12] el 2026-09-25 | ✅ |
| **México** | No encontré una NOM de estabilidad. Hay normas voluntarias antiguas: **NMX-Q-042-1982** (muebles domésticos – guardado), NMX-Q-039 (mesas), NMX-Q-044 (camas) [24]; no pude leer su contenido. Un blog cita la «NOM-167-SCFI-2009» [25], pero no aparece en el DOF: no usarla | ❓ |
| Europa, EN 14749 (muebles de guardado) | No se consultó | ❓ |

### 6.2 Cálculo: cómoda de 900 × 800 × 450 con 4 cajones

Masas con triplay de 500 kg/m³ [7] (para vuelco se usa la densidad baja: más ligero es el peor caso): casco (laterales, piso y techo de 18 y trasera de 6) ≈ 15.9 kg; cada cajón (frente de 18, costados y trasera de 12, fondo de 6) ≈ 3.9 kg; ropa por cajón ≈ 5.6 kg (136 kg/m³ [12]).

Punto de giro: la orilla delantera de la base. Cajones de extensión total que salen 400 mm.

```
Momento que la sostiene: casco 15.9 kg × 0.225 m                      = 3.6 kg·m
Momento que la voltea:   4 cajones × 9.5 kg × (0.40 − 0.20) m          = 7.5 kg·m   ← ya se vuelca
                         + niño de 27.2 kg en la orilla × 0.40 m        = 10.9 kg·m
```

**Un mueble de triplay es ligero: la cómoda se vuelca con los cajones abiertos y llenos, sin niño.** ❓ Cálculo propio con los criterios de F2057 [12]. Conclusión: **toda cajonera de 686 mm o más va anclada al muro**; subirle el fondo no alcanza.

### 6.3 Recomendaciones

- **Todo mueble de guardado con cajones o puertas de 686 mm de alto o más va anclado al muro**, se llame como se llame (cómoda, buró alto, zapatera, clóset). La norma lo pide para muebles de ropa; el cálculo del §6.2 muestra que aplica a cualquier casco de triplay con cajones. ✅ [12]
- **Para revisar la estabilidad sin anclaje**, compara el momento que lo sostiene (masa × distancia del centro de gravedad al punto de giro) contra el que lo voltea: cajones abiertos y llenos, más 27.2 kg en la orilla del cajón más alto que esté a 1 422 mm o menos. Si voltea, se ancla con un kit antivuelco. ✅ criterios [12]; ❓ la simplificación.
- **Libreros y roperos sin cajones:** con una relación alto/fondo de 3 o más conviene anclarlos; con 4 o más y más de 1 200 mm de alto, anclarlos es obligatorio. Recomendable anclar todo librero desde 1 200 mm. ⚠️ Umbrales de taller sin fuente, pero en la dirección correcta.
- **Anclaje:** al menos 2 anclajes, a la estructura del muro (no solo a la tablaroca) (§8), nunca a la trasera delgada. ⚠️

---

## 7. Pisos, bases, bancas y camas

### 7.1 Patas o zoclo

- **Zoclo corrido** (kick): reparte la carga y rigidiza (§2). En cocinas lo usual es 80–100 mm de alto, remetido ≈ 50 mm; en muebles de recámara, 50–70 mm (ver [muebles-y-medidas.md](muebles-y-medidas.md)). ⚠️
- **Patas:** cada pata concentra la carga; el piso del mueble trabaja como viga entre patas. Un piso sobre patas se revisa como una repisa (§1), con la carga real del mueble; como regla rápida, un piso de más de 800 mm sin apoyo intermedio necesita revisión. ❓
- **Pata al centro:** muebles sobre patas de más de ≈ 1 200 mm de ancho → patas intermedias. ⚠️ **Niveladores:** los pisos en México rara vez están a nivel; conviene un nivelador por pata. ⚠️

### 7.2 Bancas y asientos (cargas de personas)

- **Carga de diseño:** una persona de 110 kg (la misma de la norma europea de camas EN 1725 [21]); dos personas en una banca de 1 200. Carga **dinámica**: sentarse de golpe ≈ × 2. Sin fluencia. ❓
- **Cálculo** (asiento de 350 de fondo, 180 kg repartidos, E = 4 500, MOR ≈ 40 MPa [7]):

| Asiento | Claro 800 | Claro 1 000 | Claro 1 200 |
|---|---|---|---|
| 18 mm solo | 15.4 mm (L/52), σ 9.3 MPa | 30 mm (L/33), σ 11.7 | 52 mm (L/23), σ 14.0 → con × 2 dinámico, 28 MPa: factor 1.4 ✗ |
| 2 × 18 laminado | 1.9 mm (L/416) | 3.8 mm (L/266) | 6.5 mm (L/185) |
| 18 + 2 faldones de 18 × 80 (frente y atrás) | — | 0.8 mm (L/1 263) | 1.4 mm (L/877) |

**Recomendación:** un asiento se calcula con la carga de personas (× 2 dinámico) y debe cumplir las dos cosas: esfuerzo `σ ≤ MOR/3` y pandeo ≤ L/200. Un asiento de triplay de 18 mm solo no sirve para bancas de más de ≈ 800 mm de claro; con **dos faldones de 18 × 80** (frente y atrás) o laminado 2 × 18 sí. ❓

### 7.3 Camas

- **Separación entre tablillas** (slats): **≤ 75 mm (3")** para colchones de espuma, látex o híbridos; hasta 100 mm (4") para resortes. Varias garantías de colchón piden ≤ 75 mm. ✅ [22] y otras fuentes coincidentes.
- **Carga de diseño:** EN 1725:2023 supone un usuario de hasta 110 kg [21]. Una cama matrimonial para dos: ≈ 220 kg de personas + 30 kg de colchón. ❓
- **Tablilla de triplay de 18 × 100 a cada 175 mm** (75 de hueco), 220 kg/m² bajo una persona, sin fluencia:
  - Claro de 660 (matrimonial de 1 350 con **apoyo central**): δ 4.3 mm, σ 3.8 MPa. Bien.
  - Claro de 1 335 (sin apoyo central): δ 71 mm, σ 15.6 MPa. **No sirve.**
  - Una rodilla (110 kg × 1.5) sobre **una** tablilla de 660: σ 49.5 MPa > MOR ≈ 44 [7] → se rompe si no reparte. El colchón reparte entre 3 o más tablillas (≈ 16 MPa). Por eso las tablillas de triplay deben ser de 18 × 100 o más. ❓
- **Apoyo central:** con tablillas de 18 × 100, el claro no debería pasar de **≈ 700 mm**; desde la matrimonial va un apoyo central, y en la king (2 000 mm de ancho la mexicana, 1 930 la de EE.UU.) dos apoyos intermedios. La cama con plataforma de triplay de 18 continua también necesita apoyos a cada ≈ 600–700 mm (revísala como un asiento, §7.2). ❓

---

## 8. Muebles colgados, repisas flotantes y muros de México

### 8.1 Física del colgado

Un mueble colgado de la parte de arriba y apoyado en el muro abajo crea un par de fuerzas: los anclajes de arriba trabajan **a extracción** (tension, pull-out) y todos trabajan **a cortante** (shear).

```
Extracción total ≈ W · e / h
  W = peso (mueble + contenido), e = distancia del muro al centro de gravedad, h = distancia vertical entre el anclaje de arriba y el apoyo de abajo
Alacena de 50 kg, e = 150 mm, h = 700 mm → 10.7 kg a extracción + 50 kg a cortante
Repisa flotante de 20 kg, e = 125 mm, h ≈ 30 mm (dentro de su espesor) → 83 kg a extracción
```

❓ Cálculo propio. **La repisa flotante es la trampa:** el brazo `h` es diminuto y la extracción se multiplica por 4–8. Necesita varilla o soporte metálico que entre en muro macizo, o taquete químico; en tablaroca, solo cargas ligeras y atornillada a un refuerzo interior.

**Para revisar un mueble colgado:** extracción = `W·e/h` y cortante = `W`; cada una debe quedar por debajo del número de anclajes × la capacidad de trabajo del anclaje en ese muro (§8.2). Primero hay que saber de qué es el muro (block, tabique, tablaroca, concreto). Si no alcanza: más anclajes, French cleat o apoyar el mueble en el piso. ❓

**French cleat** (listón a 45°): un listón atornillado al muro y su contraparte en el mueble, ambos cortados a 45°; el mueble se cuelga y el bisel lo jala hacia el muro [20]. ✅ Reparte la carga en muchos anclajes y facilita la instalación. En triplay de 18, el listón de 80–100 mm de alto con un anclaje a cada 300–400 mm. ⚠️

### 8.2 Capacidad de anclajes por tipo de muro

| Muro (México) | Anclaje | Carga de trabajo por anclaje | Factor de seguridad | Fuente |
|---|---|---|---|---|
| **Tablaroca** 12.7 mm (½") | Taquete de mariposa (toggle) de 6 mm (¼") | **27 kg** a extracción y a cortante (60 lb) | 4 | ✅ [18] |
| Tablaroca 12.7 mm | Toggle de 13 mm (½") | 36 kg (80 lb) | 4 | ✅ [18] |
| **Block hueco de concreto** | Toggle de 6 mm | **32 kg** a extracción, 54 kg a cortante | 5 | ✅ [18] (CMU de 6" grado N) |
| Block hueco | Toggle de 10 mm (⅜") | 64 kg a extracción y a cortante | 5 | ✅ [18] |
| **Tabique macizo** (ladrillo alemán ≥ Mz 12) | Taquete de nylon de 8 × 40 (tipo fischer SX) | 61 kg (0.60 kN) | 7 | ✅ [19] |
| **Tabique rojo recocido** (México) | Taquete de 8 × 40 | **30 kg**, la mitad del valor de fischer, hasta validar | — | ❓ |
| Ladrillo hueco o perforado | Taquete de 8 × 40 | **17 kg** (0.17 kN) | 7 | ✅ [19] |
| Ladrillo hueco | Taquete largo de 8 × 65 | 51 kg (0.50 kN) | 7 | ✅ [19] |
| Concreto (losa, columna) | Taquete de 8 × 40 | 71 kg (0.70 kN) | 7 | ✅ [19] |

**Advertencias:**

- El tabique rojo recocido artesanal de México puede ser más débil que el ladrillo alemán Mz 12 de la tabla de fischer; por eso se usa la mitad (30 kg) hasta validar. No lo trates «como concreto». ❓
- En tablaroca, los postes son de lámina, no de madera: un tornillo para madera no agarra en ellos. Lo seguro es toggle o un refuerzo de madera o triplay dentro del muro, puesto antes de cerrarlo. ⚠️
- **Nunca atornillar a la trasera de 3–6 mm:** va un **listón de colgar** de 18 × 80–100 arriba y atrás. ✅

---

## 9. Preguntas frecuentes

**1. ¿Por qué me dicen que mi repisa de 18 mm de 80 cm se va a pandear, si en todas partes dicen que aguanta?**
Aguanta sin romperse; lo que cambia es cuánto se ve. Con libros y después de unos años se pandea ≈ 7 mm (L/111). Las tablas de internet ignoran la fluencia o suponen un triplay más rígido que el pino (§1.5–1.6). La solución barata es una tira de refuerzo de madera de 18 × 40 pegada al frente.

**2. ¿El fondo de la repisa cambia el claro máximo?**
No, si la carga se cuenta por metro cuadrado: una repisa más honda carga más, pero también es más rígida en la misma proporción (§1.1). Sí cambia si pones una sola fila de libros en una repisa muy honda.

**3. ¿Vale la pena pegar dos hojas de 18?**
Sí, si van pegadas en toda la cara: la rigidez se multiplica por 8 y el claro por 2. Solo atornilladas, la rigidez se duplica y el claro crece 26 % (§1.6).

**4. ¿Trasera de 3 o de 6 mm?**
La de 6 clavada y pegada en todo el perímetro escuadra el mueble por sí sola. La de 3 también, pero solo pegada en rebaje o ranura; clavada sin pegamento casi no ayuda (§2).

**5. ¿Mi cómoda necesita ir anclada si es de 90 cm?**
Sí. Una cómoda de triplay es ligera y, con los cajones abiertos y llenos, se vuelca sin que nadie se suba (§6.2). La norma de EE.UU. aplica desde 686 mm de alto.

**6. ¿Hay una norma mexicana de muebles?**
Solo encontré normas voluntarias antiguas (NMX-Q-038 a 044, 1981–1982) y ninguna NOM de estabilidad verificable. La referencia útil es la norma de EE.UU. ASTM F2057-23 (§6.1).

**7. ¿Qué corredera compro y cuánto espacio dejo?**
En las de balines de montaje lateral, 12.7 mm por lado, con hasta 0.8 mm de sobra y nunca menos: haz la caja 26 mm más angosta que el hueco. Revisa la capacidad: en Home Depot MX hay de 20 y 30 kg; para cajones de libros o archivo, busca de 45 kg (§4.1).

**8. ¿Fondo de cajón de 3 mm?**
Solo en cajones de menos de 300 mm de ancho con carga ligera. Arriba de eso, 6 mm; para archivo o herramientas, 9 mm (§4.3).

**9. ¿Cuántas bisagras lleva una puerta?**
Por alto y por peso, lo que pida más: 2 hasta 900 mm y 6 kg, 3 hasta 1 600 mm y 12 kg, 4 hasta 2 000 mm y 18 kg, 5 hasta 2 400 mm y 22 kg. Una puerta de triplay de 18 mm pesa ≈ 9.7 kg/m² (§5; detalle en [uniones-y-herrajes.md](uniones-y-herrajes.md)).

**10. ¿Puedo colgar una alacena en tablaroca?**
Sí, con taquetes de mariposa: uno de 6 mm aguanta ≈ 27 kg de trabajo en tablaroca de 12.7 mm. Mejor a los postes o a un refuerzo interior, con un listón de colgar o French cleat, y nunca atornillada a la trasera delgada (§8).

**11. ¿Por qué mi repisa flotante se cae si «solo» tiene 20 kg?**
Porque el brazo de palanca es su propio espesor: 20 kg a 12.5 cm del muro jalan ≈ 83 kg los anclajes de arriba. Necesita muro macizo y un soporte metálico, o cargarla poco (§8.1).

**12. ¿Cuántas tablillas lleva una base de cama?**
Tablillas de triplay de 18 × 100 con un hueco de 75 mm o menos entre ellas, y un apoyo central desde la matrimonial (dos en la king) para que el claro no pase de ≈ 700 mm (§7.3).

---

## 10. Dudas abiertas

- **E real del triplay de pino que vende Home Depot MX** (y cuántas capas tiene): hacer la prueba casera del §1.8 con 12, 15 y 18 mm, en las dos direcciones.
- **Límite de L/100:** es un criterio derivado de la AWS; validarlo con fotos de repisas reales (L/120 es la alternativa más estricta).
- **Tabla de bisagras por alto y peso** del fabricante que se consiga en México (Blum, Hettich, Handy Home).
- **Normas mexicanas:** conseguir NMX-Q-042-1982 y confirmar que la «NOM-167-SCFI-2009» no existe.
- **Tabique rojo recocido y block hueco mexicanos:** resistencia de taquetes (fichas de fischer México o pruebas).
- **Carga de diseño de asientos y camas:** la norma EN 1725 completa y la EN de asientos; el factor dinámico × 2 es un supuesto.
- **Correderas Handy Home:** holgura lateral exacta (se supuso 12.7 mm).

---

## Fuentes

1. WoodBin, *The Sagulator*. https://woodbin.com/calcs/sagulator/
2. WoodBin, *Shelves* (furniture design reference). https://woodbin.com/ref/furniture-design/shelves/
3. WOODWEB Knowledge Base, *Span Limits for Plywood Shelving*. https://woodweb.com/knowledge_base/Span_Limits_for_Plywood_Shelving.html
4. AWI / AWMAC / WI, *Architectural Woodwork Standards*, 2.ª ed. (2014), Sección 10 «Casework», «Adjustable shelf loading and deflection». https://woodworkinstitute.com/wp-content/uploads/2015/05/Sec10_2ndEdAWS_SmBkMrkd_141001-3.pdf
5. AWI / AWMAC / WI, *Architectural Woodwork Standards*, Sección 10, parte 2 (correderas, bisagras). https://woodworkinstitute.com/wp-content/uploads/2015/02/14-2nd-AWS-Section-10-Part2.pdf
6. APA – The Engineered Wood Association, *Panel Design Specification* (2008), tablas 1, 4B y 4C. https://www.socomi.com/wp-content/uploads/APA_PanelDesignSpec.pdf
7. Eagon Lautaro S.A., *18 mm Radiata Pine Plywood* (ficha técnica, EN 310 / EN 13986). https://inlandplywood.com/wp-content/uploads/2022/09/Eagon-18MM-Specifications.pdf
8. American Wood Council, *National Design Specification for Wood Construction* 2018, §3.5 (K_cr). https://plib.org/wp-content/uploads/2020/09/AWC-NDS2018.pdf
9. COFORD, *The Structural Use of Timber – Handbook for Eurocode 5: Part 1-1*, tabla D.6 (k_def). https://www.coford.ie/media/coford/content/publications/TimberHandbook5Part130418.pdf
10. USDA Forest Products Laboratory, *Wood Handbook*, capítulo «Mechanical Properties of Wood» (reproducido por CED Engineering), «Creep and relaxation» y tablas de propiedades. https://www.cedengineering.com/userfiles/Mechanical%20Properties%20of%20Wood.pdf
11. KCMA, *Cabinets Certified to Last* (prueba ANSI/KCMA A161.1); Woodworking Network, *The strength behind certified cabinetry*. https://kcma.org/insights/cabinets-certified-last-0 · https://www.woodworkingnetwork.com/cabinets/strength-behind-certified-cabinetry-ansikcma-a1611
12. Federal Register, vol. 88, n.º 86 (4-may-2023), *Safety Standard for Clothing Storage Units* (ASTM F2057-23). https://www.govinfo.gov/content/pkg/FR-2023-05-04/html/2023-08997.htm
13. UL Solutions, *CPSC Adopts ASTM F2057-23 to Prevent Furniture Tip-overs*. https://www.ul.com/news/cpsc-adopts-astm-f2057-23-prevent-furniture-tip-overs
14. Accuride, *3832EC Quick Reference* (PDF; confirma 12.7 mm +0.8/−0 y 45.5 kg por par) y *Model 3832* (la página del modelo no abría el 2026-09-25). https://www.accuride.com/media/amasty/amfile/attach/lsENsMwHMdlHk0OlD2EpkPTjq1u8ZoYw.pdf · https://www.accuride.com/hardware/Model-3832
15. Blum, *Catalogue and technical manual 2022/2023*, p. 421 (MOVENTO). https://publications.blum.com/2022/catalogue/en/421/
16. Blum EASY ASSEMBLY, *Building a MOVENTO drawer*. https://ea.blum.com/en/building-a-movento-drawer/
17. The Home Depot México, correderas Handy Home: 3.5 × 45 cm (20 kg) y extensión total 39.5 × 4.5 cm (30 kg). https://www.homedepot.com.mx/p/handy-home-correderas-de-extension-niquel-35-x-45-cm-1761-106919 · https://www.homedepot.com.mx/p/handy-home-correderas-de-extension-total-niquel-395-x-45-cm-plata-1743-246143
18. DEWALT Anchors & Fasteners, *Toggle Bolt – Technical Guide* (rev. C, 2023). https://anchors.dewalt.com/anchors/_documents/uploads/DWANF_ToggleBolt-TP-EN-rC_DDS1.pdf
19. fischer, *Expansion plug SX – technical data and loads* (2014). https://docs.rs-online.com/ddef/0900766b812cf8e7.pdf
20. Wikipedia, *French cleat*. https://en.wikipedia.org/wiki/French_cleat
21. SATRA, *Safety, strength and durability testing of beds to EN 1725:2023*. https://www.satra.com/spotlight/article.php?id=566
22. Puffy, *How Far Apart Should Bed Slats Be?* https://puffy.com/blogs/best-sleep/how-far-apart-should-bed-slats-be-the-spacing-guide
23. Maderas Selvamex (CDMX), *Triplay – ficha técnica* (espesores de pino y caobilla listonado). https://selvamex.com.mx/wp-content/uploads/2020/12/Ficha-tecnica-Triplay.pdf
24. vLex México, *Normas Mexicanas (NMX) – Industria mueblera*. https://vlex.com.mx/source/normas-mexicanas-nmx-6404/c/industria-mueblera
25. Promob, *Regulaciones de seguridad en México para la fabricación de muebles* (cita no verificada de «NOM-167-SCFI-2009»). https://promob.mx/regulaciones-de-seguridad-en-mexico-para-la-fabricacion-de-muebles/
26. Sawmill Creek, *Racking question*; Fine Woodworking, foro *Attaching backs to cabinets*. https://sawmillcreek.org/threads/racking-question.316771/ · https://www.finewoodworking.com/forum/attaching-backs-to-cabinets
27. *Full Orthotropic Mechanical Characterization of Pinus radiata Plywood…*, Forests 16(11):1676 (2025). https://doi.org/10.3390/f16111676
28. WoodCalcs, *Shelf Building Guide: Span, Sag, and Load Calculations*. https://woodcalcs.com/guides/shelf-building-structural-guide/
29. Blum, *Catalogue and technical manual 2022/2023*, p. 70 (CLIP top BLUMOTION, espesores de puerta). https://publications.blum.com/2022/catalogue/en/70/
