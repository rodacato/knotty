# 02 — Uniones y herrajes para muebles de triplay

> Investigación del 2026-09-25 para Knotty. Unidades: milímetros, kilogramos y grados Celsius. Cuando algo se vende en pulgadas, primero van los mm y después la designación comercial, p. ej. «32 mm (1¼")».
>
> **Nivel de confianza** en cada afirmación importante: ✅ dos o más fuentes coinciden · ⚠️ una sola fuente, o práctica de taller · ❓ por validar (sin fuente sólida, o las fuentes se contradicen).
>
> Las referencias [n] están en la sección «Fuentes». Si un número no trae referencia, es un cálculo derivado de otros números que sí la traen (así se indica).

---

## 0. Resumen para quien tiene prisa

1. **El tornillo al canto del triplay agarra menos que en la cara**, entre 75 % y 85 % de lo que agarra en la cara según pruebas de extracción [8][9] ✅. El problema en el taller es que **raja o abre las chapas** si no se pre-taladra [16][53] ⚠️. El triplay de pino con huecos en el alma empeora las cosas.
2. **En 15 mm el triplay rinde casi igual que en 18 mm** en esquinas atornilladas, según una prueba con triplay de okume [10] ⚠️. Eso respalda el T15 como material para el casco.
3. **Canal (dado/groove): profundidad ≤ ⅓ del espesor; nunca > ½** [20][21] ✅. El rebaje (rabbet) acepta más, entre ½ y ⅔ [22] ⚠️.
4. **Bisagra de cazoleta de 35 mm: Blum pide puerta de 16 mm como mínimo**, con cazoleta de 13 mm de profundidad [35][42] ✅. La R2 de Knotty acepta 15 mm: **hay que corregirlo**. *Nota de auditoría:* canónico: ≥ 16 mm sin aviso (18 ideal); 15 mm → recomendación («revisa que la cazoleta de tu bisagra sea de 11–11.5 mm o usa 18 mm»); < 14 mm → crítico salvo bisagra para puerta delgada (Blum la vende para frentes de 8–14 mm, verificado en su catálogo, p. 70). Muchas bisagras bidimensionales económicas que se venden en México tienen cazoleta de ≈ 11.5 mm y sí trabajan en 15 mm ❓.
5. **Corredera telescópica de bolas: 12.7 mm por lado, con tolerancia de +0.8/−0 mm** (Accuride [44]) o **13 mm +0.5/−0.2** (Ducasse [46]) ✅. La R9 acepta ±1 mm: **con −1 mm el cajón no entra**. Hay que corregirlo. *Nota de auditoría:* verificado en la ficha de Accuride 3832EC («Side Space: .50" +0.031/−0.0 [12.7 mm +0.8/0.0]»). Canónico para Knotty: aceptar 12.7–13.5 mm por lado y **diseñar la caja 26 mm más angosta que el hueco (13 mm por lado)**, al centro de la tolerancia, porque los cortes de tienda varían ±0.5 mm.
6. **Bisagras por puerta:** hasta 900 mm y 6 kg lleva 2; hasta 1600 mm y 12 kg, 3; hasta 2000 mm y 18 kg, 4 [39][37] ✅. La R6 cambia de 3 a 4 bisagras en 1500 mm y no revisa el peso.
7. **Tornillo de bolsillo (Kreg):** 25 mm (1") para 12–16 mm y 32 mm (1¼") para 19 mm, con rosca gruesa en triplay [1][4] ✅. El catálogo solo trae el de 1¼".
8. **Sistema 32:** perforaciones de 5 mm cada 32 mm, a 37 mm del frente, de 12–14 mm de profundidad [28][29] ✅. **En triplay de 15 mm esa profundidad casi lo atraviesa**, así que conviene limitarla a 10 mm ⚠️.

---

## 1. Qué modela Knotty hoy (punto de partida)

| Pieza del modelo | Dónde | Qué hace |
|---|---|---|
| `TipoUnion` | `diseno/esquema.ts` | `tope-tornillo`, `bolsillo`, `tarugo`, `minifix`, `canal`, `rebaje`, `escuadra`, `clavo-pegamento`, `soporte-repisa`, `bisagra-cazoleta`, `corredera` |
| Inferencia de uniones | `diseno/joints.ts` | Trasera → clavo; repisa móvil → 2 soportes de 5 mm; cara contra canto → `tope-tornillo` con el tornillo #8 más corto que entre ≥ 25 mm; ≤ 3 mm → clavo; puerta → bisagra **recta** siempre |
| R2 | `reglas/uniones.ts` + `supuestos.ts` | Espesor mínimo por unión (tabla en §9); canal/rebaje ≤ t/3 recomendado, > t/2 crítico |
| R3 | `reglas/tornillos.ts` | Penetración ≥ 25 mm; que el tornillo no atraviese la cara (≤ ta + tb − 3); bolsillo máximo por espesor; distancia al extremo 25 mm |
| R9 | `reglas/cajones.ts` | Holgura de la corredera = `holguraLateral` ± 1 mm; fondo < 6 mm con ancho > 450 mm; frente que roza |
| Cajón | `operaciones/cajon.ts` | Caja de 4 lados atornillada con #8 × 2", fondo clavado abajo, frente embutido con 2 mm de holgura, corredera más larga que quepa en el fondo − 10 mm |
| Catálogo | `public/catalogo/catalogo.json` | Tornillos #8 × 1", 1¼", 1½" y 2"; bolsillo 1¼"; tarugo 8 × 40; minifix 15; soporte de 5 mm; bisagras recta, codo y súper codo; correderas de 30 a 50 cm con 12.7 mm; escuadra 1½"; clavo 1"; pegamento; cubrecanto; pata; jaladera; kit antivuelco |

---

## 2. Por qué el tornillo al canto del triplay agarra mal

- **Extracción:** en tableros, la resistencia a la extracción desde el canto es **75–80 %** de la que tiene la cara [8]. En triplay la relación canto/cara ronda **0.85** [9] ✅. La diferencia en sí es moderada.
- **El problema real es cómo falla.** El canto del triplay está hecho de chapas alternadas, y la mitad tiene la veta de punta, que agarra mal. La rosca además hace cuña entre chapas, así que el tornillo **abre la línea de pegado (delamina)** o raja la chapa exterior [16][53] ⚠️. Los foros de ebanistería coinciden en que atornillar al canto «no es lo recomendable, pero a veces es necesario» [9] ⚠️.
- **Triplay de pino económico (el de Home Depot MX):** tiene menos chapas y huecos en el alma. Kreg recomienda que en triplay barato el bolsillo quede «por fuera, apuntando hacia adentro», para que la presión empuje las chapas en vez de separarlas [2] ⚠️.

**Cómo se hace bien (práctica de taller):**

| Paso | Valor | Fuente | Confianza |
|---|---|---|---|
| Diámetro del tornillo: #6 / #8 / #10 | 3.5 / 4.2 / 4.8 mm (0.138/0.164/0.190") | [53] | ✅ |
| Pre-taladro (piloto) para #8 | 2.8 mm (7/64") en madera blanda, 3.2 mm (1/8") en dura | [53] | ✅ |
| Piloto en triplay, MDF o aglomerado | usar **por lo menos el diámetro de madera dura**: un piloto chico no agarra más, hincha y revienta el canto | [53] | ⚠️ |
| Barreno de paso en la pieza de arriba (#8) | 4.4 mm (11/64"), para que la pieza de arriba no «flote» y la junta cierre | [53] | ⚠️ |
| Profundidad del piloto al canto | un poco más que la punta del tornillo | [53] | ⚠️ |
| Avellanado | cabeza plana al ras. En triplay, avellanar evita que la cabeza levante astillas de la chapa | práctica | ⚠️ |
| Distancia al borde | ≥ 3 diámetros: ≈ 13 mm para #8 [55]; ≥ 19 mm (¾") del extremo [55] | [55] | ⚠️ |
| Esquinas atornilladas en triplay | tornillo de 4 × 50 mm, piloto de ≈ 80 % del diámetro de raíz; el triplay superó al MDF y al aglomerado | [10] | ⚠️ |

---

## 3. Catálogo de uniones

Escala de resistencia relativa: **baja / media / alta**, para un casco de triplay cargado con uso doméstico. Donde hay pruebas, se citan. Casi ninguna se hizo en triplay de pino mexicano, así que la escala se toma como **orden**, no como valor absoluto.

### 3.1 Pruebas de resistencia disponibles

| Prueba | Material | Resultado | Fuente | Confianza |
|---|---|---|---|---|
| Fine Woodworking, núm. 203 (2009): 18 uniones en laboratorio | cerezo macizo, Titebond III, 5 días de curado, compresión diagonal | Dowelmax 759 · espiga ¼" 717 · **bolsillo 698 · Domino 597 · galleta 545** (unidades de fuerza de falla; las fuentes secundarias no coinciden en la unidad) | [6][7] | ⚠️ (madera maciza, no triplay) |
| Woodgears (Matthias Wandel) | abeto de 17 × 59 mm, palanca a 15 cm | bolsillo sin pegamento **≈ 45 kg (99 lb)**, con pegamento ≈ 50 kg (111 lb); tarugo con pegamento ≈ 71 kg (156 lb); caja y espiga ≈ 100 kg (222 lb). El pegamento casi no ayuda al bolsillo | [5] | ⚠️ |
| Esquinas de triplay de 19 mm con tarugo | triplay de madera dura de 11 chapas; tarugos de 6/8/10 mm a 9/13/17 mm de profundidad | **8 mm resiste más que 6 y que 10**; más profundidad = más resistencia | [11] | ⚠️ |
| Esquinas atornilladas: triplay vs MDF vs aglomerado | triplay de okume de 15 y 18 mm, tornillo de 4 × 50 sin pegamento | el triplay es el más rígido; **15 mm ≈ 18 mm** | [10] | ⚠️ |
| Confirmat en distintos tableros | triplay, aglomerado y otros | triplay + confirmat da la mayor capacidad; rigidez de la esquina en triplay 6.56 kN·m/rad vs 0.42 en aglomerado | [13] | ⚠️ |
| Ingletes reforzados (MDF y aglomerado) | tarugos, tira de triplay, llaves cola de milano | 2 tarugos > tira (spline) > llaves; 2 tarugos dan **+47 %** sobre 1 | [12] | ⚠️ (no es triplay) |
| Profundidad de canal en triplay de ¾" | triplay «de mueble» con pocas chapas | **6.35 mm (¼") fue lo más fuerte** en corte y extracción; 9.5 mm (⅜") ganó en desgarre; 12.7 mm (½") debilita | [20] | ⚠️ |

### 3.2 Tabla por unión

| Unión (inglés) | Resistencia | Espesor mínimo | Herramientas | Dificultad | Visibilidad | ¿Desarmable? | Cuándo usarla |
|---|---|---|---|---|---|---|---|
| **A tope con tornillo** (butt joint, screwed) | media (baja al canto de 12 mm) | receptor 15 mm; 12 mm con #6 ⚠️ | taladro, broca piloto, avellanador | básica | cabeza en la cara (se tapa con pasta o tapón) | sí, pocas veces (el canto se barre) | casco rápido, repisas fijas, cajones DIY |
| **Tornillo de bolsillo** (pocket hole, Kreg) | media-alta [6] | 12.7 mm (½") en ambas [2] ✅ | plantilla Kreg, broca escalonada, punta cuadrada #2 | básica | bolsillo en la cara oculta | sí, pocas veces | marcos, repisas fijas, travesaño superior, casco sin trasera estructural |
| **Tarugo / espiga** (dowel) | alta con pegamento [5][11] | 15 mm con Ø 6; 18 mm con Ø 8 ⚠️ | plantilla de tarugos, broca de 8 mm con tope | intermedia (precisión) | oculta | no (va pegado) | casco sin tornillos a la vista, alinear piezas |
| **Galleta** (biscuit) | media; sirve sobre todo para **alinear** | #0 en < 12.7 mm; #10–#20 en 18 mm [23][24] ✅ | galletera (fresadora de galletas) | básica | oculta | no | alinear cantos y esquinas pegadas |
| **Domino** (Festool) | media-alta [6] | 12 mm con 4 × 20; 18 mm con 5 × 30 [25][26] ⚠️ | Festool DF 500 (cara, poco común en México) ❓ | intermedia | oculta | no | quien ya tiene la máquina; Knotty no debe proponerla por defecto |
| **Ranura** (en taller también «canal»; *dado*: a través de la veta; *groove*: a lo largo) | alta para cargar repisas [67] | receptor 15 mm; profundidad ≤ ⅓ t, nunca > ½ t [20][21] ✅ | router con guía o sierra de mesa con disco dado | intermedia | se ve en el canto frontal si es pasante | no si va pegado | entrepaños fijos con carga, trasera o fondo de cajón en canal |
| **Rebaje** (rabbet) | media-alta | receptor 12 mm; profundidad ½–⅔ t [22] ⚠️ | router o sierra de mesa | intermedia | discreto | no si va pegado | trasera embutida, esquinas de caja, techo |
| **Lengüeta** (tongue and groove) | media-alta | 15 mm; lengüeta ≈ ⅓ t [68] ⚠️ | router con juego de fresas | intermedia | oculta | no | unir tableros en el mismo plano; poco útil en cascos |
| **Confirmat** 7 × 50 | alta [13] | 16 mm en cara; canto ≥ 16 mm ⚠️ | broca escalonada 5/7/10 mm, llave hexagonal o Pozi | básica con la broca correcta | cabeza en la cara (con tapón) | sí, varias veces | casco sin pegamento, desarmable, rápido |
| **Minifix / excéntrica** (cam lock) | media (menos que confirmat [13]) | 16 mm (caja de 15 mm, 12 mm de profundidad) [18] ⚠️ | broca Forstner de 15 mm, broca de 5–8 mm, plantilla | intermedia | tapón por dentro | **sí, muchas veces** | muebles desarmables (KD) |
| **Clavo o grapa + pegamento** (brad/staple + glue) | baja sola; media con pegamento | trasera 3–6 mm sobre canto ≥ 12 mm | clavadora de clavo sin cabeza calibre 18 o grapadora | básica | puntos casi invisibles | no | traseras, fondos de cajón, sujetar mientras seca el pegamento [60] |
| **Escuadra metálica** (L bracket, corner brace) | baja al descuadre; buena como apoyo | tornillo que no atraviese | desarmador | básica | muy visible | sí | reparaciones, repisas de apoyo, colgar del muro |
| **Inglete con tira** (spline miter) | media-alta [12] | 12 mm; tira de 3 mm de triplay [62] | sierra con inclinación a 45°, guía | avanzada | canto limpio | no | cajas y cubiertas donde se ve la esquina |
| **Cola de milano** (dovetail) | alta en madera maciza | 12 mm solo con **triplay tipo báltico sin huecos**; con triplay de pino de 5–7 chapas «se ve mal» [61] ⚠️ | router con plantilla de colas y fresa afilada | avanzada | visible (decorativa) | no | cajones finos en abedul báltico; **no en triplay de pino** |
| **Herraje desarmable** (KD: perno con tuerca de barril, inserto roscado, tuerca T, perno conector) [56][57] | alta (perno metálico) | 18 mm ⚠️ | broca de paso, Forstner, llave Allen de 4–5 mm | intermedia | cabeza visible o ahogada | **sí, ilimitado** | camas, mesas, muebles que se mudan |

**Notas por unión:**

- **Tornillo de bolsillo:** Kreg dice que la unión es tan fuerte que **el pegamento es opcional**. Lo recomienda en ingletes y exteriores [2]. La prueba de Woodgears lo confirma: el pegamento casi no aporta [5] ✅. Separación: uno cerca de cada extremo y luego **cada 150–200 mm (6–8")** en tableros [3] ✅. Rosca **gruesa** para triplay y maderas blandas [1] ✅. Las fuentes se contradicen para el MDF: la guía de tornillos pide rosca gruesa [1] y las preguntas frecuentes, rosca fina [2] ❓. En triplay de pino, rosca gruesa.
- **Tarugo:** regla del **⅓ del espesor** para el diámetro, lo que da 6 mm en 18 mm, aunque en tableros de 18 mm se usa 8 mm [27]. Por eso Knotty debería **proponer 6 mm en 15 mm y 8 mm en 18 mm** ⚠️. En la cara, no taladrar a más de **~⅔–¾ del espesor**: se abomba o revienta la chapa de enfrente [27] ⚠️. Separación **100–150 mm** [27] ⚠️. Algunos prefieren 6 mm en triplay porque raja menos la chapa exterior [27] ⚠️.
- **Galleta:** tamaños #0 de 47 × 15, #10 de 53 × 19 y #20 de 56 × 23 mm, todas de 4 mm de grueso [23] ✅. En triplay de 12.7 mm (½") solo cabe la #0 [24] ⚠️.
- **Domino:** espigas de 4 × 20, 5 × 30, 6 × 40, 8 × 40, 8 × 50 y 10 × 50 [26]. En triplay conviene **la más delgada**, porque la espiga es más fuerte que el tablero que la rodea [25] ⚠️.
- **Confirmat:** broca escalonada que hace a la vez 7 mm de paso, 5 mm de piloto y ≈ 11 mm de avellanado [16][17]. Separación **≤ 128 mm** entre centros y **≤ 36 mm** a cada borde (práctica AWI) [15] ⚠️. Se diseñó para aglomerado y MDF: **en triplay con alma de chapa puede rajar** [16] ⚠️, aunque las pruebas dan buena capacidad en triplay [13] ⚠️. Sobre qué espesor usa el 7 × 50, las fuentes no coinciden: una lo asigna a tableros de 25–30 mm [17] y la práctica norteamericana lo usa en 19 mm [16] ❓.
- **Minifix:** caja de **15 mm** de diámetro, a **24 o 34 mm** del canto, de 12 mm de profundidad en 16 mm y 14 mm en 19 mm. Perno con rosca para madera en barreno de 5 mm. Se acompaña de tarugos de 8 mm que toman el cortante [18] ⚠️. Una prueba con herrajes desarmables encontró el máximo con la excéntrica a 60 mm del extremo [71] ⚠️. Häfele México lo vende [19] ✅.
- **Clavo y grapa:** clavo calibre 18 (brad) para trasera de 6.35 mm (¼"): hasta 25 mm (1") de largo [60], cada ~150–200 mm (6–8") [60] ⚠️. Sirve para sostener mientras seca el pegamento, no como unión estructural [60] ⚠️.

---

## 4. Sistema 32 mm y soportes de repisa

| Parámetro | Valor | Fuente | Confianza |
|---|---|---|---|
| Separación entre perforaciones | 32 mm | [28][29] | ✅ |
| Diámetro | 5 mm | [28][29] | ✅ |
| Primera línea al frente | 37 mm (también 37 mm desde atrás) | [28][29] | ✅ |
| Profundidad | 12–14 mm | [28] | ⚠️ |
| Distancia entre líneas | múltiplos de 32 mm | [28] | ⚠️ |
| Soporte de repisa (espiga) | 15–16 mm de largo, ≈ 7 mm de ceja | [28] | ⚠️ |
| Placa de bisagra | en la línea de 37 mm, tornillos a 32 mm uno de otro | [39][28] | ✅ |
| Corredera | los barrenos de montaje vienen a 32 mm (Accuride) | [45] | ⚠️ |

**Ajuste para triplay mexicano:** una profundidad de 12–14 mm pensada para aglomerado de 16–19 mm **deja 1–3 mm en triplay de 15 mm y atraviesa el de 12 mm**. Regla propuesta: profundidad ≤ t − 5 mm, es decir 10 mm en 15 mm y 13 mm en 18 mm, con broca de tope ⚠️ (derivado de [28]). La R2 ya exige un lateral de ≥ 15 mm para los soportes, y está bien.

---

## 5. Pegamentos

| Pegamento | Tipo | Tiempo abierto | Prensado | Carga completa | Temperatura mínima | Agua | Fuente |
|---|---|---|---|---|---|---|---|
| **Resistol 850 Profesional** (el de México) | PVA blanco | **15 min** (se puede reacomodar en ese lapso) | **30–40 min**; manipular a las **4 h** | resistencia máxima en **≤ 12 h** (el empaque dice 24 h) | 10 °C (aplicación de 10 a 40 °C) | interiores; no admite pintura encima | [33][34] ✅ |
| Titebond Original (I) | PVA amarillo (alifático) | 4–6 min ⚠️ | 30–60 min en uniones sin esfuerzo; 24 h con esfuerzo | 24 h | ❓ | interiores | [30] |
| Titebond II | PVA, ANSI tipo II | 3–5 min ⚠️ | igual que el Original | 24 h | 12.8 °C (55 °F) ⚠️ | resistente al agua | [30][32] |
| Titebond III | PVA, **ANSI/HPVA tipo I** | **8–10 min** (total de armado 20–25 min) | ≥ 30 min | 24 h | **8.3 °C (47 °F)** | a prueba de agua, no para inmersión | [31][30] ✅ |

Rendimiento del Resistol 850: **≈ 4 m² por litro** en superficie lisa [33] ⚠️. Titebond se consigue en México por importación; no se verificó su disponibilidad en tienda ❓.

**Cuándo pegar y cuándo no (práctica de taller ⚠️, salvo donde hay cita):**

- **Sí:** tarugo, galleta, Domino, canal, rebaje, lengüeta, inglete, trasera en rebaje (le da escuadra al casco, algo que la R5 ya reconoce). También clavo o grapa con trasera.
- **Opcional:** tornillo de bolsillo [2][5] y tornillo a tope. En este caso el pegamento ayuda cara contra cara, pero **al canto el PVA se absorbe** y agarra poco. Si se pega, conviene ponerle una capa previa al canto ⚠️.
- **No:** minifix, confirmat, perno KD, cualquier unión que deba **desarmarse**, repisas móviles, herrajes, y la trasera si se quiere poder quitar.
- No cargar una unión pegada antes de **24 h** [30] ✅.

---

## 6. Herrajes

### 6.1 Bisagra de cazoleta de 35 mm (concealed / European hinge)

**Tipo según cómo queda la puerta ✅ [39][43][69]:**

| Nombre en México | Otros nombres | Puerta | Placa de montaje (Blum) |
|---|---|---|---|
| **Recta** | codo 0, cobertura total | tapa todo el canto del lateral (full overlay) | 0 mm [40] ⚠️ |
| **Codo** | acodada, codo 9, cobertura media | dos puertas comparten un lateral o divisor, y cada una tapa la mitad del canto (half overlay) | 3 mm [40] ⚠️ |
| **Súper codo** | súper acodada, codo 18, cobertura interna | puerta embutida entre los laterales (inset) | según el fabricante |

**Perforación:**

| Parámetro | Valor | Fuente | Confianza |
|---|---|---|---|
| Diámetro de la cazoleta | 35 mm con broca Forstner | [35] | ✅ |
| Profundidad | **13 mm** (11–11.5 mm en bisagras para puerta delgada) | [35][42] | ✅ |
| Distancia al canto de la puerta (boring distance, «tab») | 3–6 mm del borde de la cazoleta al canto; Blum 110° usa 5 mm | [35][41] | ✅ |
| Centro de la cazoleta al canto | ≈ 22 mm (derivado: 17.5 + 3 a 6) | [39] | ⚠️ |
| Centro de la bisagra desde arriba o abajo | 80–100 mm [39]; 51–76 mm (2–3") [35]; 76 mm (3") [41] | varias | ✅ (rango 70–100) |
| **Espesor de puerta** | **mínimo 16 mm, máximo 26 mm** (Blum 110°) | [35] | ✅ |
| Placa base en el lateral | a 37 mm del frente, tornillos a 32 mm | [39] | ✅ |
| Traslape (overlay) | **OL = X + B − H** (dimensión fija de la bisagra + distancia de perforación − alto de la placa) | [36] | ⚠️ |
| Holgura entre puertas | 1.5 mm | [35] | ⚠️ |

Con una cazoleta de 13 mm, una puerta de 18 mm conserva 5 mm de cara y una de 16 mm solo 3 mm. **No hay que perforar menos profundo para salvar una puerta delgada**: la bisagra se arranca con el uso [42] ⚠️. En triplay de 15 mm quedan 2 mm.

**Cantidad por puerta ✅ [39][37][38]:**

| Alto de puerta | Peso | Bisagras |
|---|---|---|
| hasta 900 mm | hasta 6 kg | 2 |
| hasta 1600 mm | hasta 12 kg | 3 |
| hasta 2000 mm | hasta 18 kg | 4 |
| hasta 2400 mm | hasta 22 kg | 5 |

- Blum: 2 bisagras para puertas de **4–6 kg** y 3 para **6–12 kg**. La tabla vale para **puertas de hasta 600 mm de ancho**; hasta 650 mm se agrega una bisagra [37][38] ✅. Un distribuidor británico de Blum usa **3.5 kg por bisagra** como carga de referencia [14] ⚠️.
- Separar las bisagras lo más posible [38] ✅. El peso de la puerta **incluye la jaladera** [37].
- Peso estimado de una puerta de triplay de pino: 0.6 × 0.9 × 0.018 m × ~500 kg/m³ ≈ 4.9 kg. La densidad de ~500 kg/m³ es ❓ y hay que calibrarla con el triplay de Home Depot MX. Una puerta de 600 × 900 × 18 mm **ya queda en el límite de dos bisagras**.

**Fabricantes con presencia en México:** Blum (distribuidores), Häfele México [19], Hettich (distribuidores) ❓, **Hermex/Truper** (bisagras bidimensionales de 95° y 165°, con cobertura total, media e interna) [43] ✅, Ducasse México [47], Jako Herrajes [69]. **Fixser:** no encontré ficha técnica ❓.

### 6.2 Bisagra de piano (continua)

Hojas de 15 a 127 mm de ancho; los barrenos suelen venir a ~50 mm (2"). **En triplay conviene poner los tornillos más juntos** para que no se arranquen [66] ⚠️. Útil en tapas de baúl y escritorios abatibles. Aunque es continua, al canto de 12 mm se le exige lo mismo que a cualquier tornillo al canto.

### 6.3 Correderas

| Tipo | Holgura por lado | Capacidad | Largos | Fuente |
|---|---|---|---|---|
| **Telescópica de bolas, extensión total**, montaje lateral (Accuride 3832) | **12.7 mm, +0.8/−0** | **45.5 kg por par** (probada con correderas de 457 mm, 50 000 ciclos) | 300–700 mm (12–28") | [44][45] ✅ |
| Telescópica Ducasse (México) | **13 mm, +0.5/−0.2** | ❓ | 300–600 mm, alto 45 mm | [46] ✅ |
| Ducasse con cierre suave | ❓ | ❓ (probada con ANSI/BHMA A156.9) | 350, 400, 450 y 500 mm | [47] |
| Handy Home, extensión total (Home Depot MX) | ❓ | **30 kg** | 39.5 cm, $125 MXN | [48] ✅ |
| Handy Home, extensión parcial (Home Depot MX) | ❓ | **20 kg** | 45 cm | [49] ⚠️ |
| **Bajo montaje (undermount)**, Blum TANDEM | ancho interior = **hueco − 42 mm** | **45 kg (100 lb) estática** | 229–533 mm (9–21") | [50] ✅ |

**Reglas de instalación de la corredera lateral (Accuride [44]):**
- Caja del cajón **27 mm más angosta que el hueco** (2 × 12.7 + holgura) ✅ (el derivado coincide con [46]). *Nota de auditoría:* 27 mm es lo que recomienda Accuride, pero queda justo en el límite de +0.8 por lado; con cortes de tienda (±0.5 mm) Knotty debe diseñar con **26 mm** (13 mm por lado), que cae dentro de 12.7–13.5 hacia los dos lados.
- **El ancho del cajón no debe pasar del largo de la corredera** ⚠️.
- **Frente embutido:** la corredera va retrasada lo que mide el frente más **3.2 mm (⅛")** ⚠️.
- Alto mínimo del cajón con la 3832EC: **47.6 mm (1⅞")** ⚠️.
- Tornillos: Euro de 6 mm con cabeza plana o **#8 con cabeza de lenteja (pan head)** [44]. **Ojo:** en un costado de cajón de 12–15 mm, el tornillo **no debe atravesarlo** (ver §8).

**Bajo montaje (Blum TANDEM [50]):** costados del cajón de **13 a 16 mm** (el T18 no sirve). Ancho interior del cajón = hueco − 42 mm. Ancho interior mínimo: 170 mm. Fondo del mueble ≥ largo de la corredera + retranqueo + 6 mm. Requiere una **ranura para el fondo** y muescas atrás. Knotty no lo modela; conviene dejarlo para después.

### 6.4 Otros herrajes

| Herraje | Dato | Fuente | Confianza |
|---|---|---|---|
| **Jaladeras y botones** | entre centros suelen ser múltiplos de 32 mm (96, 128, 160 mm) | práctica | ❓ |
| **Patas niveladoras** | Häfele MX: tornillo de ajuste con rosca M8 o M10 y base de plástico; sistemas de zoclo para cocina (Axilo 78) | [64] | ⚠️ |
| **Pistones** (gas struts) para puertas abatibles | fuerza ≈ **F = G · b / (2 · c)** (G = peso de la puerta en N, b = medio alto de la puerta, c = distancia del anclaje a la bisagra). Regla rápida: 10 N ≈ 1 kg | [59] | ⚠️ |
| **Rodajas** | Ø 50 mm con freno: **30–50 kg por rueda** según modelo | [63] | ⚠️ |
| **Soporte oculto para repisa flotante** (varilla) | varilla de 19 mm (¾") en repisa de 203 mm (8"); de 10–15 kg a 85 kg según modelo y muro | [65] | ⚠️ (muy variable) |
| **Escuadras** | la capacidad depende más del **taquete y el muro** que de la escuadra; no sirven para evitar el descuadre del casco | práctica | ⚠️ |
| **Kit antivuelco** | en EE. UU. es **obligatorio** para cómodas y roperos de **≥ 686 mm (27"), ≥ 13.6 kg (30 lb) y ≥ 90.6 L** (ASTM F2057-23, ley STURDY; el dispositivo cumple ASTM F3096). *Nota de auditoría:* la norma pide además que el mueble no se vuelque con cajones abiertos y llenos, con 27.2 kg (60 lb) en la orilla de un cajón y sobre un calce de 10.9 mm que simula alfombra (verificado en el Federal Register, `05-reglas-estructurales.md` [12]); **el kit es un respaldo, no sustituye el cálculo de estabilidad** | [58] | ✅ |
| Kit antivuelco en México | no encontré una NOM equivalente | — | ❓ |

### 6.5 Tornillería

| Concepto | Dato | Fuente | Confianza |
|---|---|---|---|
| Calibres | #6 = 3.5 mm · #8 = 4.2 mm · #10 = 4.8 mm | [53] | ✅ |
| Largos comerciales en México | 19 (¾"), 25 (1"), 32 (1¼"), 38 (1½"), 41 (1⅝"), 51 (2"), 76 mm (3") | [51] (línea Fiero) | ⚠️ |
| Truper Fiero «pija multiusos» | #8 × 38 mm (1½"), **rosca completa**, cabeza plana Phillips PH2, fosfatado negro, «para madera, aglomerados y tablaroca», bolsa de 100 | [51] | ✅ |
| Pija combinada (cuadro + Phillips) | pensada para muebles de melamina y madera | [52] | ⚠️ |
| **Tornillo para aglomerado** (chipboard screw) | caña delgada, rosca afilada **hasta la cabeza**; sirve en aglomerado, MDF y triplay y abre menos la chapa | [54] | ⚠️ |
| **Tornillo para madera** (wood screw) | caña lisa bajo la cabeza, que deja que **la junta cierre** | [54] | ⚠️ |
| Tornillo de bolsillo | cabeza con arandela, punta autoperforante; rosca gruesa para triplay | [1] | ✅ |
| Cabezas | **plana** (se avellana: casco, cara vista), **lenteja** (pan: correderas, bisagras), **arandela** (bolsillo) | [44][1] | ⚠️ |
| Mandos | Phillips PH2, cuadro #2 (Kreg), Pozi (confirmat), combinada | [51][52][17] | ⚠️ |

**Nota:** «rosca completa» en la pija multiusos significa que **no jala la pieza de arriba** si no se hace barreno de paso [54][53] ⚠️. Knotty debe decir «barreno de paso de 4.4 mm (broca de 11/64", o la de 4.5 mm que se consigue en ferretería) en la pieza de arriba» cuando proponga a tope con tornillo.

---

## 7. Largo de tornillo por combinación de espesores

Criterios:
- **Al canto (a tope):** penetración en el receptor ≥ 25 mm (supuesto de Knotty; ⚠️ práctica). Resultado: largo ≥ ta + 25.
- **Cara contra cara:** que no se asome: largo ≤ ta + tb − 3 (Knotty).
- **Bolsillo:** tabla de Kreg por espesor de la pieza con el bolsillo [1][4] ✅.

Largos disponibles: 25 (1"), 32 (1¼"), 38 (1½"), 44 (1¾") ❓, 51 mm (2").

| Pieza a (atraviesa) → pieza b (recibe) | A tope, al canto de b | Cara contra cara | Bolsillo (en a) | Confirmat |
|---|---|---|---|---|
| 12 → 12 | 38 mm (1½"), #6 ⚠️ | ≤ 21 → **19 mm (¾")** | 25 mm (1") | no (canto de 12) |
| 12 → 15 | 38 mm (1½") | ≤ 24 → 19 mm (¾") | 25 mm (1") | no ⚠️ |
| 12 → 18 | 38 mm (1½") | ≤ 27 → 25 mm (1") | 25 mm (1") | 7 × 50 (queda en 38) ⚠️ |
| 15 → 15 | **44 mm (1¾") o 51 mm (2")** | ≤ 27 → 25 mm (1") | 25 mm (1") [Kreg ⅝"] | 7 × 50 |
| 15 → 18 | 44 o 51 mm | ≤ 30 → 25 mm (1") | 25 mm (1") | 7 × 50 |
| 18 → 15 | 44 o 51 mm | ≤ 30 → 25 mm (1") | **32 mm (1¼")** | 7 × 50 |
| 18 → 18 | 44 o 51 mm | ≤ 33 → **32 mm (1¼")** | 32 mm (1¼") | 7 × 50 |
| Trasera 3 → canto de 12/15/18 | **clavo o grapa de 19–25 mm (¾–1")** + pegamento; nunca tornillo | — | — | — |
| Trasera 6 → canto de 12/15/18 | clavo de 25–32 mm (1–1¼") o tornillo #6 × 25 mm (1") ⚠️ | — | — | — |
| Herraje → pieza de 12 / 15 / 18 (bisagra, corredera, jaladera) | — | tornillo ≤ t − 3: **≤ 9 / 12 / 15 mm** (derivado) | — | — |

Separación y distancias por unión: ver §9.

---

## 8. Comparación con lo que Knotty ya tiene

### 8.1 Lo que está bien ✅

| Dónde | Qué | Respaldo |
|---|---|---|
| R2 bolsillo ≥ 12 en ambas | Kreg lo acepta desde ½" (12.7 mm) | [2] |
| R2 canal ≤ t/3 recomendado, > t/2 crítico | la regla del tercio y el máximo de la mitad; la prueba en ¾" dio ¼" como lo mejor | [20][21] |
| R2 trasera de 3 mm solo con clavo, grapa o rebaje | la práctica común | [60] |
| R2 soporte de repisa en lateral ≥ 15 mm | con 12 mm, un barreno de 12–14 mm lo atraviesa | [28] |
| R3 bolsillo máximo (≤ 16 → 1", ≤ 19 → 1¼") | coincide con la tabla de Kreg | [1][4] |
| R3 distancia al extremo 25 mm | Kreg: ~25 mm (1") del extremo; tres diámetros ≈ 13 mm para #8 | [3][55] |
| R3 «que no se asome» (≤ ta + tb − 3) | criterio de Kreg: evitar que la punta salga | [1] |
| R6 ancho > 600 mm → dividir la puerta | la tabla de Blum supone un ancho de 600 mm | [37][38] |
| `holguraLateral: 12.7` | Accuride 12.7 mm | [44] |
| Correderas de 30–50 cm | Ducasse las vende de 300 a 600 mm | [46] |
| Corredera ≤ fondo − 10 mm (`cajon.ts`) | Accuride: retranqueo = espesor del frente + 3.2 mm; Knotty ya descuenta el frente y deja 10 mm | [44] |
| Triplay de 15 mm como material de casco | en esquinas atornilladas, 15 mm ≈ 18 mm | [10] |

### 8.2 Lo que hay que corregir

| # | Dónde | Hoy | Debería | Por qué | Confianza |
|---|---|---|---|---|---|
| C1 | R9 `toleranciaCorredera: 1` simétrica | acepta hueco de 11.7–13.7 mm | **mínimo = nominal** (12.7), **máximo = nominal + 0.8**; menos del mínimo → crítico «no entra»; más del máximo → recomendación «flojo». Y `cajon.ts` debe construir la caja con **nominal + 0.3** por lado (13.0 con 12.7), no con el nominal exacto | Accuride +0.8/−0 [44]; Ducasse +0.5/−0.2 [46] | ✅ |
| C2 | R2 `bisagra-cazoleta: { a: 15 }` | 15 mm pasa | **< 16 mm → recomendación** («cazoleta de 13 mm deja 2 mm; usa puerta de 18 mm o bisagra para puerta delgada»); < 14 → crítico; 18 mm ideal | Blum: puerta mínima de 16 mm [35]; [42] | ✅ |
| C3 | R6 `puertas.bisagras` | ≤ 900 → 2, ≤ 1500 → 3, más → 4 | ≤ 900 → 2; ≤ 1600 → 3; ≤ 2000 → 4; más → 5; **y además por peso**: > 6 kg → mínimo 3, > 12 kg → 4, > 18 → 5; ancho 601–650 mm → +1 | [39][37][38] | ✅ |
| C4 | `joints.ts` → `hinge()` siempre usa `bisagra-cazoleta-35-recta` | recta aunque la puerta vaya embutida o comparta lateral | elegir por geometría: tapa todo el canto → recta; comparte lateral con otra puerta → codo; entre laterales → súper codo | [39][43] | ✅ |
| C5 | R2 `tarugo: { a: 15, b: 15 }` sin diámetro | tarugo de 8 mm en 15 mm | 15 mm → **tarugo de 6 mm** (8 mm es el 53 % del espesor); 18 mm → 8 mm; en la cara, profundidad ≤ ⅔ t | regla del ⅓ [27]; mejor resultado con 8 mm en 19 mm [11] | ⚠️ |
| C6 | R2 `canal` y `rebaje` usan el mismo umbral | rebaje ≤ t/3 | **rebaje: recomendado ≤ ½ t, crítico > ⅔ t**; el canal se queda como está | el rebaje solo debilita un lado, y en la práctica se hace de ½ a ⅔ [22] | ⚠️ |
| C7 | R2 `minifix: 15/15` | 15 mm pasa | **≥ 16 mm** con caja de 15 (12 mm de profundidad); en 15 mm → recomendación (o minifix 12) | [18] | ⚠️ |
| C8 | R3 separación 150–250 mm (docs) | hasta 250 mm | tornillo a tope **≤ 200 mm**; bolsillo 150–200 [3]; confirmat ≤ 128 [15]; tarugo 100–150 [27]; y **el primero a no más de ~50 mm del extremo** (Kreg lo pone a 25 mm [3]; confirmat ≤ 36 mm [15]) | [3][15][27] | ⚠️ |
| C9 | `screwFor` en `joints.ts` | usa `tornillo-8x*` también cuando a es de 12 mm y b de 12 mm | con **receptor de 12 mm usar #6** (3.5 mm): el #8 (4.2 mm) deja ~3.9 mm de pared por lado | [53] (diámetros); criterio de taller | ⚠️ |
| C10 | Cajón: corredera sin revisar capacidad ni ancho | — | revisar **ancho del cajón ≤ largo de la corredera** [44] y la **capacidad en kg** según la carga | [44][48] | ⚠️ |

### 8.3 Lo que falta

**En el catálogo (`catalogo.json`):**
- `tornillo-bolsillo-1`: 25 mm (1") de rosca gruesa, para 12–16 mm [1]. **Es el más urgente**: hoy la R3 lo sugiere y el catálogo no lo tiene.
- `tornillo-6x3/4`, `tornillo-6x1` y `tornillo-8x5/8`, para herrajes y cara contra cara en 12 mm.
- Tornillo de 44 mm (1¾"), si existe en Home Depot MX ❓. Si no, 51 mm (2").
- `tarugo-6x30` y `tarugo-8x30`; `confirmat-7x50` con su tapón; perno y tarugo para el minifix; `clavo-18ga-3/4` (19 mm) y `grapa-1/4`.
- En las correderas: **`capacidadKg`**, **`extension: 'total' | 'parcial'`**, **`holgura: { nominal, menos, mas }`** y los largos de 25, 55 y 60 cm.
- En las bisagras: **`espesorPuerta: { min, max }`**, **`profundidadCazoleta`**, **`tipo: 'recta' | 'codo' | 'súper codo'`** (id `crank: 'straight' | 'crank' | 'superCrank'`, §10.2) como dato (hoy solo está en el id), `pesoMaxPorBisagraKg`, `aperturaGrados`.
- Bisagra de piano, pistón, rodaja, soporte oculto, perno KD (tuerca de barril), inserto roscado.

**En los tipos de unión (`TipoUnion`):** `confirmat`, `galleta`, `grapa-pegamento` (o que `clavo-pegamento` acepte grapa), `bisagra-piano`, `inglete` (con o sin tira) y `perno-kd`. Domino, cola de milano y lengüeta pueden quedar fuera del generador. Knotty no debería proponerlas por defecto a un usuario DIY de Home Depot MX ⚠️.

**En las reglas:**
- Largo de tornillo de herraje: **un herraje no debe atravesar la pieza** (≤ t − 3).
- Perforación del sistema 32 en triplay: **profundidad ≤ t − 5**.
- Antivuelco: la R4 existe, pero puede citar ASTM F2057 como referencia: **alto ≥ 686 mm con cajones → recomendar kit** [58].
- Fondo de cajón **en canal** en vez de clavado abajo, cuando el cajón lleva carga ⚠️.

---

## 9. Tabla maestra por unión

Distancias en mm. «Al extremo» es la distancia del primer herraje al final de la junta. «Separación» es entre centros. Cantidad = `max(2, ceil((largo − 2·extremo) / separación) + 1)`.

| Unión | Espesor mínimo (a / b) | Al extremo | Separación | Al borde de la cara | Profundidad | Largo o medida | Fuente | Confianza |
|---|---|---|---|---|---|---|---|---|
| Tornillo a tope (canto de b) | a ≥ 12 / b ≥ 15 (12 con #6) | 25–50 | 150–200 | centrado en el canto de b | piloto 2.8–3.2 mm | ta + 25 | [53][55][3] | ⚠️ |
| Tornillo cara contra cara | 12 / 12 | 25 | 150–200 | ≥ 13 (3 d) | — | ≤ ta + tb − 3 | [55] | ⚠️ |
| Bolsillo | 12 / 12 | ~25 | 150–200 | — | lo pone la plantilla | 12–16 → 25; 19 → 32 | [1][3][4] | ✅ |
| Tarugo Ø 6 | 12 / 12 | 30–50 ❓ | 100–150 | centrado | cara ≤ ⅔ t | 6 × 30 | [27] | ⚠️ |
| Tarugo Ø 8 | 18 / 18 | 30–50 ❓ | 100–150 | centrado | cara ≤ ⅔ t; canto 20–25 | 8 × 30–40 | [11][27] | ⚠️ |
| Galleta #10/#20 | 15 / 15 (#0 en 12) | ~50 ❓ | 150–200 ❓ | centrada | la pone la máquina | #0 / #10 / #20 | [23][24] | ⚠️ |
| Confirmat 7 × 50 | 16 / 16 | ≤ 36 | ≤ 128 | centrado en el canto | piloto de 5 mm, 22–25 mm en el canto | 7 × 50 | [15][16][17] | ⚠️ |
| Minifix 15 | 16 / 16 | ~60 (lo mejor en la prueba) | 32 × n | caja a 24 o 34 del canto | caja de 12 (16 mm) o 14 (19 mm) | perno según tablero | [18][71] | ⚠️ |
| Ranura (canal; *dado*) | receptor 15 | — | — | — | ≤ ⅓ t (crítico > ½ t) | — | [20][21] | ✅ |
| Rebaje | receptor 12 | — | — | — | ≤ ½ t (crítico > ⅔ t) | — | [22] | ⚠️ |
| Clavo o grapa + pegamento (trasera) | trasera 3–6 / canto ≥ 12 | 25 ❓ | 150–200 | centrado en el canto | — | 19–25 (3 mm); 25–32 (6 mm) | [60] | ⚠️ |
| Soporte de repisa de 5 mm | lateral 15 | 37 del frente y de atrás | 32 | — | ≤ t − 5 | espiga de 5 mm | [28] | ✅/⚠️ |
| Bisagra de cazoleta | puerta 16 (ideal 18) | 70–100 del canto de la puerta | — | canto a cazoleta 3–6 | 13 | 35 mm | [35][39][41] | ✅ |
| Corredera lateral | costado ≥ 12 | — | — | holgura 12.7 +0.8/−0 | — | 300–600 | [44][46] | ✅ |
| Corredera bajo montaje | costado 13–16 | — | — | ancho interior = hueco − 42 | — | 229–533 | [50] | ✅ |

---

## 10. Para Knotty: qué se puede volver regla o dato

### 10.1 Reglas concretas

| Código propuesto | Condición | Severidad | Mensaje (para la persona) | Base |
|---|---|---|---|---|
| `R2_ESPESOR_UNION` (ajuste) | bisagra de cazoleta con puerta < 16 mm | recomendación (< 14 crítico) | «La cazoleta de 13 mm deja solo {t−13} mm en {puerta}. Usa triplay de 18 mm o una bisagra para puerta delgada.» | [35][42] |
| `R2_ESPESOR_UNION` (ajuste) | tarugo de 8 mm con pieza < 18 mm | recomendación | «En {t} mm el tarugo de 8 mm debilita el canto; usa tarugo de 6 mm.» | [27] |
| `R2_ESPESOR_UNION` (ajuste) | rebaje > ½ t / > ⅔ t | recomendación / crítico | (el texto actual, con el umbral nuevo) | [22] |
| `R2_ESPESOR_UNION` (ajuste) | minifix con pieza < 16 mm | recomendación | «El minifix de 15 mm pide tablero de 16 mm o más.» | [18] |
| `R3_TORNILLOS` (ajuste) | receptor al canto de 12 mm con tornillo #8 | recomendación | «Al canto de 12 mm el #8 puede abrir las chapas; usa #6 o tornillo de bolsillo.» | [53] |
| `R3_TORNILLOS` (ajuste) | separación > 200 mm o primer tornillo a > 50 mm del extremo | detalle | «Pon un tornillo a 25–50 mm de cada extremo y los demás cada 150–200 mm.» | [3] |
| `R9_CAJONES` (corrección) | hueco < nominal | crítico | «La corredera pide {n} mm y solo hay {h}: el cajón no entra.» | [44][46] |
| `R9_CAJONES` (corrección) | hueco > nominal + 0.8 | recomendación | «Sobran {h−n} mm: la corredera queda floja y se puede zafar.» | [44] |
| `R9_CAJONES` (nueva) | ancho del cajón > largo de la corredera | recomendación | «El cajón es más ancho que largo: con correderas laterales se atora al jalarlo de una esquina.» | [44] |
| `R12_SLIDE_CAPACITY` (nueva; código de `05-reglas-estructurales.md` §9) | carga estimada > `capacidadKg` de la corredera | recomendación | «Esta corredera aguanta {kg} kg por par; para {uso} busca una de 45 kg.» | [44][48] |
| `R6_PUERTAS` (ajuste) | bisagras < las de la tabla por alto **o** por peso | recomendación | «{puerta} pesa ≈ {kg} kg y mide {alto} mm: lleva {n} bisagras.» | [39][37] |
| `R23_HARDWARE_SCREW` (nueva) | tornillo de herraje > t − 3 | crítico | «Los tornillos de {herraje} miden {l} mm y {pieza} solo {t}: se asoman del otro lado.» | derivado |
| `R24_SHELF_PIN_DEPTH` (nueva) | lateral < 15 con soporte, o profundidad > t − 5 | crítico / detalle | «Barrena a {t−5} mm con tope: más hondo atraviesas el lateral.» | [28] |
| `R10_USO` (umbral 686) y `R11_TIP_OPEN` (nueva, `05` §6.3) | alto ≥ 686 mm, con cajones o puertas, sin anclaje | recomendación; crítico si el cálculo de `R11_TIP_OPEN` dice que se voltea | «Con los cajones abiertos esta cómoda se puede ir de frente; ánclala al muro.» | [58] |
| `hingeTypeFor` (inferencia en `joints.ts`, no es regla ni lleva código R) | puerta tapa el canto / comparte lateral / va entre laterales | — | recta / codo / súper codo | [39] |

> **Nota de auditoría (numeración):** `R10` ya existe (`R10_USO`) y `05-reglas-estructurales.md` usa R11–R22; por eso las reglas nuevas de este documento se renumeraron a R23 y R24. Ver la tabla única en `10-auditoria.md` §4.

### 10.2 Bosquejo de tipos (Zod)

```ts
import { z } from 'zod'

// Joint catalog as data: thresholds live here, rules read them. Person-facing text in Spanish.

// Audit note: ids unified with 06, 07 and 09 (camelCase). See docs/investigacion/10-auditoria.md §3.
export const JointKind = z.enum([
  'buttScrew', 'pocketScrew', 'dowel', 'biscuit', 'confirmat', 'camLock', 'dado', 'groove', 'rabbet',
  'nailGlue', 'stapleGlue', 'angleBracket', 'splineMiter', 'knockDownBolt',
  'shelfPin', 'cupHinge', 'pianoHinge', 'drawerSlide', // drawerSlide carries mount: 'side' | 'undermount'
])

export const ToolId = z.enum([
  'drill', 'impactDriver', 'countersink', 'hammer', 'pocketJig', 'dowelJig', 'biscuitJoiner', 'router', 'tableSaw',
  'circularSaw', 'jigsaw', 'confirmatBit', 'forstner15', 'forstner35', 'nailGun', 'stapler', 'shelfPinJig', 'clamps',
  'square', 'tape', 'sander', 'studFinder',
])

const MinMax = z.object({ min: z.number().nonnegative(), max: z.number().positive() }) // MmRange (07) when there is a typical value
const Confidence = z.enum(['verified', 'singleSource', 'toValidate']) // ✅ ⚠️ ❓

export const JointSpec = z.object({
  kind: JointKind,
  label: z.string(),                       // «Tornillo de bolsillo»
  minThickness: z.object({ host: z.number().int(), guest: z.number().int() }), // mm; host receives
  warnBelow: z.number().int().nullable(),  // between warnBelow and minThickness → recomendación
  endDistance: MinMax.nullable(),          // first fastener from the joint end, mm
  spacing: MinMax.nullable(),               // center to center, mm
  depthRatio: z.object({ recommended: z.number(), critical: z.number() }).nullable(), // of host thickness
  maxBoreDepth: z.object({ offset: z.number() }).nullable(), // depth ≤ t − offset
  removable: z.boolean(),
  visible: z.enum(['hidden', 'edge', 'face']),
  glue: z.enum(['required', 'optional', 'never']),
  tools: z.array(ToolId),
  skill: z.enum(['basic', 'intermediate', 'advanced']),
  relativeStrength: z.enum(['low', 'medium', 'high']),
  confidence: Confidence,
  sources: z.array(z.number().int()),      // [n] in docs/investigacion/02-uniones-y-herrajes.md
})
export type JointSpec = z.infer<typeof JointSpec>

export const JOINTS: Partial<Record<z.infer<typeof JointKind>, JointSpec>> = {
  pocketScrew: {
    kind: 'pocketScrew', label: 'Tornillo de bolsillo',
    minThickness: { host: 12, guest: 12 }, warnBelow: null,
    endDistance: { min: 20, max: 50 }, spacing: { min: 150, max: 200 },
    depthRatio: null, maxBoreDepth: null, removable: true, visible: 'hidden', glue: 'optional',
    tools: ['drill', 'pocketJig', 'clamps'], skill: 'basic', relativeStrength: 'medium',
    confidence: 'verified', sources: [1, 2, 3],
  },
  dowel: {
    kind: 'dowel', label: 'Tarugo',
    minThickness: { host: 15, guest: 15 }, warnBelow: 18, // 8 mm below 18 → suggest 6 mm
    endDistance: { min: 30, max: 50 }, spacing: { min: 100, max: 150 },
    depthRatio: { recommended: 2 / 3, critical: 3 / 4 }, maxBoreDepth: null,
    removable: false, visible: 'hidden', glue: 'required',
    tools: ['drill', 'dowelJig', 'clamps'], skill: 'intermediate', relativeStrength: 'high',
    confidence: 'singleSource', sources: [11, 27],
  },
  rabbet: {
    kind: 'rabbet', label: 'Rebaje',
    minThickness: { host: 12, guest: 3 }, warnBelow: null, endDistance: null, spacing: null,
    depthRatio: { recommended: 1 / 2, critical: 2 / 3 }, maxBoreDepth: null,
    removable: false, visible: 'edge', glue: 'required',
    tools: ['router', 'tableSaw'], skill: 'intermediate', relativeStrength: 'medium',
    confidence: 'singleSource', sources: [22],
  },
  // …the rest, from the table in §9
}

// Hardware: discriminated union, so each kind carries only what matters.
const ScrewSpec = z.object({
  kind: z.literal('screw'),
  gauge: z.enum(['#6', '#8', '#10']), diameter: z.number(),  // 3.5 / 4.2 / 4.8 mm
  length: z.number(), lengthLabel: z.string(),               // 31.75, «1¼"»
  thread: z.enum(['coarse', 'fine', 'full', 'partial']),
  head: z.enum(['flat', 'pan', 'washer']),
  use: z.enum(['wood', 'chipboard', 'pocket', 'confirmat']),
  pilot: z.number().nullable(),                              // mm; null if self-tapping
})

const SlideSpec = z.object({
  kind: z.literal('slide'),
  mount: z.enum(['side', 'undermount']),
  extension: z.enum(['full', 'partial']),
  length: z.number(),                                        // mm
  sideClearance: z.object({ nominal: z.number(), minus: z.number(), plus: z.number() }), // 12.7, 0, 0.8
  loadKg: z.number().nullable(),                             // per pair
  maxDrawerSide: z.number().nullable(),                      // undermount: 16
  minDrawerHeight: z.number().nullable(),
})

const HingeSpec = z.object({
  kind: z.literal('hinge'),
  cup: z.object({ diameter: z.literal(35), depth: z.number() }), // 13
  crank: z.enum(['straight', 'crank', 'superCrank']),         // recta / codo / súper codo
  overlay: z.enum(['full', 'half', 'inset']),
  doorThickness: MinMax,                                      // 16–26
  boringDistance: MinMax,                                      // 3–6
  openingDeg: z.number(),
  maxKgPerHinge: z.number().nullable(),
})

export const HardwareSpec = z.discriminatedUnion('kind', [ScrewSpec, SlideSpec, HingeSpec /* , … */])

// Hinges per door by height and weight; the larger of the two wins.
export const HINGES_PER_DOOR = [
  { maxHeight: 900, maxKg: 6, count: 2 },
  { maxHeight: 1600, maxKg: 12, count: 3 },
  { maxHeight: 2000, maxKg: 18, count: 4 },
  { maxHeight: 2400, maxKg: 22, count: 5 },
] as const // [39][37]; +1 when the door is 601–650 mm wide [37]
```

`JOINTS` es parcial mientras se llenan todas las uniones. Lo importante es que **los umbrales de §9 pasen de `supuestos.ts` a este catálogo** con su fuente y su confianza, para que la R2 y la R3 lean `minThickness`, `depthRatio` y `spacing` en vez de tener números sueltos.

---

## 11. Preguntas frecuentes

1. **¿Puedo atornillar al canto de un triplay de 12 mm?** Sí, con tornillo #6, piloto y sin carga fuerte. El #8 deja muy poca pared y tiende a abrir las chapas [53] ⚠️. Si la unión carga (repisa con libros), mejor bolsillo, ranura o un tablero de 15 mm.
2. **¿Tornillo de bolsillo o tarugo?** En la prueba de Woodgears, el tarugo con pegamento aguantó ~1.5 veces más [5]. En la de Fine Woodworking, el bolsillo quedó arriba del Domino y de la galleta [6] ⚠️. Para DIY, el bolsillo es más fácil y perdona errores [3]. El tarugo pide precisión.
3. **¿Le pongo pegamento al tornillo de bolsillo?** Es opcional [2]; en la prueba casi no cambió el resultado [5] ✅. Sí conviene en ingletes [2].
4. **¿Qué tan honda hago la ranura para una repisa de 18 mm?** 6 mm (⅓). Nunca más de 9 mm (½) [20][21] ✅.
5. **¿Qué bisagra compro: recta, codo o súper codo?** Recta si la puerta tapa todo el lateral; codo si dos puertas comparten un lateral; súper codo si la puerta va metida entre los laterales [39][43] ✅.
6. **¿Mi puerta de triplay de 15 mm sirve para bisagra de cazoleta?** Queda justa: Blum pide 16 mm y la cazoleta mide 13 mm de hondo [35]. Mejor 18 mm, o busca una bisagra para puerta delgada [42] ⚠️.
7. **¿Cuántas bisagras lleva mi puerta?** Hasta 90 cm y 6 kg, 2. Hasta 160 cm y 12 kg, 3. Hasta 200 cm y 18 kg, 4 [39] ✅. Si pasa de 60 cm de ancho, una más [37].
8. **¿Cuánto espacio dejo para la corredera?** 12.7 mm por lado (13 mm en Ducasse). Haz la caja del cajón 26 mm más angosta que el hueco (13 mm por lado): así un error de corte de medio milímetro no la deja fuera de tolerancia. Nunca menos de lo que pide el fabricante: Accuride no admite nada por debajo de 12.7 mm, y Ducasse solo 0.2 mm por debajo de 13 mm [44][46] ✅.
9. **¿Cuánto aguanta una corredera?** Depende del modelo: 20–30 kg las económicas de Home Depot MX [48][49] y 45 kg las de uso ligero de marca [44] ✅. Para herramienta o archivos, busca 45 kg o más.
10. **¿Resistol 850 o Titebond?** Para muebles de interior, el Resistol 850 cumple: prensado de 30–40 min y resistencia máxima en ≤ 12 h [33]. El Titebond III sirve si el mueble va a un baño o al exterior (tipo I) [31] ✅. En ambos casos, no cargar antes de 24 h [30].
11. **¿Confirmat o minifix para un mueble que voy a mudar?** El minifix se arma y desarma más veces. El confirmat es más fuerte [13], pero cada vez que se quita se barre un poco el canto. En triplay de pino, el confirmat puede rajar [16] ⚠️.
12. **¿Necesito kit antivuelco?** Si el mueble mide más de ~69 cm, tiene cajones y hay niñas o niños en casa, sí. En EE. UU. es obligatorio desde 2023 [58] ✅. En México no encontré norma ❓, pero la física es la misma.

---

## 12. Dudas abiertas

- ❓ Densidad real del triplay de pino de Home Depot MX (para calcular el peso de la puerta y las bisagras). Se supuso ~500 kg/m³.
- ❓ Espesor real de las hojas «15 mm» y «18 mm» de pino en México. Kreg insiste en medir el espesor real [1].
- ❓ Si hay tornillo de 44 mm (1¾") en tiendas mexicanas; si no, Knotty debe saltar de 38 a 51 mm.
- ❓ Fichas técnicas de Fixser y Hermex (capacidad de correderas, espesor de puerta de sus bisagras).
- ❓ Si existe en México una norma de estabilidad de muebles equivalente a ASTM F2057.
- ❓ Tamaño del confirmat 7 × 50 según el espesor: las fuentes se contradicen [16][17].
- ❓ Rosca de tornillo de bolsillo en MDF: la guía de Kreg y sus preguntas frecuentes se contradicen [1][2]. No afecta al triplay.
- ⚠️ Casi todas las pruebas de resistencia son en madera maciza, MDF o aglomerado; la única en triplay de esquina es [10], y la de tarugos en triplay es [11]. Una prueba casera con triplay de Home Depot MX calibraría la escala.

---

## Fuentes

1. Kreg Tool — «Kreg Screw Guide: pocket-hole screw size chart». https://learn.kregtool.com/learn/how-to-select-right-pocket-hole-screw/
2. Kreg Tool — «Answers to common pocket-hole questions». https://learn.kregtool.com/learn/answers-to-pocket-hole-questions/
3. Kreg Tool — «Quick tips for the best pocket-hole spacing». https://learn.kregtool.com/learn/tips-for-pocket-hole-spacing/
4. Home Repair Geek — «Kreg jig screw chart». https://homerepairgeek.com/tips/kreg-jig-screw-chart/
5. Matthias Wandel, Woodgears — «Testing pocket holes against mortise and tenon and dowel joints». https://woodgears.ca/joint_strength/pockethole.html
6. Fine Woodworking — «Joint Strength Test» (núm. 203, 2009). https://www.finewoodworking.com/2009/02/25/joint-strength-test
7. Dowelmax — «Wood joint strength tests» y Wikipedia «Dowelmax» (resumen de las pruebas de Fine Woodworking y Wood Magazine). https://www.dowelmax.com/wood-joint-strength-tests/ · https://en.wikipedia.org/wiki/Dowelmax
8. USDA Forest Products Laboratory — «Screw-holding, internal bond, and related properties of composite…» (1989). https://www.fpl.fs.usda.gov/documnts/pdf1989/mcnat89c.pdf
9. «Holding strength of screws in plywood and oriented strandboard» (ResearchGate). https://www.researchgate.net/publication/281477485_Holding_strength_of_screws_in_plywood_and_oriented_strandboard
10. BioResources — «Effect of the panel type and panel thickness on moment resistance of screw-jointed corner joints and stiffness of four-member cabinets». https://bioresources.cnr.ncsu.edu/resources/effect-of-the-panel-type-and-panel-thickness-on-moment-resistance-of-screw-jointed-corner-joints-and-stiffness-of-four-member-cabinets/
11. Journal of Forestry Research — «Bending moment resistance of dowel corner joints in case-type furniture under diagonal compression load». https://link.springer.com/article/10.1007/s11676-014-0481-y
12. Derikvand y Eckelman, BioResources 10(3) — «Bending moment capacity of L-shaped mitered frame joints constructed of MDF and particleboard». https://bioresources.cnr.ncsu.edu/wp-content/uploads/2016/06/BioRes_10_3_5677_Derikvand_Eckelman_7551_Bending_Moment_Capacity_LShaped_Mitered.pdf
13. «Mechanical properties of confirmat screws corner joints made of native wood and wood-based composites» (ResearchGate). https://www.researchgate.net/publication/338837819_Mechanical_properties_of_confirmat_screws_corner_joints_made_of_native_wood_and_wood-based_composites
14. SWS Hardware — «How many Blum hinges will I need per door?». https://swshardware.com/help-and-advice/how-many-blum-hinges-per-door
15. WOODWEB — «Confirmat screw spacing». https://woodweb.com/knowledge_base/Confirmat_screw_spacing.html
16. WOODWEB — «Confirmat screw assembly». https://woodweb.com/knowledge_base/Confirmat_screw_assembly.html
17. FASTO — «What size confirmat screws do you use?». https://www.fastoscrews.com/news/what-size-confirmat-screws-do-you-use/
18. Furnica — «Minifix connectors explained: the cam lock system». https://furnica.co.uk/blogs/guides/minifix-connectors-cam-lock-system-explained
19. Häfele México — «Herrajes de unión». https://www.hafele.com.mx/es/products/herrajes-de-mueble-y-soluciones-para-la-vivienda/herrajes-de-uni-n-y-soportes-para-estantes/herrajes-de-uni-n/50/
20. Highland Woodworking — «The ideal dado depth?». https://woodworkingtooltips.com/2013/10/the-down-to-earth-woodworking-the-ideal-dado-depth/
21. Engineer Fix — «How deep should a dado be in 3/4 plywood?». https://engineerfix.com/how-deep-should-a-dado-be-in-3-4-plywood/
22. Woodworking Talk — «Standard rabbet depth» y WOODWEB «What thickness of material for cabinet backs?». https://www.woodworkingtalk.com/threads/standard-rabbet-depth.10237/ · https://woodweb.com/knowledge_base/What_Thickness_of_Material_for_Cabinet_Backs.html
23. Wikipedia — «Biscuit joiner». https://en.wikipedia.org/wiki/Biscuit_joiner
24. WoodWorkers Guild of America — «What size joiner biscuit to use?». https://www.wwgoa.com/post/joiner-biscuit-sizes
25. Festool Owners Group — «Festool DF 500 Domino and minimal plywood thickness» y DIY Troop «Festool Domino tenon sizing». https://festoolownersgroup.com/threads/festool-df-500-domino-and-minimal-plywood-thickness.50917/ · https://diytroop.com/festool-domino-tenon-sizing/
26. Festool — «DOMINO beech range DS 4/5/6/8/10». https://www.festool.com/accessory/joining/accessories-for-joining/dominos/576794---ds-456810-1060-bu
27. Woody Calc — «Dowel joint sizing calculator». https://woodycalc.com/dowel-joint-sizing-calculator/
28. Wikipedia — «32 mm cabinetmaking system». https://en.wikipedia.org/wiki/32_mm_cabinetmaking_system
29. Fine Woodworking — «Throw away your tape measure: go 32mm system». https://www.finewoodworking.com/2016/02/06/throw-away-your-tape-measure-go-32mm-system
30. Titebond — «FAQs». https://www.titebond.com/resources/use/all/faqs
31. Titebond — «Titebond III Ultimate Wood Glue». https://www.titebond.com/product/glues/e8d40b45-0ab3-49f7-8a9c-b53970f736af
32. Woodworker's Hardware — «Understanding the strengths of Titebond II». https://www.wwhardware.com/blog/understanding-the-strengths-of-titebond-ii-franklin-internationals-water-resistant-glue/
33. Henkel / Resistol — «Ficha técnica Resistol 850 Profesional» (2018). https://cdn.homedepot.com.mx/productos/896112/896112-m.pdf
34. The Home Depot México — «Resistol 850 pegamento profesional para madera 1 kg». https://www.homedepot.com.mx/p/resistol-resistol-850-pegamento-profesional-para-madera-blanco-1-kg-577971-899147
35. Rockler — «Blum 110° BLUMotion full overlay frameless hinge instructions». https://www.onepointesolutions.com/wp-content/uploads/2021/03/110%C2%B0-FULL-OVERLAY-SELF-CLOSING-BLUM-HINGES-w-BLUMOTION.pdf
36. Blum — «Concealed hinges: premium hinge systems for cabinet doors». https://cabinotch.us/media/wysiwyg/FAQ/BlumHingeSpecifications.pdf
37. Blum — «CLIP top BLUMOTION: number of hinges» (EASY ASSEMBLY). https://ea.blum.com/en/number-of-hinges/
38. Blum — «Catalogue and technical manual» (2022, p. 706). https://publications.blum.com/2022/catalogue/en/706/
39. Maderame — «Bisagras de cazoleta: tipos, medidas, colocación y regulación». https://maderame.com/bisagras-cazoleta-tipos-medidas-colocacion-regulacion/
40. Woodworking Talk — «How to determine mounting plate type for Blum hinges». https://www.woodworkingtalk.com/threads/how-to-determine-mounting-plate-type-for-blum-hinges.46134/
41. Eagle Woodworking — «Hinge boring options». https://www.eaglewoodworking.com/cabinet-doors/product-guide/hinge-boring-options
42. Super Arbor — «Cabinet hinges: overlay, cup size and compatibility». https://superarbor.io/blogs/blogs/cabinet-hinges-overlay-soft-close-35mm-cup-compatibility
43. Truper / Hermex — «Bisagras bidimensionales para gabinetes» y Amazon México «Hermex BIDI-95M». https://www.truper.com/cerrajeria/bisagras/bisagras-bidimensionales-para-gabinetes/hermex · https://www.amazon.com.mx/BIDI-95M-bisagras-bidimensionales-gabinetes-cobertura/dp/B013V0HOMM
44. Accuride — «3832EC quick reference and installation». https://www.accuride.com/media/amasty/amfile/attach/lsENsMwHMdlHk0OlD2EpkPTjq1u8ZoYw.pdf
45. Accuride — «3832E Classic full-extension slide». https://www.accuride.com/en-us/products/drawer-slides/3832e-light-duty-full-extension-slide-with-lever-disconnect
46. Ducasse Industrial — «Corredera telescópica, ficha v01_1021». https://ducasseindustrial.com/wp-content/uploads/2022/05/Ficha_Original_Corredera_Telescopica_v01_1021.pdf
47. Ducasse Industrial México — «Corredera telescópica cierre suave». https://www.ducasseindustrial.com/wp-content/uploads/sites/21/wpallimport/files/MX_4010031100_FICHA.pdf
48. The Home Depot México — «Handy Home correderas de extensión total 39.5 cm». https://www.homedepot.com.mx/p/handy-home-correderas-de-extension-total-niquel-395-x-45-cm-plata-1743-246143
49. The Home Depot México — «Handy Home correderas de extensión 3.5 × 45 cm». https://www.homedepot.com.mx/p/handy-home-correderas-de-extension-niquel-35-x-45-cm-1761-106919
50. Blum — «TANDEM plus BLUMOTION» (folleto). https://woodworkinstitute.com/wp-content/uploads/2024/07/Blum-Tandem-plus-Blumotion-Brochure.pdf
51. Truper — «100 pijas 8 × 1-1/2" cabeza plana Phillips multiusos» (Fiero, código 40069). https://www.truper.com/ficha_merca/ficha-print.php?code=40069
52. Truper — «Pijas planas combinadas (cuadro + Phillips)». https://www.truper.com/ficha_tecnica/Pijas-planas-combinadas-cuadro--phillips.html
53. Fine Power Tools — «What size drill bit for #8 & #10 screw» y The Plan Stack «Pilot hole chart». https://www.finepowertools.com/woodworking/what-size-drill-bit-for-screw/ · https://theplanstack.com/fasteners/pilot-hole-chart/
54. BS Fixings — «Wood screws vs chipboard screws: what's the difference?». https://bsfixings.uk/news/wood-screws-vs-chipboard-screws-whats-the-difference/
55. Woodworking Advisor — «How to screw wood without splitting it». https://woodworkingadvisor.com/how-to-not-split-wood-when-screwing/
56. Woodsmith — «Our favorite knock-down fasteners». https://www.woodsmith.com/article/our-favorite-knock-down-fasteners/
57. Wikipedia — «Barrel nut». https://en.wikipedia.org/wiki/Barrel_nut
58. CPSC — «Clothing Storage Units FAQ» y UL Solutions «CPSC adopts ASTM F2057-23». https://www.cpsc.gov/FAQ/Clothing-Storage-Units · https://www.ul.com/news/cpsc-adopts-astm-f2057-23-prevent-furniture-tip-overs
59. SGS Engineering — «How to calculate the force required for a gas strut». https://www.sgs-engineering.com/help-advice/how-to-calculate-the-force-required-for-a-gas-strut
60. Ply Supply — «What size brad nails to use for 1/4" plywood?» y WOODWEB «Pin nailers versus 18-gauge». https://ply-supply.com/plywood-faq/what-size-brad-nails-to-use-for-1-4-plywood/ · https://woodweb.com/knowledge_base/Pin_Nailers_Versus.html
61. WOODWEB — «Chip-free dovetailing in plywood» y Fine Woodworking foro «Dovetails in Baltic birch ply». https://woodweb.com/knowledge_base/Chipfree_dovetailing_in_plywood.html · https://www.finewoodworking.com/forum/dovetails-in-baltic-birch-ply
62. Woodcraft — «Spline joint & miter spline joint guide». https://www.woodcraft.com/blogs/shop-knowledge-guides/splined-miters
63. Leroy Merlin — «Rueda giratoria con freno, ø 50 mm, 30 kg». https://www.leroymerlin.es/productos/1-rueda-giratoria-con-freno-con-placa-50-mm-peso-max-30-kg-13606474.html
64. Häfele México — «Tornillo de ajuste, rosca M8 o M10». https://www.hafele.com.mx/es/product/tornillo-de-ajuste-rosca-m8-o-m10-r-gida-con-placa-base-de-pl-stico/P-00869951/
65. Herrajes Bralle (México) — «Soporte para repisa oculto» y Wovar «Soportes invisibles». https://www.herrajesbralle.com.mx/SOPORTE-PARA-REPISA-OCULTO.php · https://www.wovar.es/soportes-invisibles/
66. Essentra Components — «A guide to piano hinges». https://www.essentracomponents.com/en-us/news/solutions/access-hardware/a-guide-to-piano-hinges
67. Canadian Woodworking — «Rabbets, dados and grooves». https://canadianwoodworking.com/techniques_and_tips/rabbets-dados-and-grooves/
68. Wood Research 65(6) 2020 — «Bending moment resistances of L-shaped furniture frame joints». https://www.woodresearch.sk/wr/202006/11.pdf
69. Jako Herrajes (México) — «Bisagras bidimensionales, cazoleta 35 mm». https://jako.mx/shop/category/herrajes-muebles-herrajes-para-muebles-bisagras-bidimensionales-diametro-de-la-cazoleta-diametro-de-la-cazoleta-35-mm-208
70. The Home Depot México — «Correderas». https://www.homedepot.com.mx/b/ferreteria/herrajes/corredoras
71. «The end distance effect of knock-down furniture fasteners on bending moment resistance of corner joints» (Academia). https://www.academia.edu/119111037/The_end_distance_effect_of_knock_down_furniture_fasteners_on_bending_moment_resistance_of_corner_joints
