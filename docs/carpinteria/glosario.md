# 06 — Glosario de carpintería de muebles de triplay

Vocabulario de oficio para Knotty: qué nombre dar a cada pieza, unión, herramienta y operación, con los sinónimos que la persona puede escribir (México primero; España, Argentina y Colombia para reconocer lo que llegue de tutoriales en internet) y el término en inglés. Sirve para tres cosas: (1) que la interfaz use **una sola palabra por concepto**, (2) que el experto (LLM) entienda los sinónimos sin inventar piezas y (3) alimentar la capa de vocabulario que propone `07-arquitectura-del-conocimiento.md` §3.4 (`Term.label`, `aliases`, `legacyIds`).

> Base: `docs/PROPUESTA.md` §3 (modelo `Pieza.rol` y `Union.tipo`), `src/domain/diseno/esquema.ts:30-72`, `src/domain/modules/cabinet.ts`, `src/domain/operaciones/cajon.ts`, `src/ui/estudio/Paneles.tsx:10-22`, `src/domain/estructura/reglas/uniones.ts:7-18`, `src/ui/estudio/Revision.tsx`, `src/ui/estudio/PlanSheet.tsx` y los prompts de `src/adapters/llm/prompts/` (rama `investigacion-triplay`, 2026-09-25).
>
> Unidades: todo en milímetros. Lo que en México se vende en pulgadas se escribe **primero en mm y luego con su designación comercial**: «tornillo de 32 mm (1¼")».
>
> Confianza: ✅ dos fuentes o más · ⚠️ una fuente o práctica de taller · ❓ por validar con carpinteros o personas usuarias en México.

---

## Resumen

1. **El canon es el español de México**; los sinónimos regionales solo sirven para *reconocer* lo que escribe la persona, nunca para mostrarlos. Hay falsos amigos peligrosos: «tarugo» es taquete de pared en Argentina [7]; «pija» es tornillo en México y una grosería en Argentina [44]; «fondo» es la profundidad del mueble para Knotty, pero el **piso** del módulo en Chile [10] y la trasera en algunos textos de España.
2. Knotty tiene hoy **siete ambigüedades de vocabulario** que afectan a la persona: *repisa / entrepaño* para la misma pieza; *techo / cubierta* bajo un mismo rol; *base* con tres sentidos; *hoja* como puerta y como tablero; *escuadra* como herraje, herramienta y ángulo; *canal / ranura* para la misma unión; y *tornillo al canto / tornillo de tope* para la misma unión (§9, §10).
3. Hay **tres errores de modelo** que el vocabulario deja ver: el contrafrente y la trasera del cajón llevan el rol `costado-cajon` (`cajon.ts:75-76`); la tapa de un hueco cerrado lleva el rol `otro` (`cabinet.ts:156`); y `faja` no es una palabra que un principiante reconozca: en la regla de escuadrado significa «travesaño trasero de arriba» (`escuadrado.ts:37`).
4. Propuesta de canon para la persona: **Lateral, Piso, Techo / Cubierta, Repisa (fija o móvil), Divisor, Trasera, Zoclo, Travesaño, Puerta, Tapa fija, Frente del cajón, Costado / Contrafrente / Trasera / Fondo del cajón**. Uniones: **A tope con tornillo, Tornillo de bolsillo, Tarugos, Minifix, Ranura, Rebaje, Escuadra metálica, Clavo y pegamento, Soportes de repisa, Bisagras de cazoleta, Correderas**.
5. Discrepancia con `07-arquitectura-del-conocimiento.md` §3.4: ahí el ejemplo usaba `label: "Entrepaño"` (*nota de auditoría: ya se corrigió a «Repisa» en 07; el vocabulario canónico completo está en `10-auditoria.md` §3*). Recomiendo **«Repisa»** como etiqueta y «entrepaño» como alias, porque la interfaz, las sugerencias del chat y el prompt de reconstrucción ya le hablan a la persona de «repisas» (`Chat.tsx:21`, `reconstruccion.v6.md:45`), y porque en la ebanistería tradicional «entrepaño» también es el tablero que va dentro del bastidor de una puerta [1].

---

## Cómo leer las tablas

- **Canónico (Knotty)**: la palabra que debe aparecer en la interfaz, en los textos del experto y en la ficha de la pieza. Una sola por concepto.
- **México**: otras palabras que se oyen en México (van a `aliases`).
- **España / Argentina / Colombia**: para reconocer la palabra si la persona la trae de un video o tutorial. Cuando la tabla no lo indica, la fuente es la del renglón.
- **Inglés**: el término de oficio (sirve para buscar tutoriales y para nombrar el id en código según D33).
- **Confusión**: el error común.

---

## 1. Partes del mueble

### 1.1 El cuerpo (casco)

| Canónico (Knotty) | Definición corta | México | España | Argentina | Colombia | Inglés | Confusión común | Conf. |
|---|---|---|---|---|---|---|---|---|
| **Cuerpo** | La caja estructural del mueble sin puertas ni cajones: laterales, piso, techo y trasera. | casco, caja, módulo, gabinete | casco, armazón, módulo [11] | cuerpo, módulo | cuerpo, módulo | carcass / case / cabinet box | «Módulo» también se usa para una unidad de cocina completa; Knotty lo usa para el constructor de gabinete. | ⚠️ [11] |
| **Lateral** | Tablero vertical que cierra el cuerpo por la izquierda o la derecha. | costado | costado, lateral [11] | lateral, costado | costado, lateral | side / end panel / gable | En el cajón, la misma pieza se llama «costado»; conviene conservar la diferencia (ver 1.5). | ✅ [10][11] |
| **Piso** | Tablero horizontal de abajo, entre los laterales; sostiene el contenido. | base, fondo (del mueble) | base, suelo | piso, base | piso, base | bottom | «Fondo» en Chile es esta pieza [10]; en Knotty «fondo» es la profundidad. «Piso» también es el suelo de la casa: si hay duda, di «el piso del mueble». | ⚠️ [10] |
| **Techo** | Tablero horizontal de arriba **entre** los laterales; no se ve desde arriba si el mueble es alto. | tapa | techo [10], sombrero | techo | techo | top (between sides) | Se confunde con «cubierta»: el techo va entre laterales; la cubierta va encima y los tapa. | ⚠️ [10] |
| **Cubierta** | Tablero de arriba **encima** de los laterales, visible, a veces con vuelo (sobresale). Típica de burós, cómodas y escritorios. | tapa, cubierta | tapa, encimera (en cocina) [12] | tapa, mesada (en cocina) | cubierta, mesón (en cocina) | top (overlay) / worktop / countertop | En México «cubierta» también es la superficie de trabajo de una cocina (granito, postformado) [27]: fuera del contexto de cocina no hay problema. | ⚠️ [10][27] |
| **Repisa** | Tablero horizontal dentro del cuerpo para apoyar cosas; **fija** (atornillada) o **móvil** (sobre soportes). | entrepaño, anaquel, charola (en cocina) | balda, estante, anaquel [1][2] | estante | entrepaño, repisa | shelf (fixed / adjustable) | En España y en ebanistería tradicional «entrepaño» es además el tablero de una puerta de bastidor [1]. «Repisa» sola también es la tabla colgada en la pared [1]. | ✅ [1][2] |
| **Divisor** | Tablero vertical dentro del cuerpo que parte el espacio en columnas. | división, montante, entrepaño vertical | división, tablero divisorio [11], montante | divisor, separador | división | divider / partition / (mid) upright | «Montante» en carpintería de puertas y ventanas es otra cosa (larguero del bastidor, travesaño de ventana) [1]. | ⚠️ [11] |
| **Trasera** | Tablero delgado (3–6 mm) que cierra la parte de atrás; si se fija en todo el perímetro, escuadra y rigidiza el cuerpo. | fondo, respaldo, espalda | trasera [11], fondo | fondo, trasera | espaldar, fondo | back (panel) | «Fondo» se confunde con la profundidad y con el fondo del cajón. «Respaldo» es de sillas. | ✅ [10][11] |
| **Zoclo** | Tira al frente y abajo que levanta el cuerpo del suelo, protege de golpes y humedad y oculta patas. A menudo va remetido [10]. | zócalo, rodapié | zócalo [12] | zócalo | zócalo | toe kick / plinth / base | En México «zoclo» es *también* la moldura de la pared a ras del suelo [3]; en el mueble conviene decir «zoclo del mueble» la primera vez. | ✅ [3][10][12] |
| **Travesaño** | Tira horizontal angosta que une los laterales (arriba al frente, arriba atrás o abajo) en lugar de un techo o piso completo. | faja, amarre, barrote, riel | travesaño, traviesa, larguero | travesaño | travesaño | stretcher / rail | «Faja» casi no la reconoce un principiante (❓). En Chile se llama «barra de armar» [10]. «Larguero» en una puerta es la pieza vertical del bastidor [1]. | ⚠️ [1][10] |
| **Faldón** | Tablero vertical bajo la cubierta que une las patas (mesas, escritorios, bancos) y rigidiza. | faldón, delantal | faldón [1], cinturón | faja, zócalo (de mesa) | faldón | apron / skirt | Se confunde con zoclo: el faldón va arriba (bajo la cubierta), el zoclo abajo. | ⚠️ [1] |
| **Copete** | Remate decorativo sobre la parte superior del mueble. | remate, corona | copete [1], cornisa | copete | copete | crown / pediment | «Cornisa» es un remate con molduras que sobresale [1]; en triplay casi siempre es una tira recta. | ⚠️ [1] |
| **Pata** | Apoyo vertical que levanta el mueble; puede ser de madera, metálica o **niveladora** (roscada). | pata, pata niveladora | pata, pie | pata, regatón (la punta) | pata | leg / leveling foot | Las patas de cocina se ocultan detrás del zoclo [12]. | ✅ [10][12] |
| **Cartela** | Triángulo o escuadra de madera que refuerza la unión entre dos piezas en ángulo (una repisa volada, una esquina). | escuadra de madera, refuerzo, mensulita | cartela [1], escuadra | cartela | escuadra | gusset / corner block / bracket | En arquitectura «cartela» es una ménsula [1]; para la persona basta «refuerzo en esquina». | ⚠️ [1] |
| **Bastidor frontal** | Marco de tiras al frente del cuerpo (americano) donde se montan puertas y cajones. El mueble europeo no lo lleva («sin marco»). | marco frontal, bastidor | bastidor | bastidor, marco | marco | face frame (vs frameless) | En el sistema sin marco las puertas se atornillan directo a los laterales con bisagra de cazoleta [17]. Knotty hoy es 100 % sin marco. | ⚠️ [17] |

### 1.2 Puertas y frentes

| Canónico (Knotty) | Definición corta | México | España | Argentina | Colombia | Inglés | Confusión | Conf. |
|---|---|---|---|---|---|---|---|---|
| **Puerta** | Tablero que abre con bisagras. En triplay es un tablero liso; en bastidor, un marco con tablero. | hoja, abatible | puerta, hoja | puerta, hoja | puerta, hoja | door / leaf | «Hoja» también es el tablero de 1220 × 2440 mm; Knotty usa «hojas» para las dos cosas (`PlanSheet.tsx:111`, `Materiales.tsx:88`). | ⚠️ [22] |
| **Frente del cajón** | Tablero visible del cajón; lleva la jaladera. Si se atornilla sobre la caja del cajón es un **frente falso** [9]. | frente, frente falso, doble frente | frente, frente postizo | frente, frente falso | frente | drawer front / false front | «Contrafrente» es la pieza de la caja detrás del frente (ver 1.5). | ✅ [9][13] |
| **Tapa fija** | Tablero fijo que cierra un hueco sin abrir. | tapa, frente fijo, falso frente | tapa, frente fijo | tapa | tapa | fixed panel / false front | Knotty la guarda con rol `otro` (`cabinet.ts:156`). | ❓ |
| **Larguero / peinazo** | En una puerta de bastidor, largueros son las piezas verticales y peinazos (o travesaños) las horizontales. | larguero, travesaño | larguero, peinazo [1] | larguero, travesaño | larguero, travesaño | stile / rail | Solo aplica a puertas de bastidor; Knotty hace puertas lisas de un tablero. | ⚠️ [1] |

### 1.3 Superficies de una pieza

| Canónico (Knotty) | Definición corta | Inglés | Confusión | Conf. |
|---|---|---|---|---|
| **Cara** | Cada una de las dos superficies grandes de un tablero. La **cara buena** (grado B en triplay BC) va hacia afuera. | face | La cara de mejor grado es la que se ve; en triplay BC la B es la buena [22]. | ⚠️ [22] |
| **Canto** | Borde angosto de un tablero; en triplay deja ver las capas. | edge | En España «cantear» es enderezar un canto [1]; en México «cantear» se oye como poner cubrecanto (❓). | ✅ [1][25] |
| **Testa** | Sección transversal a la fibra, el «extremo» de una tabla maciza. En triplay casi no aplica porque las capas se cruzan. | end grain | Los tornillos agarran poco en testa de madera maciza; en triplay el canto tiene capas a testa y a hilo alternadas. | ⚠️ [1] |
| **Arista** | Línea donde se juntan cara y canto. Se «matan» (redondean o biselan) con lija. | arris / edge | — | ⚠️ |

### 1.4 Medidas del mueble

| Canónico | Definición | Confusión | Conf. |
|---|---|---|---|
| **Ancho** | Medida de izquierda a derecha, vista de frente. | — | ✅ (`Captura.tsx:23`) |
| **Alto** | Del suelo a lo más alto. | — | ✅ |
| **Fondo** | De adelante hacia atrás (profundidad). | Choca con «fondo del cajón» y con el «fondo» = piso de Chile [10]. En la interfaz, siempre «fondo» para la medida y «fondo del cajón» completo para la pieza. | ⚠️ [10] |
| **Espesor** | Grosor de un tablero. | En México también «grueso» o «calibre». El real suele ser menor que el nominal (triplay de 18 mm mide 17–18 mm; `dictamen.v1.md:13`, [21]). | ✅ [21] |

### 1.5 El cajón

| Canónico (Knotty) | Definición | México | España | Argentina / Chile / Perú | Inglés | Conf. |
|---|---|---|---|---|---|---|
| **Cajón** | Caja que se desliza sobre correderas. | cajón, gaveta | cajón | cajón | drawer | ✅ |
| **Costado del cajón** | Cada tablero lateral de la caja; ahí se atornilla la corredera. | costado, lateral | lateral | costado [13] | drawer side | ✅ [9][13] |
| **Contrafrente** | Tablero de la caja que queda detrás del frente visible; el frente falso se atornilla desde adentro a él [9]. | contrafrente | frente interior | contrafrente (en Perú los dos tableros transversales de la caja se llaman así) [13] | sub-front / drawer box front | ⚠️ [9][13] |
| **Trasera del cajón** | Tablero transversal del fondo de la caja. | trasera, contrafrente trasero | trasera | trasera, parte posterior [9] | drawer back | ✅ [9][13] |
| **Fondo del cajón** | Tablero delgado (3–6 mm) que hace de piso; va atornillado abajo o metido en ranura [9][13]. | fondo | fondo | fondo | drawer bottom | ✅ [9][13] |

### 1.6 Herrajes visibles

| Canónico | Definición | México | España | Argentina | Colombia | Inglés | Confusión | Conf. |
|---|---|---|---|---|---|---|---|---|
| **Jaladera** | Pieza para jalar una puerta o cajón. | jaladera [4], manija, agarradera | tirador [1][12] | manija | manija | pull / handle / knob | «Tirador» en México suena a otra cosa; «perilla» es la redonda de un solo tornillo. | ✅ [1][4] |
| **Gola** | Perfil metálico corrido que sustituye a la jaladera (muebles «sin jaladera»). | uñero, perfil gola | gola [12] | perfil de aluminio | perfil | handleless profile / J-pull | — | ⚠️ [12] |

---

## 2. Material

| Canónico (Knotty) | Definición | México | España | Argentina | Colombia | Inglés | Confusión | Conf. |
|---|---|---|---|---|---|---|---|---|
| **Triplay** | Tablero de chapas delgadas de madera pegadas con la fibra cruzada. Hoja estándar 1220 × 2440 mm [5][6]. | triplay, plywood, contrachapado | contrachapado [6] | terciado, multilaminado, fenólico (el de cimbra) [5][6] | tríplex; quintuplex si tiene 5 capas o más [5] | plywood | «Triplay» no quiere decir 3 capas: el de 18 mm tiene más. «Fenólico» es triplay con resina para cimbra, no para muebles. | ✅ [5][6] |
| **Triplay de pino BC** | El de las tiendas de autoservicio: chapas de pino, cara B lijada y cara C con defectos [22]. | triplay de pino de primera / segunda | — | — | — | pine plywood, BC grade | El grado lo da la peor cara visible, no la resistencia. | ⚠️ [22] |
| **MDF** | Tablero de fibra de densidad media, liso, sin veta; se pinta bien, pesa más y aguanta poco la humedad. | MDF, fibracel (marca) | DM, MDF | MDF, fibrofácil | MDF | MDF | «Fibracel» es una marca; no todos los MDF son iguales. | ⚠️ |
| **Aglomerado** | Tablero de partículas pegadas. Con recubrimiento decorativo es la «melamina». | aglomerado, MDP | aglomerado | aglomerado | aglomerado | particleboard | Agarra mal los tornillos en canto. | ⚠️ |
| **Melamina** | Aglomerado o MDF con película decorativa de melamina. | melamina | melamina, tablero melaminado | melamina | melamina, tablero melamínico | melamine board | En México «melamina» es el tablero, no la resina. | ⚠️ [25][46] |
| **Veta** | Dirección de la fibra de la chapa de la cara. En triplay, la de las caras suele ir a lo largo de la hoja (2440 mm). | veta, hilo | veta, fibra [1] | veta | veta, hilo | grain | La veta de la cara decide la estética y un poco la rigidez; Knotty la guarda como `largo | ancho | libre`. | ✅ [1] |
| **Hilo / contrahilo** | Trabajar *a hilo* es a favor de la fibra; *a contrahilo*, en contra: astilla la cara y el corte sale peor. | hilo, contrahilo | a favor de la veta, a contrapelo | a favor de la veta | a favor del hilo | with the grain / against the grain | En triplay el corte a través de la veta de la cara astilla más: se pone cinta o se corta con la cara buena abajo con sierra circular. | ❓ |
| **Cubrecanto** | Tira delgada que tapa el canto del tablero. En triplay, de chapa de madera; en melamina, de PVC o melamina. | cubrecanto [48], chapacinta, tapacanto | canto, cubrecantos | tapacanto | canto, tapacanto | edge banding | Se vende por metro lineal y en anchos (19 mm para tableros de 18 mm). | ✅ [48][25] |

---

## 3. Cortes y operaciones

| Canónico (Knotty) | Definición | Otros nombres | Inglés | Confusión | Conf. |
|---|---|---|---|---|---|
| **Dimensionar** | Cortar un tablero en piezas a medida final. Servicio de madererías y tiendas [25]. | dimensionado, cortar a medida, despiezar | cut to size | «Tablero dimensionado» también es un producto ya cortado de tienda [46]. | ✅ [25][46] |
| **Refilar** | Quitar el canto de fábrica (golpeado, no escuadrado) de la hoja antes de dimensionar. Knotty descuenta 15 mm por lado (`catalogo.json`, `acomodo.refilado`). | refilado, emparejar | trim / edge trim | La hoja «útil» es menor que la nominal. | ⚠️ |
| **Corte (ancho de)** | Lo que se come la sierra en cada corte: 3–4 mm. Knotty usa 4 mm (`acomodo.sierra`). | trazo, «lo que se come la sierra» | kerf | Si no se descuenta, la última pieza de la tira sale corta. | ⚠️ [29] |
| **Escuadrar** | Dejar dos superficies o cantos a 90°; también, comprobarlo con la escuadra [1] o por diagonales iguales [34]. | escuadrar, poner a escuadra | square (up) | En el armado, «escuadrar el cuerpo» es igualar diagonales antes de que seque el pegamento. | ✅ [1][34] |
| **Cantear** | En España, enderezar el canto de una tabla [1]. En México se usa para *enchapar* el canto (❓). Knotty debería decir **«poner cubrecanto»**. | enchapar cantos, canteado | edge jointing / edge banding | Ambigüedad regional. | ⚠️ [1][25] |
| **Rebajar (hacer un rebaje)** | Quitar material en la orilla de una pieza, a lo largo del canto, formando un escalón. | rebaje, galce | rabbet (rebate) | «Rebajar» en México también se oye como adelgazar una pieza. | ✅ [1] |
| **Ranurar (hacer una ranura)** | Abrir un canal angosto en la cara para meter otra pieza (trasera, fondo del cajón, repisa fija). | canal, caja, cajuela (❓) | groove (a lo largo), dado (a través de la veta) | Knotty llama a esta unión «canal» y en el prompt «ranura» (`sistema.v4.md:54`). | ✅ [1][25] |
| **Avellanar** | Abrir un cono en la entrada de un agujero para que la cabeza del tornillo quede a ras [1]. | avellanado | countersink | Sin avellanar, la cabeza plana levanta la chapa. | ✅ [1][9] |
| **Taladro guía** | Agujero previo, más delgado que el tornillo, para que el canto no se abra. | pre-taladrar, barreno guía | pilot hole | Sin él, el tornillo en el canto del triplay separa las capas (⚠️). | ⚠️ [9] |
| **Presentar** | Armar en seco, sin pegamento, para revisar que todo encaja [9]. | armar en seco | dry fit | — | ⚠️ [9] |
| **Encolar** | Pegar con cola blanca y apretar con prensas. | pegar | glue up | — | ⚠️ |

---

## 4. Herramientas

Los ids en inglés coinciden con `ToolId` de `07-arquitectura-del-conocimiento.md` §3.6. *Nota de auditoría:* la lista única de `ToolId` (unión de 02, 06, 07 y 09) está en `10-auditoria.md` §3.

| Canónico (Knotty) | Id | Definición / uso | México | España | Argentina | Inglés | Confusión | Conf. |
|---|---|---|---|---|---|---|---|---|
| **Taladro** | `drill` | Perforar y, con punta, atornillar. | taladro, taladro atornillador, rotomartillo (con percusión) | taladro | agujereadora, taladro | drill / drill-driver | «Rotomartillo» es el de percusión para concreto; no hace falta para madera. | ⚠️ [18] |
| **Atornillador de impacto** | `impactDriver` | Atornilla con golpes rotativos; mete tornillos largos sin esfuerzo. | atornillador de impacto, impacto | atornillador de impacto | atornillador de impacto | impact driver | Aprieta de más: en triplay de 12 mm hunde la cabeza o rompe el canto. | ❓ |
| **Sierra circular** | `circularSaw` | Sierra portátil de disco para cortes rectos largos con guía. | sierra circular | sierra circular | sierra circular | circular saw | Necesita regla guía y apoyo a ambos lados del corte [31]. | ✅ [31] |
| **Sierra de mesa** | `tableSaw` | Sierra fija con disco que sale de la mesa; cortes muy precisos. | sierra de banco, sierra de mesa | sierra de mesa, escuadradora (la de carro) | sierra de mesa, sierra circular de banco | table saw | La **escuadradora** (con carro) y la **seccionadora** son máquinas de taller o maderería [30]. | ⚠️ [30] |
| **Caladora** | `jigsaw` | Sierra de hoja recta que sube y baja; curvas y recortes. | caladora, sierra caladora [18] | sierra de calar | caladora | jigsaw | No sirve para cortes rectos largos precisos. | ✅ [18] |
| **Router** | `router` | Motor con fresa para ranuras, rebajes y cantos redondeados. | router, rebajadora, fresadora [18] | fresadora, tupí (la de mesa) [49] | fresadora, router | router | «Fresadora» en metal es otra máquina; «tupí» es la de mesa. | ✅ [18][49] |
| **Plantilla de bolsillo** | `pocketJig` | Guía para perforar agujeros inclinados para tornillo de bolsillo. | plantilla Kreg, Kreg | plantilla Kreg | plantilla Kreg | pocket-hole jig | «Kreg» es una marca que se usa como genérico. | ⚠️ [19] |
| **Plantilla para tarugos** | `dowelJig` | Guía para perforar alineado en las dos piezas. | tarugadora | plantilla para espigas | plantilla para tarugos | dowel jig | — | ❓ |
| **Broca Forstner 35 mm** | `forstner35` | Broca de fondo plano para la cazoleta de la bisagra [14]. | broca de cazoleta, broca Forstner | broca Forstner, broca de cazoleta | mecha Forstner | Forstner bit | En Argentina «mecha» = broca. | ✅ [14][15] |
| **Prensas** | `clamps` | Aprietan piezas mientras seca el pegamento. | prensas, sargentos, prensas rápidas, prensas de esquina [9] | sargentos, gatos [1] | sargentos, prensas | clamps (bar, F, corner) | En el glosario español, «sargento» es la grande de dos brazos y «prensa en G» la chica [1]. | ✅ [1][9] |
| **Escuadra** | `square` | Regla en L para trazar y comprobar 90°. | escuadra de carpintero, escuadra combinada | escuadra | escuadra | try square / combination square | La misma palabra nombra el herraje metálico en L (ver §6). | ✅ [1][9] |
| **Falsa escuadra** | `bevelGauge` | Escuadra de brazo móvil para copiar ángulos. | falsa escuadra, escuadra falsa | falsa escuadra, falsarregla | falsa escuadra | sliding bevel | — | ⚠️ [1] |
| **Flexómetro** | `tape` | Cinta métrica de acero retráctil. | flexómetro, metro, cinta | cinta métrica, metro, flexómetro | cinta métrica, centímetro | tape measure | — | ⚠️ [9] |
| **Lijadora orbital** | `sander` | Lijado de caras antes de acabar. | lijadora orbital, roto-orbital | lijadora | lijadora | random orbital sander | — | ❓ |
| **Detector de montantes** | `studFinder` | Encuentra postes detrás de la tablaroca para anclar [42][43]. | detector de postes | detector de montantes | detector de vigas | stud finder | En México la tablaroca suele ir sobre postes metálicos, no de madera (❓). | ⚠️ [42] |

---

## 5. Uniones

| Canónico (Knotty) | `Union.tipo` hoy | Id sugerido (D33, `07-…` §3.6) | Definición | Otros nombres (MX / ES / AR) | Inglés | Conf. |
|---|---|---|---|---|---|---|
| **A tope con tornillo** | `tope-tornillo` | `buttScrew` | El tornillo atraviesa la cara de una pieza y entra por el canto de la otra; con pegamento. | tornillo al canto, atornillado a tope / unión a tope / unión a tope | butt joint (screwed) | ⚠️ [1] |
| **Tornillo de bolsillo** | `bolsillo` | `pocketScrew` | Tornillo en un agujero inclinado hecho con plantilla; no se ve por fuera. | unión Kreg / tornillo oculto / unión Kreg | pocket-hole joint | ✅ [19][20] |
| **Tarugos** | `tarugo` | `dowel` | Cilindros de madera pegados en agujeros alineados de las dos piezas. | tarugo, espiga / espiga, clavija / espiga, tarugo de madera | dowel joint | ⚠️ [1][7] |
| **Minifix** | `minifix` | `camLock` | Herraje de excéntrica y perno; une y se desarma. | minifix / excéntrica, minifix / minifix | cam lock / cam and dowel | ⚠️ |
| **Ranura** | `canal` | `groove` (a lo largo) / `dado` (a través) | Una pieza entra en un canal abierto en la otra. | canal, caja / ranura, cajeado / ranura, canaleta | groove, dado, housing | ✅ [1] |
| **Rebaje** | `rebaje` | `rabbet` | Escalón en la orilla donde asienta otra pieza (típico de traseras). | galce / rebaje, galce / rebaje | rabbet | ✅ [1] |
| **Escuadra metálica** | `escuadra` | `angleBracket` | Placa en L atornillada a las dos piezas por dentro. | escuadra, ángulo / escuadra / escuadra | angle bracket / L-bracket | ⚠️ |
| **Clavo y pegamento** | `clavo-pegamento` | `nailGlue` | Clavos sin cabeza más cola blanca; típico de la trasera. | clavo y pegamento / puntas y cola / clavos y cola vinílica | glue and brad nails | ⚠️ |
| **Soportes de repisa** | `soporte-repisa` | `shelfPin` | Pernitos en agujeros de 5 mm sobre los que apoya la repisa móvil [15][16]. | soportes, pijas de repisa / soportes de balda / soportes de estante | shelf pins | ✅ [15][16] |
| **Bisagras de cazoleta** | `bisagra-cazoleta` | `cupHinge` | Bisagra oculta con cazoleta de 35 mm; se ajusta en tres direcciones [14]. | bisagra de cazoleta, bisagra de 35, bisagra europea / bisagra de cazoleta / bisagra cazoleta | concealed (cup / Euro) hinge | ✅ [14][15] |
| **Correderas** | `corredera` | `drawerSlide` | Rieles metálicos para cajón; las de balines piden 12.7 mm por lado, con +0.8/−0 de tolerancia (Knotty diseña con 13 mm, caja 26 mm más angosta que el hueco; `02-uniones-y-herrajes.md` §6.3). *Nota de auditoría: antes decía 12.5–13 mm; 12.5 queda por debajo del mínimo de Accuride.* | correderas, rieles / guías / guías telescópicas | drawer slides | ✅ [9][16] |

---

## 6. Herrajes y consumibles

| Canónico (Knotty) | Definición | México | España | Argentina | Colombia | Inglés | Confusión | Conf. |
|---|---|---|---|---|---|---|---|---|
| **Tornillo para madera** | Tornillo de punta para madera. El catálogo usa #8 (≈ 4.2 mm) en 25, 32, 38 y 51 mm (1", 1¼", 1½", 2"). | pija | tirafondo, tornillo para madera | tornillo para madera, autorroscante | tornillo para madera | wood screw | **«Pija» es la palabra de México** [44] pero una grosería en Argentina y España [44]; la interfaz dice «tornillo» y el reconocedor acepta «pija». | ✅ [44] |
| **Tornillo de bolsillo** | Tornillo de cabeza plana ancha y rosca gruesa para triplay y maderas blandas [19]. En triplay de 18 mm, 32 mm (1¼"); en 15–16 mm, 25 mm (1"); en 12 mm, 19–25 mm (¾"–1") [20]. | tornillo Kreg | tornillo de bolsillo | tornillo Kreg | tornillo de bolsillo | pocket screw (coarse thread) | Rosca fina es para maderas duras [19]. Se mide el **espesor real**, no el nominal [20][21]. | ✅ [19][20] |
| **Taquete** | Pieza que se mete en un agujero del muro para que el tornillo agarre. | taquete [7] | taco [7] | tarugo [7] | chazo [7] | wall plug / anchor | **Falso amigo**: «tarugo» en Argentina es taquete; en México es el cilindro de madera de una unión. | ✅ [7][47] |
| **Taquete mariposa** | Taquete de tablaroca que abre alas detrás de la placa. | mariposa, taquete de expansión para tablaroca (el **Molly** o taquete metálico de expansión es otro: se abre como paraguas y no lleva alas de resorte) | taco basculante | tarugo mariposa | chazo mariposa | toggle / hollow-wall anchor | No aguanta bien el jalón perpendicular de un antivuelco [42]. | ✅ [40][42] |
| **Pegamento blanco** | Cola de acetato de polivinilo (PVA) para madera. | pegamento blanco, Resistol 850 (marca) [36] | cola blanca [8] | cola vinílica | colbón (marca como genérico) [8] | wood glue / PVA | No es resistente al agua [36]. | ✅ [8][36] |
| **Clavo sin cabeza** | Clavo delgado de cabeza mínima, para traseras y molduras. | clavo sin cabeza, clavo de acabado | punta, puntilla | clavo sin cabeza | puntilla | brad / finish nail | — | ⚠️ |
| **Soporte de repisa** | Perno o escuadrita que entra en un agujero de 5 mm [15]. | soporte, pija de repisa | soporte de balda | soporte | soporte | shelf pin / support | — | ✅ [15][16] |
| **Bisagra recta / codo / súper codo** | Tipos de bisagra de cazoleta según cuánto tapa la puerta: recta tapa todo el canto; codo, la mitad (dos puertas en un lateral); súper codo, la puerta va embutida [14]. | recta, codo, súper codo, supercodo | recta, semicodo (acodada), supercodo | recta, semicurva, curva | recta, semiparche, interna | full overlay / half overlay / inset hinge | ParaCarpinteros las llama recta, semicurva y curva [14]; el catálogo de Knotty usa recta, codo y súper codo. | ✅ [14] |
| **Corredera telescópica** | Corredera de tres tramos que saca todo el cajón; se vende por par y por largo en cm. | corredera, riel telescópico | guía telescópica | guía telescópica | riel | full-extension slide | El largo comercial en cm debe caber en el fondo interior. | ✅ [9] |
| **Kit antivuelco** | Cinta o cable con dos placas que ata el mueble al muro. | antivuelco, anclaje a muro | kit antivuelco | anclaje antivuelco | anclaje | anti-tip kit / tip restraint | Debe resistir 222 N (50 lb) de jalón según ASTM F3096; el taquete del muro no tiene exigencia [42]. | ✅ [42][43] |

---

## 7. Acabados

Esta sección es breve a propósito; el detalle está en el documento de acabados hermano.

| Canónico (Knotty) | Definición | México | España | Argentina | Inglés | Conf. |
|---|---|---|---|---|---|---|
| **Lijar** | Alisar con papel de lija en granos cada vez más finos (80 → 120 → 180) [9]. | lijar | lijar | lijar | sand | ⚠️ [9] |
| **Sellador** | Primera mano que tapa el poro y deja lista la superficie para la laca o el barniz. | sellador | tapaporos [1], selladora | sellador | sealer / sanding sealer | ⚠️ [1] |
| **Barniz** | Película transparente protectora (poliuretano, marino). | barniz | barniz | barniz, laca | varnish / polyurethane | ❓ |
| **Laca** | Acabado de secado rápido, transparente o de color. | laca (nitrocelulosa, poliuretano) | laca | laca, hidrolaca | lacquer | ❓ |
| **Tinta** | Colorante que tiñe la madera sin cubrir la veta. | tinta, entintado | tinte | tinte, nogalina | stain | ❓ |
| **Resanar** | Tapar golpes, grietas o cabezas de tornillo con pasta. | resanar, pasta para madera | emplastecer, masilla | enmasillar | fill / wood filler | ❓ |

---

## 8. Términos de diseño

| Canónico (Knotty) | Definición | Otros nombres | Inglés | Confusión | Conf. |
|---|---|---|---|---|---|
| **Sobrepuesta** | Puerta o frente que tapa el canto del cuerpo; se usa con bisagra recta (o codo si comparte lateral) [14]. | sobrepuesta, de solape, de aplicar | overlay (full / half) | La interfaz dice «Sobrepuestas» (`PlanSheet.tsx:15`); el prompt dice «overlay». Bien, siempre que la persona solo vea «sobrepuesta». | ✅ [14][17] |
| **Embutida** | Puerta o frente que va dentro del hueco, a ras del canto; bisagra súper codo y más precisión [14]. | embutida, interior, encastrada | inset | — | ✅ [14] |
| **Sistema 32** | Agujeros de 5 mm cada 32 mm a 37 mm del canto delantero para soportes, bisagras y correderas [15][16]. | línea 32, perforación en línea | 32 mm system | Si Knotty pone repisas móviles, conviene que las alturas caigan en múltiplos de 32 mm. | ✅ [15][16] |
| **Holgura** | Espacio que se deja a propósito para que algo se mueva o entre: por lado de corredera (12.7–13.5 mm; Knotty diseña con 13) [9][`02` §6.3]; arriba del cajón para meterlo (16–20 mm con algunas correderas) [9]; por pieza en el corte (Knotty: 2 mm). | juego, tolerancia | clearance | «Tolerancia» es cuánto puede variar una medida, no un espacio. | ✅ [9] |
| **Luz** | Espacio visible entre dos puertas o entre puerta y cuerpo (≈ 2–3 mm). | luz, junta, separación | reveal / gap | «Luz» también es el claro libre de una repisa entre apoyos (el `L` de `PROPUESTA.md` §5). Para la persona: «separación» entre puertas, «claro» en repisas. | ❓ |
| **Vuelo** | Lo que una cubierta sobresale del cuerpo. | vuelo, volado, saliente | overhang | En la lectura de fotos se modela como `topOverhangs` (`reading.ts:30`). | ⚠️ [10] |
| **Claro** | Distancia libre entre dos apoyos de una repisa. | claro, luz | span | Ver «luz». | ⚠️ |
| **Remetido** | Pieza que queda hacia adentro del plano del frente (el zoclo, 75 mm como mínimo en cocina [10]). | remetido, retranqueado [10] | set back / recessed | — | ⚠️ [10] |
| **Pandeo** (para la persona) / flecha (en el código y los cálculos) | Cuánto se comba una repisa cargada. | pandeo, se comba, se panza, «se hace panza» | sag / deflection | «Flecha» es de ingeniería: la persona no lo entiende (`Revision.tsx:123`). Canónico: la interfaz dice «se pandea» o «pandeo»; `R1_FLECHA` y `flecha()` se quedan como ids. | ⚠️ |
| **Vuelco** | Que el mueble se vaya de frente. | volcarse, voltearse, irse de frente | tip-over | «Vuelco» se entiende en México, pero «que se voltee hacia adelante» es más claro. | ⚠️ [43] |

---

## 9. Mapeo del código a lo que ve la persona

### 9.1 Roles de pieza (`Pieza.rol`, `esquema.ts:30-33`)

| `rol` hoy | Id sugerido (D33) | Nombre para la persona | Cómo lo usa Knotty hoy | Recomendación |
|---|---|---|---|---|
| `lateral` | `side` | **Lateral** | «Lateral izquierdo / derecho» (`cabinet.ts:77-78`) | Mantener. Alias: costado. |
| `piso` | `bottom` | **Piso** | «Piso» (`cabinet.ts:94`) | Mantener. No usar «base» para esta pieza (ver `base` en §10). Alias: base, fondo (Chile). |
| `techo` | `top` + atributo `over: boolean`, o dos roles `top` y `topOver` | **Techo** (entre laterales) / **Cubierta** (encima) | El mismo rol se llama «Techo» o «Cubierta» según `plan.top` (`cabinet.ts:96-97`) | Separar en dos roles o agregar el atributo: las reglas (vuelo, escritorio, `typology.ts:119`) ya hablan de «cubierta», y un diseño libre sin plan no puede decir cuál es. |
| `entrepano` | `shelf` + `apoyo` | **Repisa fija / Repisa móvil** | «Entrepaño fijo» para la fija y «Repisa» para la móvil (`cabinet.ts:118,138`); «Entrepaños que se pandean» en la revisión (`Revision.tsx:9`) | Una sola palabra: «Repisa» con «fija» o «móvil». Alias: entrepaño, balda, estante, anaquel, charola. |
| `divisor` | `divider` | **Divisor** | «Divisor 1» (`cabinet.ts:102`); «divisiones verticales» en la lectura (`lectura.v1.md:14`) | Mantener «Divisor» para la pieza; «columna» para el espacio que deja. |
| `trasera` | `back` | **Trasera** | «Trasera» | Mantener. Alias: fondo, respaldo, espalda. |
| `zoclo` | `kick` | **Zoclo** | «Zoclo»; en la ficha, «Base: Con zoclo / Directa» (`PlanSheet.tsx:183`) | Mantener, con ayuda contextual la primera vez («la tira de abajo al frente»). Cambiar la etiqueta «Base» de la ficha por «Apoyo» o «Cómo se apoya». |
| `faja` | `rail` (con `position: 'frontTop' | 'backTop' | 'bottom'`) | **Travesaño** | Solo lo nombran la regla de escuadrado («Faja trasera superior», `escuadrado.ts:37`) y la lista `TRAVESANOS` (`escuadrado.ts:5`) | Renombrar a «Travesaño» para la persona; la posición en el nombre: «Travesaño trasero de arriba». |
| `puerta` | `door` | **Puerta** | «Puerta izquierda / derecha» (`cabinet.ts:166-167`); en la ficha «Hojas: 1 hoja / 2 hojas» (`PlanSheet.tsx:111`) | Cambiar la ficha a «Puertas: 1 / 2». Reservar «hoja» para el tablero de 1220 × 2440. |
| `frente-cajon` | `drawerFront` | **Frente del cajón** | «Frente de cajón 1» (`cajon.ts:64`) | Mantener. |
| `costado-cajon` | `drawerSide` | **Costado del cajón** | Lo llevan también el **contrafrente** y la **trasera** del cajón (`cajon.ts:75-76`) | **Error de modelo**: agregar `drawerSubFront` (Contrafrente) y `drawerBack` (Trasera del cajón), o un `drawerBoxEnd`. Hoy una regla que pregunte por «costados del cajón» cuenta cuatro. |
| `fondo-cajon` | `drawerBottom` | **Fondo del cajón** | «Fondo de cajón 1» | Mantener, siempre con «del cajón». |
| `refuerzo` | `brace` | **Refuerzo** | Genérico | Mantener; si se usa para cartelas o listones, decirlo en el nombre. |
| `otro` | `other` | — | Lo usa la **tapa** de un hueco cerrado (`cabinet.ts:156`) | Agregar `fixedPanel` (**Tapa fija**): así la regla de puertas no la ignora y el despiece la agrupa. |
| — (falta) | `leg` | **Pata** | Hoy es un herraje (`pata-niveladora`) | Rol si es de triplay o madera. |
| — (falta) | `apron` | **Faldón** | Escritorios y bancos | Útil para `typology` (escritorio, banca). |

### 9.2 Tipos de unión (`Union.tipo`, `esquema.ts:69-72`)

| `tipo` hoy | Id sugerido | Etiqueta hoy (Paneles / reglas) | Nombre para la persona | Recomendación |
|---|---|---|---|---|
| `tope-tornillo` | `buttScrew` | «tornillo al canto» (ambos); en el prompt «tornillo de tope» (`sistema.v4.md:56`) | **A tope con tornillo** | Unificar. Descripción: «el tornillo cruza una pieza y entra por el canto de la otra». |
| `bolsillo` | `pocketScrew` | «tornillo de bolsillo» | **Tornillo de bolsillo** | Mantener; alias «Kreg». |
| `tarugo` | `dowel` | «tarugos» | **Tarugos** | Mantener; alias «espigas». Ojo con «tarugo» de Argentina (taquete). |
| `minifix` | `camLock` | «minifix» | **Minifix** | Mantener, con «(se desarma)» en la ayuda. |
| `canal` | `groove` / `dado` | «canal» | **Ranura** | Cambiar la etiqueta a «Ranura» (el prompt ya dice «la pieza que lleva la ranura», `sistema.v4.md:54`). |
| `rebaje` | `rabbet` | «rebaje» | **Rebaje** | Mantener. |
| `escuadra` | `angleBracket` | «escuadra» | **Escuadra metálica** | Cambiar: sin «metálica» se confunde con la herramienta y con «a escuadra». |
| `clavo-pegamento` | `nailGlue` | «clavo y pegamento» | **Clavo y pegamento** | Mantener. |
| `soporte-repisa` | `shelfPin` | «soportes de repisa» (Paneles) / «soporte de repisa» (reglas) | **Soportes de repisa** | Unificar en una fuente (hoy son dos mapas, `Paneles.tsx:10` y `uniones.ts:7`). |
| `bisagra-cazoleta` | `cupHinge` | «bisagras de cazoleta» / «bisagra de cazoleta» | **Bisagras de cazoleta** | Unificar; mostrar el tipo (recta, codo, súper codo). |
| `corredera` | `drawerSlide` | «correderas» | **Correderas** | Mantener; alias «rieles». |

---

## 10. Términos que Knotty usa hoy de forma incorrecta o ambigua

| # | Término | Dónde | Problema | Cambio propuesto | Conf. |
|---|---|---|---|---|---|
| 1 | **Repisa / entrepaño** | `cabinet.ts:118,138`, `Revision.tsx:9,123`, `Chat.tsx:21`, `PlanSheet.tsx:108`, prompts | La misma pieza con dos nombres; «entrepaño fijo» y «repisa» parecen piezas distintas. | «Repisa fija» / «Repisa móvil». | ✅ [1][2] |
| 2 | **Techo / cubierta** | `cabinet.ts:96-97`, `planChanges.ts:10`, `typology.ts:119` | Un solo rol con dos nombres según la ficha; en un diseño libre no se sabe cuál es. | Rol o atributo propio (§9.1). | ⚠️ [10] |
| 3 | **Base** | `PlanSheet.tsx:183` («Base: Con zoclo / Directa»), `Chat.tsx:21` («Refuerza la base»), `typology.ts:90` («debajo de la base»), `Revision.tsx:123` | Tres sentidos: el piso del mueble, el zoclo o las patas, y «lo de abajo» en general. | Ficha: «Apoyo: Con zoclo / Directo al suelo». Mensajes: «el piso del mueble» o «el zoclo», según el caso. | ⚠️ |
| 4 | **Hoja** | `PlanSheet.tsx:111` («1 hoja / 2 hojas»), `esqueleto.v2.md:24`, `Materiales.tsx:88` | Puerta y tablero de 1220 × 2440 con la misma palabra, en pantallas vecinas. | «Puertas: 1 / 2»; «hoja» solo para el tablero. | ⚠️ [22] |
| 5 | **Escuadra** | `Paneles.tsx:17`, `uniones.ts`, catálogo `escuadra-1-1/2` | Herraje, herramienta y ángulo recto. | «Escuadra metálica» para el herraje. | ✅ [1] |
| 6 | **Canal / ranura** | `Paneles.tsx:15` vs `sistema.v4.md:54` | Dos nombres para la misma unión. | «Ranura». | ✅ [1] |
| 7 | **Tornillo al canto / tornillo de tope** | `Paneles.tsx:11`, `uniones.ts:8` vs `sistema.v4.md:56` | Dos nombres; el experto y la interfaz no coinciden. | «A tope con tornillo». | ⚠️ |
| 8 | **Faja** | `escuadrado.ts:5,24,37` | Palabra poco conocida y ambigua (en México también es la faja de un bastidor o una tira cualquiera). | «Travesaño». | ❓ |
| 9 | **Contrafrente y trasera del cajón con rol `costado-cajon`** | `cajon.ts:75-76` | Error de modelo; cualquier conteo de «costados» se equivoca. | Roles propios. | ✅ (código) |
| 10 | **Tapa con rol `otro`** | `cabinet.ts:156` | La pieza existe en el oficio (tapa fija) pero el modelo no la reconoce. | Rol `fixedPanel`. | ✅ (código) |
| 11 | **Flecha** | `Revision.tsx:123` («Revisé flecha de entrepaños») | Jerga de ingeniería. | «Revisé cuánto se pandean las repisas». | ⚠️ |
| 12 | **Fondo** | medidas (`Captura.tsx:23`) y pieza del cajón | Correcto en México, pero choca con «fondo» = piso (Chile) y trasera (España) si el LLM lo lee de fotos o tutoriales. | En el prompt, decir explícito: «fondo = profundidad; la pieza de atrás es la trasera». | ⚠️ [10][11] |
| 13 | **Tornillo #8 × 1¼"** | catálogo (`nombre`) | La persona en México entiende pulgadas en tornillos, pero el resto de Knotty va en mm. | «Tornillo para madera de 32 mm (#8 × 1¼")» (mm primero), como propone `07-…` con `tradeName`. | ⚠️ |
| 14 | **Overlay / inset** | prompts y enums (`cabinet.ts:14-16`) | Bien como id interno; la interfaz ya traduce a sobrepuesta / embutida. Riesgo: que el experto escriba «overlay» en una `explicacion`. | Regla en el prompt: «a la persona dile sobrepuesta o embutida». | ⚠️ [14] |

---

## 11. Preguntas frecuentes

1. **¿Repisa o entrepaño?** Son la misma pieza. Knotty dice «repisa» y agrega «fija» (atornillada, ayuda a que el mueble no se tuerza) o «móvil» (sobre soportes, la puedes subir o bajar). «Entrepaño» es el término de carpintero; también lo entendemos [1][2].
2. **¿Qué diferencia hay entre techo y cubierta?** El techo va *entre* los laterales; la cubierta va *encima* y tapa sus cantos, como en un buró. La cubierta puede sobresalir (vuelo) [10].
3. **¿Qué es el zoclo?** La tira de abajo al frente que levanta el mueble del suelo; normalmente va un poco hacia adentro para que no pegues con el pie [10]. En México también se llama zoclo a la moldura de la pared [3].
4. **Me dicen «triplay», «contrachapado», «plywood» y «terciado». ¿Es lo mismo?** Sí: capas delgadas de madera pegadas con la fibra cruzada. Cambia el nombre por país [5][6].
5. **¿Por qué mi hoja de 18 mm mide 17.5?** El espesor real varía; se mide con calibrador o flexómetro antes de cortar ranuras o elegir tornillos [20][21].
6. **¿Pija o tornillo?** En México es lo mismo (tornillo para madera). En la app decimos «tornillo» para que se entienda en cualquier lado [44].
7. **¿Tarugo o taquete?** En México, el *tarugo* es el cilindro de madera que une dos piezas y el *taquete* va en el muro. En Argentina «tarugo» es el taquete [7].
8. **¿Qué es una bisagra de cazoleta y cuál compro?** La bisagra oculta que va en un agujero de 35 mm en la puerta. Recta si la puerta tapa todo el lateral; codo si dos puertas comparten un lateral; súper codo si la puerta va embutida [14].
9. **¿Qué quiere decir «sobrepuesta» y «embutida»?** Sobrepuesta: la puerta tapa el frente del mueble; es la más fácil de ajustar. Embutida: va dentro del hueco, se ve más fina y pide más precisión [14].
10. **¿Qué es el cubrecanto y lo necesito?** Una tira que tapa las capas del canto del triplay. Es estético y protege; se pide a la maderería o se pega con plancha [25][48].
11. **¿Qué es el sistema 32?** Una fila de agujeros de 5 mm cada 32 mm, a 37 mm del frente, para poner soportes de repisa y herrajes estándar [15][16].
12. **¿Qué es una unión «a tope con tornillo»?** La más sencilla: una pieza se apoya en el canto de la otra y un tornillo las atraviesa, con pegamento. Pide taladro guía y avellanado [1][9].

---

## Fuentes

1. Grupo Mobila (Servef, Valencia). *Glosario de Carpintería y Ebanistería para Escuelas Taller*, 2006. https://terminologiaarquitectonica.files.wordpress.com/2018/02/2006-glosario-de-carpinterc3ada-y-ebanisterc3ada-para-escuelas-taller.pdf
2. Wikipedia. «Estante (mueble)». https://es.wikipedia.org/wiki/Entrepa%C3%B1o
3. ASALE. *Diccionario de americanismos*, «zoclo». https://www.asale.org/damer/zoclo
4. RAE. *Diccionario de la lengua española*, «jaladera» («f. Méx. Asa para tirar de algo»). https://dle.rae.es/jaladera
5. Triplex.com.co. Nombres, medidas y espesores del tablero contrachapado en Colombia. https://triplex.com.co/
6. Wikipedia. «Contrachapado». https://es.wikipedia.org/wiki/Contrachapado
7. Wikipedia. «Taco (construcción)» (taquete en México, tarugo en Argentina, chazo en Colombia). https://es.wikipedia.org/wiki/Taco_(construcci%C3%B3n)
8. Wikipedia. «Acetato de polivinilo» (cola blanca, Colbón, cola fría). https://es.wikipedia.org/wiki/Acetato_de_polivinilo
9. Arauco. *Serie Cómo Hacer / Mueblería: Cajones para muebles* (Chile, 2015). https://arauco.com/chile/wp-content/uploads/sites/14/2019/03/08_pap_cajones_chile_30jul_2015_1002.pdf
10. Arauco. *Cómo diseñar y construir correctamente una cocina* (Chile, 2016). https://arauco.com/archivos_bim/17_16486_pdf_sch_foll-web_muebleria_como_disenar_cocina_chile_11may_16-pdf_374_so1.pdf
11. Kansei Cocinas. «El armazón de un mueble de cocina» (España). https://kanseicocinas.com/2020/12/el-armazon-de-un-mueble-de-cocina/
12. Scatec. «¿Cómo se llaman las partes de un mueble de cocina?» (España). https://www.scatec.es/como-se-llaman-las-partes-de-un-mueble-de-cocina/
13. Hammer Melamine. «¿Cómo hacer cajones para muebles de melamina?». https://hammermelamine.blogspot.com/2018/05/como-hacer-cajones-para-muebles.html
14. ParaCarpinteros. «Bisagras de cazoleta: recta, semicurva, curva y cómo ajustarlas». https://www.paracarpinteros.com/blog/explora-la-carpinteria-y-ebanisteria-con-paracarpinteros-com-3/bisagras-de-cazoleta-recta-semicurva-curva-y-como-ajustarlas-82
15. Festool España. «Perforación en línea con el sistema LR 32». https://www.festool.es/conocimientos/ejemplos-de-aplicaci%C3%B3n/fresadora-perforaci%C3%B3n-linea
16. Foromadera. «El sistema de construcción 32 mm». https://www.foromadera.com/t/el-sistema-de-construccion-32-mm/18497
17. Fresno Cabinets. «Face Frame vs Frameless Cabinet Construction». https://fresnocabinets.com/faceframe-vs-frameless-cabinets/
18. The Home Depot México, categoría «Routers eléctricos para madera»; Coppel, «Routers fresadoras y rebajadoras». https://www.homedepot.com.mx/b/herramientas/herramientas-electricas-portatiles/routers · https://www.coppel.com/routers-fresadoras-y-rebajadoras
19. Kreg Tool. «How to select the right pocket-hole screw». https://learn.kregtool.com/learn/how-to-select-right-pocket-hole-screw/
20. Home Repair Geek. «Kreg jig screw chart». https://homerepairgeek.com/tips/kreg-jig-screw-chart/
21. Kreg Tool. «Why material thickness matters». https://learn.kregtool.com/learn/why-material-thickness-matters/
22. The Home Depot México. «Triplay BC 1.22 × 2.44 m 18 mm» (pino, grado BC, 244 × 121.8 × 1.8 cm, 28.14 kg). https://www.homedepot.com.mx/p/triplay-bc-122-x-244-m-18mm-554283-554283
25. Placacentro Masisa México. «Servicios» (dimensionado, enchapado de cantos, perforación para bisagras, ranuras, etiquetado). https://placacentro.com/mexico/servicios/
27. Materiales Nungaray (Tijuana / Mexicali). «Servicios» (corte de cubiertas). https://www.materialesnungaray.com.mx/servicios/
29. CutList Optimizer. https://www.cutlistoptimizer.com/
30. HOLZ-HER. Seccionadora vertical SECTOR 1260 (precisión de 0.1 mm). https://www.holzher.es/es/productos/sierras-para-tableros-verticales/sector-1260-automatic.html
31. Power Tool Institute. *Circular Saws* (seguridad). https://www.powertoolinstitute.com/wp-content/uploads/2025/10/PTI_Circular-Saws.pdf
34. Popular Woodworking. «Squaring up cabinets – don't forget the back». https://www.popularwoodworking.com/editors-blog/squaring-up-cabinets-dont-forget-the-back/
36. Freund Ferretería. «Pegamento cola blanca para madera 850 Resistol». https://www.freundferreteria.com/producto/9899278
40. Revista Ferrepat. «Qué taquete usar según el tipo de pared y cuánto peso soporta». https://www.revista.ferrepat.com/ferreteria/taquete-segun-tipo-de-pared/
42. U.S. CPSC. *Tipover Prevention Project: Anchors without Tools*. https://www.cpsc.gov/s3fs-public/pdfs/Tipover-Prevention-Project-Anchors-without-Tools.pdf
43. U.S. CPSC. *Anchor It!* https://www.anchorit.gov/
44. AsiHablamos, «Pija» (usos por país); Jergozo, «pija en Argentina». https://www.asihablamos.com/word/palabra/Pija.php · https://jergozo.com/significado/pija/en/argentina
46. Sodimac México. Categoría «Tableros dimensionados». https://www.sodimac.com.mx/sodimac-mx/category/cat3240001/Tableros-Dimensionados
47. La Nación (Argentina). «Cómo colocar un taco o tarugo en la pared». https://www.lanacion.com.ar/lifestyle/como-colocar-un-taco-o-tarugo-en-la-pared-nid185216/
48. The Home Depot México. «Cubrecanto de madera 16 mm». https://www.homedepot.com.mx/p/canplast-cubrecanto-pre-engomado-de-madera-1500-x-16-cm-pino-838882 (*nota de auditoría: la dirección original, `/b/materiales-de-construccion/melamina/cubrecanto-de-madera-16-mm-838882`, da 404; se sustituyó por la ficha del mismo SKU*)
49. Tecnitool (España). «Tipos de fresadora, router y tupí para madera». https://tecnitool.es/tipos-de-fresadoras-para-madera/

La numeración se comparte con `09-fabricacion-y-armado.md`: los números que faltan aquí se citan solo en ese documento o no se usaron.
