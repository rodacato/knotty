# 05 — Reglas estructurales para muebles de triplay

Investigación para calibrar y ampliar las reglas deterministas de Knotty (R1–R10 en `docs/PROPUESTA.md` §5 y `src/domain/estructura/`, `src/domain/typology/typology.ts`). Todo en milímetros y kilogramos; cuando algo se vende en pulgadas se da primero el valor métrico y después la designación comercial, p. ej. 32 mm (1¼").

**Leyenda de confianza.** ✅ dos o más fuentes independientes coinciden · ⚠️ una sola fuente o práctica de taller · ❓ supuesto o cálculo propio por validar (con prueba casera o ficha del fabricante).

**Notación.** `L` claro libre (span), `b` fondo de la repisa, `t` espesor, `q` carga por área (kg/m²), `w` carga por longitud (N/mm), `E` módulo de elasticidad (modulus of elasticity, MOE), `I` momento de inercia, `δ` flecha (deflection, lo que se pandea), `k` factor de fluencia (creep). Las referencias `[n]` están en «Fuentes».

---

## Resumen

1. **La fórmula de R1 es correcta** (viga simplemente apoyada con carga uniforme). Los números de la tabla de `PROPUESTA.md` se reproducen exactos con los supuestos actuales. ✅
2. **Los supuestos son optimistas:** `E∥ = 6 000 MPa` está arriba de lo medido para triplay de pino radiata (4 742 MPa [7]); `E⊥ = 3 500 MPa` solo vale para triplay de 7 capas o más (el de 5 capas da ≈ 1 700–1 900 MPa según APA [6]); y el factor de fluencia de 1.5 es el de madera maciza: para tableros es 2.0 (NDS [8]), 1.8 (Eurocódigo 5 [9]) y ≈ 2 según el Wood Handbook [10].
3. Con los supuestos corregidos (`E∥ 4 500`, `E⊥ 2 000`, `k 2.0`), una repisa de 18 mm con libros deja de verse recta a partir de **≈ 540 mm** y se ve claramente pandeada (≈ L/100) a partir de **≈ 830 mm**. La regla de taller «18 mm, no más de 80–90 cm» y el Sagulator (813 mm [2]) marcan el límite de lo *aceptable*, no el de lo *invisible*: ignoran la fluencia o usan un E alto.
4. **Un canto de madera maciza de 18 × 40 mm pegado al frente triplica la rigidez** (`I` × 3.0): la repisa de 18 mm con libros pasa de 540 a 780 mm. Es la solución barata que Knotty debería ofrecer antes de «sube a otro espesor».
5. **Una cómoda de triplay de 90 cm se vuelca sola** si se abren todos los cajones llenos de ropa, sin necesidad de que un niño se suba (cálculo propio con la prueba de ASTM F2057-23 [12]). La regla R10 solo se activa por el nombre del mueble y a partir de 700 mm; la norma aplica desde 686 mm (27").
6. En México **no encontré una NOM vigente de estabilidad de muebles**; solo las NMX-Q-038 a 044 de 1981–1982 (muebles domésticos) [24]. La «NOM-167-SCFI-2009» que cita un blog [25] no aparece en el DOF. ❓
7. Faltan reglas de: vuelco con cajones abiertos, capacidad de correderas, fondos de cajón por cálculo, peso de puertas, anclaje al muro según el tipo de muro, repisas flotantes, asientos y camas por resistencia, y sugerencias de ahorro de material.

---

## 1. Flecha (pandeo) de repisas (R1)

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
- `δ ∝ L⁴ / t³`: duplicar el claro multiplica la flecha por 16; subir de 15 a 18 mm la divide entre 1.73.

**Apoyo simple vs empotrado.** Knotty siempre supone apoyo simple (extremos libres para girar). Una repisa metida en canal y pegada gira menos. WOODWEB reporta que fijar los extremos deja la flecha en ≈ 1/3 de la de extremos libres [3] ⚠️; en teoría, un empotramiento perfecto la deja en 1/5. Mantener el apoyo simple es conservador y correcto para repisas móviles sobre soportes. ✅

**Comprobación de los números de `PROPUESTA.md`** (18 mm, fondo 300, libros = 150 kg/m², E = 6 000, k = 1.5):

| Caso | δ calculada | Tabla de la propuesta |
|---|---|---|
| Claro 600 | 1.28 mm | 1.3 ✅ |
| Claro 900 | 6.47 mm | 6.5 ✅ |
| 900 con divisor (2 × 441) | 0.37 mm | 0.4 ✅ |
| 15 mm, claro 600 | 2.21 mm | 2.2 ✅ |

El código (`flecha.ts`) implementa lo mismo. El problema no es la fórmula sino los supuestos.

### 1.2 Módulo de elasticidad del triplay

El triplay (plywood) alterna la veta de sus chapas (veneers). En flexión, las chapas de las caras son las que más trabajan, así que el `E` efectivo depende de la dirección de la veta de las caras respecto al claro y del número de capas.

| Fuente | Tablero | E∥ (veta de la cara a lo largo del claro) | E⊥ | Confianza |
|---|---|---|---|---|
| Ficha Eagon (Chile), EN 310 [7] | Pino radiata 18 mm, 7 capas | **4 742 MPa** | **3 912 MPa** | ✅ medido |
| APA Panel Design Spec., tabla 4B [6] | Lijado Grupo 1, 23/32" (18.3 mm) | EI = 320 000 lb·in²/ft → **≈ 5 940 MPa** | EI = 90 500 → **≈ 1 680 MPa** | ✅ |
| APA [6] | Lijado Grupo 1, 3/4" (19 mm) | 355 000 → ≈ 5 800 MPa | 115 000 → ≈ 1 880 MPa | ✅ |
| APA [6] | Lijado Grupo 1, 5/8" (15.9 mm) | 230 000 → ≈ 6 500 MPa | 48 500 → ≈ 1 370 MPa | ✅ |
| APA, tabla 4C [6] | Pinos del Grupo 4 (ponderosa, blanco) | × 0.56 → ≈ 3 300 MPa | ≈ 940 MPa | ✅ |
| Forests (MDPI), 2025 [27] | Pino radiata, en el plano | «cerca de 5 GPa» | — | ⚠️ |
| Supuesto actual de Knotty | Triplay de pino | 6 000 | 3 500 | — |

*Conversión APA:* `E = EI / I`, con `I = 12 in · t³ / 12 = t³` por pie de ancho. Para 23/32": `I = 0.3713 in⁴/ft`, `E = 320 000 / 0.3713 = 861 800 psi = 5 942 MPa`.

**Lectura:**

- El Grupo 1 de APA incluye abeto Douglas y pino del sur, más rígidos que el pino radiata o el pino mexicano. El triplay de pino de Home Depot MX y de las madererías suele ser radiata chileno o pino nacional; la ficha Eagon es la referencia más cercana. ⚠️
- El `E⊥` varía mucho según las capas: con 5 capas el núcleo cruzado aporta poco (≈ 1 700 MPa); con 7 capas balanceadas sube a ≈ 3 900 MPa. Knotty no sabe cuántas capas tiene la hoja, así que conviene suponer lo peor.
- En México también se vende **caobilla de 15 y 18 mm «listonado»** (blockboard: núcleo de listones macizos con chapas encima) [23]. Es mucho más rígido en la dirección de los listones y muy débil en la otra. ❓ Merece su propio material en el catálogo.

**Propuesta:** `E∥ = 4 500 MPa` y `E⊥ = 2 000 MPa` para «triplay de pino» genérico, como dato del **material** en el catálogo (no en `SUPUESTOS`), para que un triplay de 7 capas o un listonado tengan sus propios valores. ❓ Calibrar con la prueba casera del §1.9.

> **Nota de auditoría (reconciliación con `01-triplay-material.md` §6):** se adopta 4500 / 2000 para 18 mm como valor **canónico y conservador** (la ficha de Eagon se verificó: 18 mm, 7 capas, EN 310, E∥ 4742, E⊥ 3912, MOR 44.18 / 39.91 MPa, 500 kg/m³). Como en los tableros delgados las chapas de la cara pesan más en la inercia, el canónico **por espesor** es: 15 mm → 5000 / 1500; 12 mm → 5500 / 1000; 9 mm → 5500 / 800. La tabla del §1.6 usa 4500 en todos los espesores, así que en 12 y 15 mm queda del lado seguro (≈ 3–7 % de claro de más si se usa el valor por espesor).

### 1.3 Fluencia (creep)

| Fuente | Factor de flecha final / inicial |
|---|---|
| Wood Handbook (FPL): «después de varios años, la deformación adicional por fluencia puede ser aproximadamente igual a la deformación elástica inicial» [10] | ≈ 2.0 |
| NDS 2018 (AWC), ec. 3.5-1: `K_cr = 1.5` madera seca y glulam; **`K_cr = 2.0` tableros estructurales (wood structural panels)** en servicio seco [8] | 2.0 |
| Eurocódigo 5, tabla de `k_def`: triplay EN 636, clase de servicio 1 → 0.80; clase 2 → 1.00 [9] | 1.8 – 2.0 |
| Sagulator: «las repisas se pandean un 50 % adicional con el tiempo» [1] | 1.5 |
| Knotty hoy | 1.5 |

**Corrección:** `k = 2.0` para triplay bajo carga permanente (libros, platos, ropa). ✅ (3 fuentes). Para cargas que no se quedan puestas (un asiento, una persona que se sube a la cama) va `k = 1.0`. El Wood Handbook añade que un aumento de ≈ 28 °C puede duplicar o triplicar la fluencia [10]: en cocinas junto a la estufa o en repisas al sol, 2.0 se queda corto. ⚠️

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

**Cargas actuales de Knotty** (`ligera 50`, `media 100`, `pesada 150`): quedan dentro de los rangos de las fuentes. ✅ Se proponen dos casos nuevos: `tv` (cargas puntuales) y `person` (carga dinámica, sin fluencia).

### 1.5 Umbral de flecha: L/360, L/200, L/144…

| Fuente | Criterio | Equivale a |
|---|---|---|
| Sagulator [1] | Meta: 0.02"/pie (1.7 mm/m) **instantánea**; el ojo nota 1/32"/pie | L/600 inicial ≈ **L/400 final** (con su 1.5) |
| WoodBin, «Shelves» [2] | El ojo nota 1/32"/pie | **L/384** |
| AWS (AWI/AWMAC/WI) [4] | «L/144 es el estándar de la industria para la flecha máxima aceptable» (6.4 mm en 914 mm), sin contar la fluencia | L/144 instantánea |
| WOODWEB [3] | Fabricantes de aglomerado y MDF: ≈ L/240; «la gente del triplay»: L/180 | — |
| Knotty hoy | recomendación > L/360, crítico > L/200, sobre la flecha **final** | — |

**Lectura:**

- **L/360 sobre la flecha final** coincide con el límite de lo visible (L/384–L/400). Se mantiene. ✅
- **L/200 como crítico es demasiado estricto con los supuestos corregidos**: marcaría como crítica una repisa de 18 mm con libros desde 680 mm, cuando la industria (AWS) acepta L/144 instantánea con 244 kg/m². Además, en Knotty «crítico» bloquea cambios (`criticosNuevos`). Una repisa pandeada es un problema de apariencia, no de seguridad.
- **Propuesta:** recomendación a partir de L/360 final; **crítico a partir de L/100 final** (el límite AWS de L/144 instantánea con 244 kg/m² equivale, con libros de 150 kg/m² y fluencia 2, a `δ_final = δ_AWS × 150/244 × 2 = 1.23 · δ_AWS` → L/117; redondeado a L/100), más una comprobación de **resistencia** (el esfuerzo contra el módulo de ruptura, MOR, con un factor de seguridad) para asientos, camas y repisas con cargas puntuales. ❓ Con esto, la repisa de 18 mm con libros se vuelve crítica desde ≈ 830 mm, que es justo donde la regla de taller dice «ya no» (80–90 cm). ✅ coherente con [2][3].

**Resistencia de una repisa: casi nunca manda.** 18 mm, claro 900, libros: `M = w·L²/8`, `σ = M / (b·t²/6) = 2.8 MPa`, contra un MOR de 40–44 MPa [7]. Factor ≈ 15. En repisas manda la flecha; en asientos y camas no (§7, §8).

### 1.6 Tabla de claros máximos recomendados

Supuestos: triplay de pino con la veta de las caras a lo largo del claro, `E = 4 500 MPa`, `k = 2.0`, apoyo simple, carga repartida. Cada celda es **claro sin pandeo visible (L/360) / claro límite (L/100)**, en mm, redondeado a 10. Vale para cualquier fondo (§1.1). ❓ Cálculo propio con [1][6][7][8].

| Espesor | Ligera 50 kg/m² | Media 100 | Libros 150 | Biblioteca (AWS) 244 |
|---|---|---|---|---|
| 12 mm | 520 / 800 | 410 / 630 | 360 / 550 | 310 / 470 |
| 15 mm | 650 / 1 000 | 520 / 790 | 450 / 690 | 380 / 590 |
| 18 mm | 780 / 1 200 | 620 / 950 | **540 / 830** | 460 / 710 |
| 2 × 18 mm laminado y pegado (36) | 1 560 / 2 390 | 1 240 / 1 900 | 1 080 / 1 660 | 920 / 1 410 |
| 15 mm + canto 18 × 40 | 1 100 / 1 690 | 880 / 1 340 | 760 / 1 170 | 650 / 1 000 |
| 18 mm + canto 18 × 40 | 1 130 / 1 730 | 900 / 1 370 | **780 / 1 200** | 670 / 1 020 |

- **Con la veta atravesada** (`E⊥ = 2 000`), la repisa de 18 mm con libros baja a 410 mm. Por eso importa R8. ✅
- **Comparación con las fuentes:** WoodBin da 813 mm (32") para 3/4" de triplay [2]. Se reproduce exacto con `E = 6 000`, sin fluencia y a L/384 (cálculo: 847 mm). Las reglas de taller de 60–90 cm [3][28] son del mismo orden. La tabla es más conservadora porque incluye la fluencia y un E de pino radiata.
- **Laminar dos hojas solo sirve si van pegadas en toda la cara**: pegadas, `I` se multiplica por 8 y el claro por 2. Solo atornilladas, cada hoja trabaja sola: `I` × 2 y el claro × 1.26. WOODWEB: «arriba de 34" laminamos dos capas de 3/4" con canto de 1½"» [3]. ⚠️

**Supuestos actuales de Knotty** para comparar (`claroMaximo`, libros): 18 mm → 656 mm; 15 mm → 546; 12 mm → 437. Con la corrección, cada uno baja ≈ 18 %.

### 1.7 El canto frontal de madera maciza (faldón de repisa)

Un canto (edge band, cleat) de madera maciza pegado al frente, más alto que el espesor de la repisa, funciona como una viga en T. WoodBin lo recomienda («un listón de 1 a 2 pulgadas al frente o atrás» [2]); WoodBin da 813 → 1 067 mm (32 → 42") con un listón y 1 219 mm (48") con dos [2]; WoodCalcs dice que «efectivamente duplica la rigidez» [28]. ✅

**Cálculo de la sección compuesta** (repisa de 300 × 18 de triplay con E = 4 500; canto de pino macizo de 18 de grueso × 40 de alto, al ras por arriba, con E = 8 000 MPa, conservador frente a los 8 900 MPa del pino ponderosa [10]):

```
n = E_canto / E_triplay = 8 000 / 4 500 = 1.78          (sección transformada)
Triplay: A1 = 300·18 = 5 400 mm²,         y1 = 9 mm  (desde la cara de arriba)
Canto:   A2 = 1.78·18·40 = 1 280 mm²,     y2 = 20 mm
Eje neutro: ȳ = (5 400·9 + 1 280·20) / 6 680 = 11.1 mm
I = 300·18³/12 + 5 400·(9 − 11.1)² + 1.78·18·40³/12 + 1 280·(20 − 11.1)²
  = 145 800 + 23 800 + 170 900 + 101 200 ≈ 441 700 mm⁴
I / I₀ = 441 700 / 145 800 = 3.03
```

- El claro sube en `∛3.03 = 1.45` veces: de 540 a 780 mm con libros. ✅ Del orden de lo que dice WoodBin (×1.31 con un listón, ×1.5 con dos [2]).
- **Condiciones:** el canto va **pegado en toda su longitud** (y con clavo sin cabeza mientras seca); si solo se atornilla cada 20 cm, se desliza y aporta mucho menos. Un canto de triplay de 18 × 40 aporta menos (n ≈ 1). La veta del canto va a lo largo. ⚠️
- **Más barato que subir de espesor:** un canto de 18 × 40 de 1 m ≈ 0.00072 m³ de pino; la repisa sigue siendo de 18.
- **Solución automática para Knotty:** `addFrontEdge { width: 18, height: 40 }` como primera alternativa de R1, antes de `subir-espesor`. El canto también sirve de cubrecanto visible.

**Televisión de 20 kg sobre repisa de 1 200 mm** (2 patas a L/3, fondo 400, k = 2): 18 mm sola → 13.8 mm (L/87, mal); con canto 18 × 40 → 5.4 mm (L/223); 2 × 18 laminado → 1.7 mm (L/698). ❓ Cálculo propio.

### 1.8 Regla programática propuesta (R1 v2)

```
para cada pieza horizontal con carga ≠ ninguna y que no descanse sobre el suelo:
  L = claroLibre(...)                         // igual que hoy
  E = material.E[vetaRespectoAlClaro]         // del catálogo, no de SUPUESTOS
  I = inercia(pieza, cantoFrontal?)           // sección compuesta si hay canto pegado
  δ = flechaUniforme(L, q) + Σ flechaPuntual(P_i)
  δ_final = δ · (carga.sostenida ? material.creep : 1)
  si δ_final > L/100 → crítico; si δ_final > L/360 → recomendación
  si carga.dinamica: σ = M_max / S; si σ > MOR / 3 → crítico
  alternativas (simuladas): canto 18×40 · divisor al centro · siguiente espesor · laminar 2×18 · claro máximo
```

**Posible falso positivo actual:** `reglaFlecha` no excluye un piso que descansa directo en el suelo (`caja.y0 ≈ 0`); `reglaBase` sí lo hace. Con `base: 'floor'` en `cabinet.ts`, un piso de 900 mm con carga media podría marcarse sin estar en el aire. ❓ Verificar con una prueba.

### 1.9 Prueba casera para calibrar E (pregunta abierta de la propuesta)

1. Corta una tira de 100 × 1 000 mm del triplay, con la veta de las caras a lo largo.
2. Apóyala sobre dos listones separados `L = 900 mm`.
3. Cuelga al centro una cubeta con `P = 10 kg` de agua (10 litros) y mide la flecha `δ` con una regla o un calibrador, al minuto.
4. `E = P·g·L³ / (48·δ·I)`, con `I = 100·t³/12`. Ejemplo: 18 mm, δ = 4.0 mm → `I = 48 600`, `E = 98.1·900³ / (48·4.0·48 600) = 7 660 MPa`. Si δ = 6.8 mm → E ≈ 4 500 MPa.
5. Repite con la tira cortada a lo ancho para obtener `E⊥`. Deja la carga una semana y vuelve a medir para estimar la fluencia.

---

## 2. Rigidez y escuadrado (racking) (R5)

Un casco (carcass) sin nada que lo triangule se deforma como un paralelogramo cuando se empuja de lado. Lo que lo impide, de más a menos eficaz:

| Solución | Cómo trabaja | Cuándo basta | Confianza |
|---|---|---|---|
| **Trasera (back) de 5.5–6 mm clavada y pegada** a laterales, piso y techo, con clavo o grapa cada 100–150 mm | Diafragma de cortante (como un muro de triplay en una casa) | Cualquier casco hasta 2.4 m. La opción por defecto de `cabinet.ts` | ✅ [26] y práctica |
| **Trasera de 2.5–3 mm pegada en rebaje o canal** (rabbet/dado) | Mismo diafragma; el rebaje la escuadra y el pegamento evita que se deslice | Cascos medianos. Solo clavada, sin pegamento, el clavo se sale del tablero delgado | ⚠️ [26] |
| Trasera de 3 mm solo clavada por fuera | Poco: el clavo desgarra la chapa | Muebles bajos (< 600 mm) o con otro sistema | ⚠️ |
| **Travesaño (rail, stretcher; en el código `faja`) superior trasero + zoclo (kick) + repisa fija**, con bolsillo o tarugo y pegamento | Marco rígido por uniones que resisten momento | Muebles sin trasera o con trasera removible | ⚠️ |
| **Escuadras metálicas** (brackets) en las esquinas | Rigidizan cada esquina | Solo como refuerzo: el tornillo en el canto del triplay afloja con el uso | ⚠️ |
| **Cartela** (gusset) de triplay en la esquina interior | Triángulo pequeño pegado | Mesas y bastidores | ⚠️ |
| **Diagonal** (tirante) de madera o cable | Triangula el vano | Estructuras abiertas (anaqueles de taller) | ✅ principio de estática |

**R5 actual:** exige trasera ≥ 6 mm unida a ≥ 3 piezas del perímetro, o 3 mm pegada en rebaje o canal, o un marco con al menos 2 travesaños rígidos, uno de ellos el travesaño trasero de arriba o el zoclo. Es correcta. ✅ El umbral de 600 mm de alto para «crítico» es ⚠️ (sin fuente, sensato). Mejoras:

- Contar como rigidizante una **repisa fija en ranura y pegada** aunque no sea travesaño ni zoclo.
- **Advertir la trasera de 3 mm clavada sin pegamento** (hoy no se distingue de «clavo-pegamento»).
- Un librero **abierto por detrás** (sin trasera, como separador de espacios) necesita travesaños atrás arriba y abajo y, si mide más de 1 200 mm, cartelas o una diagonal. ❓

### 2.1 Mesas y escritorios: patas, faldón y bamboleo

El bamboleo (wobble) de una mesa viene de la **unión pata–cubierta**, no de la pata. Una pata atornillada solo a la cubierta, en su canto, gira como una bisagra. El **faldón** (apron) de 80–120 mm de alto, unido a las patas, crea un marco que resiste el momento. ⚠️ práctica de taller.

**Cálculo de una pata de triplay laminado** (2 × 18 = 36 × 72 mm, E = 4 500, alto libre bajo el faldón 650 mm, empujón lateral de 100 N ≈ 10 kg repartido en 4 patas):

```
I (eje débil) = 72·36³/12 = 279 936 mm⁴
Con faldón rígido (pata empotrada abajo y guiada arriba): δ = P·h³/(12·E·I) = 25·650³/(12·4 500·279 936) = 0.45 mm
```

Con faldón, una pata de 36 × 72 sobra. ❓ Sin faldón la pata trabaja como un voladizo desde una unión que cede; el bamboleo lo pone la unión (tornillos en el canto), no la sección.

**Reglas propuestas:** mesa o escritorio con patas y **sin faldón ni travesaños** → recomendación; con alto > 600 mm y cubierta > 1 200 mm → crítico. El escritorio con cajonera a un lado y panel al otro (dos laterales de triplay) necesita una **faja trasera de 100–150 mm** (modesty panel) o un panel trasero parcial. ⚠️

### 2.2 Muebles bajos con cubierta: dos travesaños en vez de techo

En un mueble bajo (base de cocina, credenza) que llevará cubierta (countertop), el techo completo no se ve ni carga nada: basta con **dos travesaños de 100 mm**, una al frente y otra atrás, con bolsillo o tarugo. Es la práctica de los gabinetes europeos sin marco (frameless). ⚠️ Ahorro en el §3.

---

## 3. Ahorro de material sin perder estructura

**Precios de referencia:** los del catálogo de Knotty (`public/catalogo/catalogo.json`, placeholders marcados por D22) por hoja de 2 440 × 1 218 (2.97 m²): T18 $1 050 (≈ $353/m²), T15 $860 ($289/m²), T12 $720 ($242/m²), TR6 $480 ($161/m²), TR3 $330 ($111/m²). ❓ Precios por confirmar en Home Depot MX. **El ahorro solo es real si baja el número de hojas** o si el sobrante sirve para otro proyecto: el acomodo guillotina de Knotty debería decirlo.

| Medida | Ejemplo | Ahorro | Límite | Confianza |
|---|---|---|---|---|
| **Techo → dos travesaños de 100 mm** en un mueble bajo con cubierta | 800 × 560: 0.448 m² de T18 → 0.16 m² | 0.29 m² ≈ **$100 (64 %)** | Solo si la cubierta va encima y atornillada a las fajas; no en muebles donde el techo se ve | ⚠️ |
| **Trasera de 3 mm pegada en rebaje** en vez de 6 mm clavada | 800 × 900 | 0.72 m² × $50 ≈ **$36** | Requiere router o sierra para el rebaje; no sirve para colgar | ⚠️ |
| **Costados y trasera de cajón de 12** en vez de 15/18 | 4 cajones, ≈ 0.98 m² | vs 18: ≈ **$110**; además gana 12 mm de ancho útil por cajón | Tornillo al canto en 12 mm = recomendación R2; usar clavo y pegamento, tarugo o rebaje. Blum Movento pide costado ≤ 16 mm [16] | ⚠️ |
| **Fondo de cajón de 6** (no de 12 ni 18) | — | — | 3 mm solo en cajones angostos (§4.3) | ❓ cálculo |
| **Laminar 2 × 18 solo en el canto visible** (cubierta que *parece* de 36) | Escritorio 1 200 × 600: tiras de 80 mm en el perímetro de abajo | 0.72 m² → ≈ 0.28 m² de la segunda capa: ≈ **$155** | La rigidez es la de 18 + faldón perimetral (no la de 36), pero suficiente con patas o faldón | ⚠️ |
| **Tapas ocultas en triplay de menor grado** (cara C o «de segunda») | Pisos detrás de puertas, traseras, bases | Depende del precio local | Solo caras que no se ven; evitar hojas con huecos en el núcleo donde van tornillos | ❓ |
| **Marco en vez de panel** (bastidor de tiras de 70–100 mm) | Laterales ocultos entre muebles, fondos de clóset | 40–60 % del área | Rigidiza menos que un panel; necesita uniones con momento (bolsillo, tarugo) | ⚠️ |
| **Zoclo como travesaño** en vez de piso doble | — | — | El zoclo también escuadra (R5) | ⚠️ |

**Regla propuesta (detalle, nunca bloquea):** `R21_MATERIAL_SAVING` sugiere, **solo si con eso baja el número de hojas**: travesaños en vez de techo; costados de cajón de 12; trasera de 3 en rebaje cuando el mueble no se cuelga. ❓

---

## 4. Cajoneras (R9)

### 4.1 La caja del cajón

- **Construcción típica en triplay:** caja de 4 lados (frente interior o *subfrente*, 2 costados, trasera) de 12–15 mm y fondo de 6 mm en canal a 10–12 mm del borde inferior, o clavado y pegado por debajo. El frente de vista va aparte, atornillado desde dentro. ⚠️ práctica (la norma AWS lo describe, pero su parte de cumplimiento es de pago [5]).
- **Holgura lateral según la corredera:**

| Corredera | Holgura por lado | Tolerancia | Capacidad | Fuente |
|---|---|---|---|---|
| Telescópica de balines, montaje lateral (Accuride 3832 y similares) | **12.7 mm (½")** | **+0.8 mm (1/32"), nunca menos**: «puede no funcionar si el espacio es menor de 12.7 mm» | 45.5 kg por par | ✅ [14] |
| Oculta bajo el cajón (Blum Movento) | Ancho interior del cajón = hueco − 42 mm (+0 / −1.5) | Costado ≤ 16 mm | 40 kg (según modelo) | ✅ [15][16] |
| Handy Home 35 mm de ancho, 45 cm (Home Depot MX) | 12.7 mm típico | — | **20 kg** | ⚠️ [17] |
| Handy Home 45 mm, extensión total, 39.5 cm (Home Depot MX) | 12.7 mm típico | — | **30 kg** | ⚠️ [17] |

**Corrección a R9:** hoy la tolerancia es simétrica (±1 mm). Debe ser asimétrica: el hueco puede ser hasta 0.8 mm **mayor** que lo que pide la corredera, **nunca menor**. ✅ [14]

- **Profundidad útil:** largo de la corredera ≤ fondo interior − espesor del frente (si va embutido) − ≈ 10 mm. Blum: largo del cajón = largo nominal − 10 [15]. En Home Depot MX hay correderas de 30, 40 y 45 cm [17]; el catálogo de Knotty tiene de 30 a 50. ✅
- **Altura:** la caja mide 20–40 mm menos que el hueco, para meterla y sacarla con la corredera. ⚠️
- **Separación entre frentes sobrepuestos:** 2–3 mm (Knotty usa 2). ⚠️
- **¿Travesaño entre cajones?** Con correderas laterales en un casco de triplay no hace falta: la corredera se atornilla al lateral. Sí hace falta con correderas de madera, con cajones sobre guías o en muebles con marco (face frame). ⚠️
- **Topes:** las correderas de balines traen tope y retén. Las de madera necesitan un tope trasero y un retén para que el cajón no se salga. ⚠️

### 4.2 Cajones anchos, altos o pesados

| Caso | Riesgo | Regla propuesta | Confianza |
|---|---|---|---|
| Ancho > 600 mm | La caja se tuerce y las correderas se traban; el fondo se pandea | Fondo de 6 mm como mínimo (9 si lleva carga pesada); costados de 15; correderas de 45 kg | ⚠️ |
| Ancho > 900 mm | Se atora al jalarlo de una jaladera descentrada | Dividir en dos cajones o poner dos jaladeras | ❓ |
| Frente > 300 mm de alto | Pesa y palanquea las correderas | Correderas de extensión total de 45 kg o más | ❓ |
| Cajón de archivo (carpetas) o de herramientas | Carga pesada | Carga de diseño ≥ 150 kg/m² de fondo del cajón; correderas ≥ 45 kg; fondo de 9 mm o de 6 con travesaño | ❓ |
| Carga del cajón > capacidad de la corredera | Se vencen los balines | **R12 nueva:** `carga = q_cajón × área del fondo`; si supera la capacidad → recomendación, con la corredera siguiente | ✅ datos [14][17] |

*Ejemplo:* un cajón de 730 × 400 con ropa (136 kg/m³ [12], 140 mm de ropa) carga 5.6 kg: cualquier corredera sirve. El mismo cajón con libros de pie (150 kg/m² × 0.29 m² = 44 kg) supera la Handy Home de 20–30 kg [17]. ❓ Cálculo propio.

### 4.3 Fondo de cajón: 3 contra 6 mm

Una placa apoyada en sus cuatro lados (fondo en canal), con la carga de prueba KCMA de 73 kg/m² [11] y `E = 4 500`. Calculado con la solución de Navier, sin fluencia:

| Ancho × 400 de fondo | 3 mm | 6 mm | 9 mm |
|---|---|---|---|
| 300 | 3.5 mm | 0.4 | 0.1 |
| 450 | 8.3 | 1.0 | 0.3 |
| 600 | 12.7 | 1.6 | 0.5 |
| 800 | 16.7 | 2.1 | 0.6 |

Con 150 kg/m² (archivo, libros) y 6 mm: 2.8 mm a 450 de ancho, 4.5 a 600, 6.2 a 800; con 9 mm: 0.8 / 1.3 / 1.9. ❓ Cálculo propio.

**Corrección a R9:** hoy el fondo de 3 mm se marca a partir de 450 mm de ancho. El cálculo sugiere **bajar el umbral a 300 mm**, y pedir 9 mm (o 6 con un travesaño debajo) cuando el cajón lleva carga pesada y mide más de 600 de ancho. `cabinet.ts` ya usa TR6 para los fondos. ✅

---

## 5. Puertas (R6)

- **Peso:** triplay de 18 mm a ≈ 500 kg/m³ [7] → **9 kg/m²**. Una puerta de 600 × 2 000 pesa 10.8 kg; una de 450 × 700, 2.8 kg. ❓ Cálculo propio.
- **Número de bisagras:** Knotty lo decide solo por el alto (≤ 900 → 2; ≤ 1 500 → 3; más → 4). Los fabricantes publican una tabla de **alto y peso**, y la norma AWS remite a ella («siga las recomendaciones del fabricante de bisagras sobre número y separación» [4]). No pude consultar la tabla de Blum; la regla de Knotty coincide con la práctica común. ❓ **Propuesta:** `n = max(porAlto, porPeso)`, con los datos de la bisagra que venda Home Depot MX. Por el peso, ≈ 1 bisagra por cada 4–5 kg (❓ por validar con el fabricante). *Nota de auditoría:* `02-uniones-y-herrajes.md` §6.1 sí trae la tabla (Blum vía [37][38] de ese documento): hasta 900 mm y 6 kg → 2; 1600 mm y 12 kg → 3; 2000 mm y 18 kg → 4; 2400 mm y 22 kg → 5; +1 si la hoja mide 601–650 mm de ancho. Esa es la tabla canónica.
- **Ancho máximo:** 600 mm (Knotty) es práctica de taller en gabinetes sin marco. ⚠️ Además, una puerta ancha barre mucho espacio y cuelga de un solo lado.
- **Alabeo (warp) en puertas altas:** el triplay es más estable que la madera maciza, pero una puerta de más de ≈ 1 800 mm puede arquearse si una cara recibe más humedad o más acabado que la otra. Remedios de taller: la veta a lo largo; **el mismo acabado en las dos caras** (acabado balanceado); **4 bisagras o más**, que la mantienen recta; o un enderezador de puerta. ⚠️ **Regla propuesta:** puerta de triplay > 1 800 mm → detalle con esos consejos. ❓
- **Espesor mínimo para bisagra de cazoleta de 35 mm:** 15 mm (R2). ⚠️ práctica; Blum admite puertas de 8 a 24 mm según el modelo de bisagra [29]. *Nota de auditoría:* el «8» es la bisagra especial para puerta delgada (8–14 mm); la estándar pide cazoleta de 13 mm y puerta de 16 mm o más (`02-uniones-y-herrajes.md` §6.1). Canónico: ≥ 16 sin aviso, 15 con recomendación, < 14 crítico salvo bisagra para puerta delgada.
- **Puertas corredizas:** en triplay de 18 son pesadas (9 kg/m²) y el riel inferior junta polvo. Para hojas de más de 1 200 mm de alto conviene riel colgado arriba y guía abajo; traslape entre hojas de 20–30 mm. ⚠️ **Puertas abatibles hacia abajo** (secreter): necesitan compás o tirante con tope que aguante una persona recargada (≈ 25 kg en la orilla). ❓

---

## 6. Vuelco y anclaje (R4 y R10)

### 6.1 Normas

| Norma | Qué exige | Confianza |
|---|---|---|
| **ASTM F2057-23**, obligatoria en EE.UU. desde el 1-sep-2023 por la **ley STURDY** (CPSC) [12][13] | Aplica a muebles de guardado de ropa (cómodas, roperos, burós, armarios) **≥ 686 mm (27") de alto, ≥ 13.6 kg y ≥ 90.6 L** de volumen cerrado. No deben volcarse con **todas las puertas y cajones abiertos**, con cajones llenos (**136 kg/m³**), sobre un calce de **10.9 mm (0.43")** que simula la alfombra, y con **27.2 kg (60 lb)** en la orilla de un cajón abierto. Fuerza horizontal de 44.5 N (10 lb) en jaladeras de hasta 1 422 mm (56") de alto. Etiqueta de advertencia | ✅ |
| **México** | No encontré una NOM de estabilidad. Hay normas voluntarias antiguas: **NMX-Q-042-1982** (muebles domésticos – guardado), NMX-Q-039 (mesas), NMX-Q-044 (camas) [24]; no pude leer su contenido. Un blog cita la «NOM-167-SCFI-2009» [25], pero no aparece en el DOF | ❓ |
| Europa, EN 14749 (muebles de guardado) | No se consultó | ❓ |

### 6.2 Cálculo: cómoda de 900 × 800 × 450 con 4 cajones

Masas con triplay de 500 kg/m³ [7]: casco (laterales, piso y techo de 18 y trasera de 6) ≈ 15.9 kg; cada cajón (frente de 18, costados y trasera de 12, fondo de 6) ≈ 3.9 kg; ropa por cajón ≈ 5.6 kg (136 kg/m³ [12]).

Punto de giro: la orilla delantera de la base. Cajones de extensión total que salen 400 mm.

```
Momento que la sostiene: casco 15.9 kg × 0.225 m                      = 3.6 kg·m
Momento que la voltea:   4 cajones × 9.5 kg × (0.40 − 0.20) m          = 7.5 kg·m   ← ya se vuelca
                         + niño de 27.2 kg en la orilla × 0.40 m        = 10.9 kg·m
```

**Un mueble de triplay es ligero: la cómoda se vuelca con los cajones abiertos y llenos, sin niño.** ❓ Cálculo propio con los criterios de F2057 [12]. Conclusión: **toda cajonera de ≥ 686 mm va anclada al muro**; subirle el fondo no alcanza.

### 6.3 Reglas propuestas

- **R4 (relación alto/fondo):** se queda para libreros y roperos sin cajones (3 → recomendación, 4 con alto > 1 200 → crítico). ⚠️ Los umbrales no tienen fuente, pero van en la dirección correcta.
- **R11 nueva, estabilidad con elementos abiertos:** para cualquier mueble con cajones o puertas y alto ≥ 686 mm que no esté anclado, calcular `M_resistente` (masa × distancia del centro de gravedad al punto de giro) contra `M_volteo` (cajones abiertos y llenos + 27.2 kg en la orilla del cajón más alto que esté a ≤ 1 422 mm). Si voltea → **crítico**, con la solución automática `anclar-muro` (kit antivuelco, que ya está en el catálogo). ✅ criterios [12]; ❓ la simplificación.
- **R10 cajonera:** cambiar el umbral de 700 a **686 mm**, y detectarla por su geometría (≥ 1 grupo `cajon-*`), no por el nombre. ✅ [12]
- **Anclaje:** al menos 2 anclajes, a la estructura del muro (no solo a la tablaroca) [§8]. ⚠️
- *Nota de auditoría:* el calce de 10.9 mm (0.43"), los 27.2 kg (60 lb) en la orilla del cajón, la densidad de 8.5 lb/pie³ y la fuerza horizontal de 10 lbf a ≤ 56" se verificaron en el Federal Register [12] el 2026-09-25.

---

## 7. Pisos, bases, bancas y camas

### 7.1 Patas o zoclo

- **Zoclo corrido** (kick): reparte la carga y rigidiza (R5). Knotty usa 70 mm de alto, remetido 30 mm (`cabinet.ts`). ⚠️ En cocinas lo usual es 100 mm; en muebles de recámara, 50–80.
- **Patas:** cada pata concentra la carga; el piso del mueble trabaja como viga entre patas. **R7 hoy** revisa un piso con claro > 800 mm sin apoyo; es un caso particular de R1. **Propuesta:** tratar el piso sobre patas con R1, con la carga real del mueble, y quitar el umbral fijo de 800 (o dejarlo como respaldo). ❓
- **Pata al centro:** muebles sobre patas de más de ≈ 1 200 mm de ancho → patas intermedias. ⚠️ **Niveladores:** los pisos en México rara vez están a nivel; un nivelador por pata (ya está `pata-niveladora` en el catálogo). ⚠️

### 7.2 Bancas y asientos (cargas de personas)

- **Carga de diseño:** una persona de 110 kg (la misma de la norma europea de camas EN 1725 [21]); dos personas en una banca de 1 200. Carga **dinámica**: sentarse de golpe ≈ × 2. Sin fluencia. ❓
- **Cálculo** (asiento de 350 de fondo, 180 kg repartidos, E = 4 500, MOR ≈ 40 MPa [7]):

| Asiento | Claro 800 | Claro 1 000 | Claro 1 200 |
|---|---|---|---|
| 18 mm solo | 15.4 mm (L/52), σ 9.3 MPa | 30 mm (L/33), σ 11.7 | 52 mm (L/23), σ 14.0 → con × 2 dinámico, 28 MPa: factor 1.4 ✗ |
| 2 × 18 laminado | 1.9 mm (L/416) | 3.8 mm (L/266) | 6.5 mm (L/185) |
| 18 + 2 faldones de 18 × 80 (frente y atrás) | — | 0.8 mm (L/1 263) | 1.4 mm (L/877) |

**Regla R19 nueva:** asiento → carga `person` (dinámica × 2) y comprobación de resistencia `σ ≤ MOR/3`; flecha ≤ L/200. Solución automática: **agregar faldones de 18 × 80** o laminar. ❓

### 7.3 Camas

- **Separación entre tablillas** (slats): **≤ 75 mm (3")** para colchones de espuma, látex o híbridos; hasta 100 mm (4") para resortes. Varias garantías de colchón piden ≤ 75 mm. ✅ [22] y otras fuentes coincidentes.
- **Carga de diseño:** EN 1725:2023 supone un usuario de hasta 110 kg [21]. Una cama matrimonial para dos: ≈ 220 kg de personas + 30 kg de colchón. ❓
- **Tablilla de triplay de 18 × 100 a cada 175 mm** (75 de hueco), 220 kg/m² bajo una persona, sin fluencia:
  - Claro de 660 (matrimonial de 1 350 con **apoyo central**): δ 4.3 mm, σ 3.8 MPa. Bien.
  - Claro de 1 335 (sin apoyo central): δ 71 mm, σ 15.6 MPa. **No sirve.**
  - Una rodilla (110 kg × 1.5) sobre **una** tablilla de 660: σ 49.5 MPa > MOR ≈ 44 [7] → se rompe si no reparte. El colchón reparte entre 3 o más tablillas (≈ 16 MPa). Por eso las tablillas de triplay deben ser de 18 × 100 o más. ❓
- **Apoyo central:** `BED_SPAN = 800` (R10) es razonable para tablillas de 18 × 100; ❓ propuesta de 700 mm. King (1 930 de ancho) → dos apoyos intermedios. La cama con plataforma de triplay de 18 continua también necesita apoyos a cada ≈ 600–700 mm (R1 con la carga `person`). ❓

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

**French cleat** (listón a 45°): un listón atornillado al muro y su contraparte en el mueble, ambos cortados a 45°; el mueble se cuelga y el bisel lo jala hacia el muro [20]. ✅ Reparte la carga en muchos anclajes y facilita la instalación. En triplay de 18, el listón de 80–100 mm de alto con un anclaje a cada 300–400 mm. ⚠️

### 8.2 Capacidad de anclajes por tipo de muro

| Muro (México) | Anclaje | Carga de trabajo por anclaje | Factor de seguridad | Fuente |
|---|---|---|---|---|
| **Tablaroca** 12.7 mm (½") | Taquete de mariposa (toggle) de 6 mm (¼") | **27 kg** a extracción y a cortante (60 lb) | 4 | ✅ [18] |
| Tablaroca 12.7 mm | Toggle de 13 mm (½") | 36 kg (80 lb) | 4 | ✅ [18] |
| **Block hueco de concreto** | Toggle de 6 mm | **32 kg** a extracción, 54 kg a cortante | 5 | ✅ [18] (CMU de 6" grado N) |
| Block hueco | Toggle de 10 mm (⅜") | 64 kg a extracción y a cortante | 5 | ✅ [18] |
| **Tabique macizo** | Taquete de nylon de 8 × 40 (tipo fischer SX) | **61 kg** (0.60 kN) en ladrillo ≥ Mz 12 | 7 | ✅ [19] |
| Ladrillo hueco o perforado | Taquete de 8 × 40 | **17 kg** (0.17 kN) | 7 | ✅ [19] |
| Ladrillo hueco | Taquete largo de 8 × 65 | 51 kg (0.50 kN) | 7 | ✅ [19] |
| Concreto (losa, columna) | Taquete de 8 × 40 | 71 kg (0.70 kN) | 7 | ✅ [19] |

**Advertencias:**

- El tabique rojo recocido artesanal de México puede ser más débil que el ladrillo alemán Mz 12 de la tabla de fischer. **Usar la mitad** hasta validar. ❓
- En tablaroca, los postes son de lámina, no de madera: un tornillo para madera no agarra en ellos. Lo seguro es toggle o un refuerzo de madera o triplay dentro del muro, puesto antes de cerrarlo. ⚠️
- **Nunca atornillar a la trasera de 3–6 mm:** va un **listón de colgar** de 18 × 80–100 arriba y atrás (R10 `wallCabinet` ya lo sugiere). ✅

**Regla R16 nueva:** mueble colgado → `extracción = W·e/h` y `cortante = W`; comparar con `n × capacidad(anclaje, muro)`. El tipo de muro es un dato que se le pregunta a la persona (block, tabique, tablaroca, concreto). Crítico si no alcanza; solución automática: más anclajes, French cleat o apoyo en el piso. ❓ Por diseñar.

---

## 9. Tabla de reglas

**Estado:** ✅ bien · ⚠️ umbral dudoso o sin fuente · 🔧 corregir · ➕ nueva.

| Código | Qué verifica | Fórmula o umbral | Severidad | Solución automática (sin experto) | Estado | Fuentes |
|---|---|---|---|---|---|---|
| R1_FLECHA | Pandeo de repisas | `δ_final = k·5wL⁴/(384EI)`; recomendación > L/360; **crítico > L/100** (hoy L/200); E del material (4 500 / 2 000); k 2.0 | recomendación / crítico | **Canto 18 × 40**, divisor al centro, siguiente espesor, laminar 2 × 18, claro máximo | 🔧 E, k, umbral crítico y canto; excluir pisos en el suelo | [1][2][3][4][6][7][8][9][10] |
| R2_ESPESOR_UNION | Espesor mínimo por unión; profundidad de canal | Tabla de §5 de la propuesta; canal ≤ t/3 | recomendación / crítico | Subir espesor, cambiar unión | ⚠️ práctica, coherente | — |
| R3_TORNILLOS | Largo, extremo, bolsillo | Penetración ≥ 25 mm; ≥ 25 mm del extremo; tabla de Kreg | recomendación / crítico | Tornillo más largo o más corto | ⚠️ práctica | — |
| R4_VUELCO | Relación alto/fondo | ≥ 3 recomendación; ≥ 4 con alto > 1 200 crítico | recomendación / crítico | Anclar, más fondo | ⚠️; complementar con R11 | [12] |
| R5_ESCUADRADO | Trasera o marco rígido | Trasera ≥ 6 en 3 lados, 3 pegada en rebaje, o marco | recomendación / crítico (> 600) | Trasera de 6, rebaje, travesaño | ✅; sumar repisa fija en ranura; distinguir 3 mm solo clavada | [26] |
| R6_PUERTAS | Bisagras y ancho | por alto **y** peso (tabla de `02` §6.1: 900/1600/2000/2400 mm → 2/3/4/5; 6/12/18/22 kg); ancho > 600 | recomendación / crítico | Más bisagras, dos hojas | 🔧 sumar peso (9 kg/m²) y puertas > 1 800 | [4][7] |
| R7_BASE | Piso en el aire | Claro > 800 sin apoyo | recomendación | Apoyo central, zoclo | ⚠️ duplica R1; migrar a R1 con carga real | — |
| R8_VETA | Veta atravesada | Pieza visible con veta a lo ancho | detalle | Veta a lo largo | ✅ (y R1 ya usa E⊥) | [6][7] |
| R9_CAJONES | Hueco de corredera, fondo, roce del frente | Hueco = holgura **+0 / +0.8** (hoy ±1); fondo de 3 mm desde **300** de ancho (hoy 450) | crítico / recomendación | Ajustar caja, fondo de 6, holgura de 2 | 🔧 | [11][14][15] |
| R10_USO | Tipología (cama, escritorio, mesa, cajonera…) | Colchón, alturas, rodillas, anclaje de cajonera **≥ 686** (hoy 700), tablillas ≤ 75 mm | varía | Varias | 🔧 umbral 686 y detectar por geometría | [12][21][22] |
| **R11_TIP_OPEN** ➕ | Vuelco con cajones y puertas abiertos | `M_res = m·g·x_cg` contra cajones llenos (136 kg/m³) + 27.2 kg en la orilla | crítico | Anclar al muro (kit antivuelco) | nueva | [12] |
| **R12_SLIDE_CAPACITY** ➕ | Carga del cajón contra la capacidad de la corredera | `q_uso × área del fondo ≤ capacidad` (20 / 30 / 45 kg) | recomendación | Corredera siguiente | nueva | [14][17] |
| **R13_DRAWER_BOTTOM** ➕ (o dentro de R9) | Flecha del fondo como placa | Tabla del §4.3; ≤ 3 mm | recomendación | Fondo de 6 o 9, travesaño | nueva ❓ | [11] |
| **R14_DOOR_WEIGHT** ➕ (o dentro de R6) | Bisagras por peso; alabeo | `n = max(porAlto, porPeso)`; alto > 1 800 → detalle | recomendación / detalle | Más bisagras, acabado balanceado | nueva ❓ | [4][7] |
| **R15_FRONT_EDGE** ➕ (alternativa de R1) | Proponer el canto frontal cuando R1 falla | Sección compuesta, `I × 3` con 18 × 40 | — | `addFrontEdge` | nueva | [2][28] |
| **R16_WALL_ANCHOR** ➕ | Mueble colgado: anclajes contra muro | `W·e/h ≤ n·T_adm`; `W ≤ n·V_adm` | crítico | Más anclajes, French cleat, apoyo al piso | nueva | [18][19][20] |
| **R17_FLOATING_SHELF** ➕ | Repisa flotante | Igual que R16 con `h` = espesor | crítico / recomendación | Soporte oculto, muro macizo, carga ligera | nueva ❓ | [18][19] |
| **R18_TABLE_RACKING** ➕ | Mesa o escritorio sin faldón ni travesaños | Patas sin faldón y alto > 600 | recomendación / crítico | Faldón de 80–120, travesaño trasero | nueva ⚠️ | — |
| **R19_SEAT_STRENGTH** ➕ | Asientos: resistencia y flecha con personas | 110 kg por persona, × 2 dinámico, `σ ≤ MOR/3`, `δ ≤ L/200` | crítico | Faldones de 18 × 80, laminar | nueva ❓ | [7][21] |
| **R20_BED_SLATS** ➕ (en R10) | Tablillas: separación y claro | Hueco ≤ 75 mm; claro ≤ 700 con 18 × 100 | recomendación / crítico | Más tablillas, apoyo central | nueva | [21][22] |
| **R21_MATERIAL_SAVING** ➕ | Ahorro sin perder estructura | Travesaños en vez de techo; costados de 12; trasera de 3 en rebaje; solo si baja el número de hojas | detalle | Cambio sugerido, nunca automático | nueva ⚠️ | — |
| **R22_LEGS** ➕ | Patas: número y separación | Ancho > 1 200 → pata intermedia; R1 sobre el piso entre patas | recomendación | Pata central | nueva ⚠️ | — |

---

## 10. Para Knotty: qué se puede volver regla o dato

**Idea:** separar (1) los **datos del material** (E, MOR, densidad, fluencia), (2) los **casos de carga** (libros, ropa, persona, TV), (3) las **especificaciones de regla** (a qué aplica, umbrales, severidad, soluciones y fuentes) y (4) los **cálculos puros** (flecha, placa, vuelco, anclaje), que siguen siendo código probado. El LLM sigue narrando y el motor sigue calculando.

```ts
import { z } from 'zod'

// ---------- 1. Material properties: they belong to the catalog, not to the rules ----------
export const StructuralProps = z.object({
  construction: z.enum(['plywood', 'blockboard', 'solidWood', 'mdf']),
  plies: z.number().int().nullable().describe('Número de capas; null si no se sabe'),
  /** MPa, face grain along the span / across it. */
  eParallel: z.number().positive(),
  ePerpendicular: z.number().positive(),
  /** MPa, bending strength (modulus of rupture). */
  mor: z.number().positive(),
  /** kg/m³ */
  density: z.number().positive(),
  /** Final / initial deflection under sustained load. */
  creep: z.number().min(1),
  source: z.string().describe('Ficha o prueba de donde salen los valores'),
})
export type StructuralProps = z.infer<typeof StructuralProps>

export const PINE_PLYWOOD: StructuralProps = {
  construction: 'plywood', plies: null, eParallel: 4500, ePerpendicular: 2000, mor: 40, density: 500, creep: 2.0,
  source: 'Eagon 18 mm EN 310; APA PDS tabla 4B; NDS 3.5 (K_cr = 2.0)',
}

// ---------- 2. Load cases ----------
export const LoadCase = z.object({
  id: z.enum(['none', 'light', 'medium', 'heavy', 'dishes', 'clothes', 'tv', 'person', 'file']), // heavy = «libros» (legacy: pesada)
  label: z.string().describe('Para la persona: "libros", "ropa doblada"'),
  areaLoad: z.number().min(0).describe('kg/m²'),
  pointLoads: z.array(z.object({ kg: z.number(), at: z.number().min(0).max(1) })).default([]),
  sustained: z.boolean().describe('Se queda puesta meses: aplica fluencia'),
  dynamicFactor: z.number().min(1).default(1),
})
export const LOAD_CASES = {
  light: { id: 'light', label: 'carga ligera', areaLoad: 50, pointLoads: [], sustained: true, dynamicFactor: 1 },
  medium: { id: 'medium', label: 'carga media', areaLoad: 100, pointLoads: [], sustained: true, dynamicFactor: 1 },
  heavy: { id: 'heavy', label: 'libros', areaLoad: 150, pointLoads: [], sustained: true, dynamicFactor: 1 },
  person: { id: 'person', label: 'una persona', areaLoad: 0, pointLoads: [{ kg: 110, at: 0.5 }], sustained: false, dynamicFactor: 2 },
} satisfies Record<string, z.input<typeof LoadCase>>

// ---------- 3. Constructive fixes Knotty can simulate and apply without the expert ----------
export const FixSpec = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('changeMaterial'), next: z.enum(['thicker', 'rotateGrain']) }),
  z.object({ kind: z.literal('addFrontEdge'), width: z.number(), height: z.number(), species: z.string() }),
  z.object({ kind: z.literal('addDivider'), at: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('laminate'), layers: z.literal(2) }),
  z.object({ kind: z.literal('addRail'), where: z.enum(['topFront', 'topBack', 'bottomBack']), height: z.number() }),
  z.object({ kind: z.literal('addApron'), height: z.number() }),
  z.object({ kind: z.literal('addCenterSupport') }),
  z.object({ kind: z.literal('setJoint'), type: z.enum(['rabbet', 'groove', 'dado', 'pocketScrew', 'dowel', 'nailGlue']), glue: z.boolean() }), // JointKind ids (10-auditoria.md §3)
  z.object({ kind: z.literal('anchorToWall'), hardwareId: z.string() }),
  z.object({ kind: z.literal('upgradeHardware'), family: z.enum(['slide', 'hinge', 'anchor']) }),
])
export type FixSpec = z.infer<typeof FixSpec>

// ---------- 4. Rule as data: thresholds, scope, fixes and sources; the check is a named pure function ----------
export const RuleSpec = z.object({
  code: z.string().regex(/^R\d+_[A-Z_]+$/),
  title: z.string().describe('Para la persona, en español'),
  appliesTo: z.object({
    roles: z.array(z.string()).optional(),
    kinds: z.array(z.string()).optional().describe('Tipologías de typology.ts: bed, desk, drawers…'),
    minHeight: z.number().optional(),
  }),
  check: z.enum(['beamDeflection', 'plateDeflection', 'tipOver', 'anchorPullOut', 'slideCapacity', 'hingeCount', 'racking']),
  params: z.record(z.string(), z.number()).describe('Umbrales calibrables: limitRecommendation, limitCritical…'),
  severity: z.object({ recommendation: z.string(), critical: z.string().optional() }).describe('Condiciones legibles; el motor las evalúa por nombre'),
  message: z.string().describe('Plantilla en español con {claro}, {flecha}…'),
  fixes: z.array(FixSpec).describe('En orden de preferencia: lo más barato primero'),
  sources: z.array(z.number()).describe('Índices de docs/investigacion/05-reglas-estructurales.md'),
  confidence: z.enum(['verified', 'singleSource', 'toValidate']),
})
export type RuleSpec = z.infer<typeof RuleSpec>

export const SHELF_SAG: RuleSpec = {
  code: 'R1_FLECHA',
  title: 'Repisas que se pandean',
  appliesTo: { roles: ['shelf', 'bottom', 'top'] }, // legacy role ids: entrepano, piso, techo
  check: 'beamDeflection',
  params: { limitRecommendation: 360, limitCritical: 100 },
  severity: { recommendation: 'deflection > span/360', critical: 'deflection > span/100' },
  message: '{nombre} se pandearía ~{flecha} mm con {carga} en un claro de {claro} mm (lo aceptable es hasta {limite} mm).',
  fixes: [
    { kind: 'addFrontEdge', width: 18, height: 40, species: 'pino' },
    { kind: 'addDivider', at: 0.5 },
    { kind: 'changeMaterial', next: 'thicker' },
    { kind: 'laminate', layers: 2 },
  ],
  sources: [1, 2, 4, 6, 7, 8, 10],
  confidence: 'singleSource',
}

export const DRAWER_TIP: RuleSpec = {
  code: 'R11_TIP_OPEN',
  title: 'Vuelco con cajones abiertos',
  appliesTo: { minHeight: 686 },
  check: 'tipOver',
  params: { childKg: 27.2, clothesKgPerM3: 136, maxHandleHeight: 1422, carpetShim: 10.9 },
  severity: { recommendation: 'never', critical: 'overturning > resisting' },
  message: 'Con los cajones abiertos y llenos, {nombre} se va de frente: el peso lo voltea con {volteo} kg·m y solo lo sostienen {resistente}. Va anclado al muro.',
  fixes: [{ kind: 'anchorToWall', hardwareId: 'kit-antivuelco' }],
  sources: [12, 13],
  confidence: 'verified',
}

// ---------- Pure calculations stay in code (tested), e.g. composite section with a front edge ----------
export function compositeInertia(depth: number, t: number, edge: { width: number; height: number; e: number } | null, ePly: number) {
  const parts = [{ b: depth, h: t, y: t / 2, n: 1 }]
  if (edge) parts.push({ b: edge.width, h: edge.height, y: edge.height / 2, n: edge.e / ePly })
  const area = parts.reduce((s, p) => s + p.n * p.b * p.h, 0)
  const centroid = parts.reduce((s, p) => s + p.n * p.b * p.h * p.y, 0) / area
  return parts.reduce((s, p) => s + p.n * (p.b * p.h ** 3 / 12 + p.b * p.h * (p.y - centroid) ** 2), 0)
}
```

**Qué cambia en el código actual, sin reescribirlo:**

1. `SUPUESTOS.moduloElasticidad` y `fluencia` pasan al catálogo de materiales (`StructuralProps`). `T12/T15/T18` usan `PINE_PLYWOOD`; se puede sumar «caobilla listonado» con sus propios valores.
2. `SUPUESTOS.cargas` se vuelve `LOAD_CASES`; `Carga` del esquema gana `tv` y `person` (o la tipología las asigna sola: asiento → `person`).
3. `limiteFlecha.critico` pasa de 200 a 100, con prueba de regresión que fije los casos de la tabla del §1.6.
4. Las `alternativas` de R1 suman `addFrontEdge` con su flecha simulada; `repair.ts` ya muestra el patrón de aplicar una operación y quedarse con ella solo si mejora.
5. `cajones.toleranciaCorredera` se vuelve `{ under: 0, over: 0.8 }`; `anchoFondoDelgado` pasa de 450 a 300.
6. `CabinetConstruction.top` gana `'rails'` (dos travesaños de 100 mm) para muebles bajos con cubierta, y `back` gana `'rabbetGlued3'`.

---

## 11. Preguntas frecuentes

**1. ¿Por qué Knotty me dice que mi repisa de 18 mm de 80 cm se va a pandear, si en todas partes dicen que aguanta?**
Aguanta sin romperse; lo que cambia es cuánto se ve. Con libros y después de unos años se pandea ≈ 7 mm (L/111). Las tablas de internet ignoran la fluencia o suponen un triplay más rígido que el pino (§1.5–1.6). La solución barata es un canto de madera de 18 × 40 pegado al frente.

**2. ¿El fondo de la repisa cambia el claro máximo?**
No, si la carga se cuenta por metro cuadrado: una repisa más honda carga más, pero también es más rígida en la misma proporción (§1.1). Sí cambia si pones una sola fila de libros en una repisa muy honda.

**3. ¿Vale la pena pegar dos hojas de 18?**
Sí, si van pegadas en toda la cara: la rigidez se multiplica por 8 y el claro por 2. Solo atornilladas, la rigidez se duplica y el claro crece 26 % (§1.6).

**4. ¿Trasera de 3 o de 6 mm?**
La de 6 clavada y pegada en todo el perímetro escuadra el mueble por sí sola. La de 3 también, pero solo pegada en rebaje o canal; clavada sin pegamento casi no ayuda (§2).

**5. ¿Mi cómoda necesita ir anclada si es de 90 cm?**
Sí. Una cómoda de triplay es ligera y, con los cajones abiertos y llenos, se vuelca sin que nadie se suba (§6.2). La norma de EE.UU. aplica desde 686 mm de alto.

**6. ¿Hay una norma mexicana de muebles?**
Solo encontré normas voluntarias antiguas (NMX-Q-038 a 044, 1981–1982) y ninguna NOM de estabilidad verificable. Knotty usa como referencia la norma de EE.UU. ASTM F2057-23 (§6.1).

**7. ¿Qué corredera compro y cuánto espacio dejo?**
En las de balines de montaje lateral, 12.7 mm por lado, con hasta 0.8 mm de sobra y nunca menos: haz la caja 26 mm más angosta que el hueco. Revisa la capacidad: en Home Depot MX hay de 20 y 30 kg; para cajones de libros o archivo, busca de 45 kg (§4.1).

**8. ¿Fondo de cajón de 3 mm?**
Solo en cajones de menos de 300 mm de ancho con carga ligera. Arriba de eso, 6 mm; para archivo o herramientas, 9 mm (§4.3).

**9. ¿Cuántas bisagras lleva una puerta?**
Por alto y por peso, lo que pida más: 2 hasta 900 mm y 6 kg, 3 hasta 1600 mm y 12 kg, 4 hasta 2000 mm y 18 kg (`02-uniones-y-herrajes.md` §6.1). Una puerta de triplay de 18 mm pesa ≈ 9 kg/m² (§5).

**10. ¿Puedo colgar una alacena en tablaroca?**
Sí, con taquetes de mariposa: uno de 6 mm aguanta ≈ 27 kg de trabajo en tablaroca de 12.7 mm. Mejor a los postes o a un refuerzo interior, con un listón de colgar o French cleat, y nunca atornillada a la trasera delgada (§8).

**11. ¿Por qué mi repisa flotante se cae si «solo» tiene 20 kg?**
Porque el brazo de palanca es su propio espesor: 20 kg a 12.5 cm del muro jalan ≈ 83 kg los anclajes de arriba. Necesita muro macizo y un soporte metálico, o cargarla poco (§8.1).

**12. ¿Cuántas tablillas lleva una base de cama?**
Tablillas de triplay de 18 × 100 con un hueco de 75 mm o menos entre ellas, y un apoyo central desde la matrimonial (dos en la king) para que el claro no pase de ≈ 700 mm (§7.3).

---

## 12. Dudas abiertas

- **E real del triplay de pino que vende Home Depot MX** (y cuántas capas tiene): hacer la prueba casera del §1.9 con 12, 15 y 18 mm, en las dos direcciones.
- **Umbral crítico L/100:** es una propuesta derivada de la AWS; validarlo con fotos de repisas reales.
- **Tabla de bisagras por alto y peso** del fabricante que se consiga en México (Blum, Hettich, Handy Home).
- **Normas mexicanas:** conseguir NMX-Q-042-1982 y confirmar que la «NOM-167-SCFI-2009» no existe.
- **Tabique rojo recocido y block hueco mexicanos:** resistencia de taquetes (fichas de fischer México o pruebas).
- **Carga de diseño de asientos y camas:** la norma EN 1725 completa y la EN de asientos; el factor dinámico × 2 es un supuesto.
- **Correderas Handy Home:** holgura lateral exacta (se supuso 12.7 mm).
- **Posible falso positivo** de R1 en pisos que descansan en el suelo (§1.8).

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
14. Accuride, *Model 3832* y *3832EC Quick Reference*. https://www.accuride.com/hardware/Model-3832 · https://www.accuride.com/media/amasty/amfile/attach/lsENsMwHMdlHk0OlD2EpkPTjq1u8ZoYw.pdf (*nota de auditoría, 2026-09-25: la primera dirección cae en un ciclo de redirecciones; el PDF sí abre y confirma 12.7 mm +0.8/−0 y 45.5 kg por par*)
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
