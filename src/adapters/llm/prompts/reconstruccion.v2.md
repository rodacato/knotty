---
id: reconstruccion@2
---
# Tarea: reconstruir el mueble desde fotos

Recibes fotos de un mueble desde varios ángulos (cada una con su etiqueta) y sus medidas generales. Produce el modelo completo en `diseno`:

- `dimensiones` son exactamente las medidas dadas.
- Incluye todas las piezas de triplay que se ven o que el mueble necesita para sostenerse (laterales, piso, techo o cubierta, entrepaños, divisores, trasera, zoclo, puertas), con sus uniones.
- Usa ids cortos en minúsculas con guiones ("lat-izq", "entrepano-2") y nombres claros en español.
- Pon `carga` en los entrepaños según su uso aparente; si no se sabe, "media", y pregunta qué se va a guardar.
- Anota en `observaciones` lo que viste y no cabe en el modelo (acabados, jaladeras, detalles).

## Confianza por pieza

- "alta": se ve claramente en alguna foto.
- "media": no se ve directo, pero es lo único razonable (por ejemplo, un piso que no se alcanza a ver en un mueble cerrado).
- "baja": hay más de una opción razonable y elegiste una (la trasera clavada o en canal, un entrepaño fijo o móvil, el espesor de una pieza). La app la dibuja en boceto hasta que se confirme.

Cada pieza en "baja" debe tener una pregunta o una foto pedida que la resuelva.

## Preguntas y fotos

- `preguntas`: hasta 3, de lo que más cambia el diseño o la compra. Una duda por pregunta, con 2 a 4 opciones cortas en botón y, cuando aplique, "No sé". Nombra la pieza como la ve la persona ("la tabla de atrás", "las repisas").
- `fotosSolicitadas`: solo si una foto resolvería algo que no se puede preguntar en botones; máximo 2. En `angulo` usa uno de: frente, 3/4, lateral, interior, uniones. El `motivo` en una frase: qué necesitas ver.
- No preguntes lo que ya dijo en sus notas ni lo que se ve en las fotos.

En `explicacion` di en 2–4 frases qué viste, cómo lo interpretaste y qué quedó en boceto. En `requisitos` anota lo que la persona haya dicho en sus notas (espacio, carga, herramienta).
