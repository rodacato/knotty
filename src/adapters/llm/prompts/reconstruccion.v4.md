---
id: reconstruccion@4
---
# Tarea: reconstruir el mueble desde fotos o desde una descripción

Recibes las medidas generales de un mueble (o el aviso de que la persona no las sabe) y, o bien fotos desde varios ángulos (cada una con su etiqueta), o bien una descripción escrita por la persona. Produce el modelo completo en `diseno`:

- `dimensiones` son exactamente las medidas dadas. Si no hay medidas, propón las típicas de ese mueble en México (una cama individual lleva colchón de 990 × 1900 mm, un buró ronda 500 × 450 × 400 mm) y dilo en la explicación.
- Incluye todas las piezas de triplay que se ven o que el mueble necesita para sostenerse (laterales, piso, techo o cubierta, entrepaños, divisores, trasera, zoclo, puertas), con sus uniones.
- Usa ids cortos en minúsculas con guiones ("lat-izq", "entrepano-2") y nombres claros en español.
- Pon `carga` en los entrepaños según su uso aparente; si no se sabe, "media", y pregunta qué se va a guardar.
- Anota en `observaciones` lo que viste y no cabe en el modelo (acabados, jaladeras, detalles).

## Sin fotos

Si no hay fotos, la descripción es lo único que sabes:

- Arma lo que la persona pidió, respetando exactamente lo que dijo (número de repisas, puertas, zoclo, uso).
- Si pidió cajones, no los armes aquí: deja el hueco y agrega una pregunta cuya opción diga el pedido completo, por ejemplo «Agrega un cajón abajo». Al elegirla, la app arma el cajón con sus correderas en el siguiente ajuste.
- Lo que no dijo, resuélvelo con la opción más común y sencilla de triplay DIY y márcalo con confianza "baja" y una pregunta.
- En `explicacion` di qué entendiste de la descripción y qué decidiste tú.
- No pidas fotos salvo que la persona mencione un mueble que ya tiene y quiere copiar.

## Confianza por pieza

- "alta": se ve claramente en alguna foto o la persona lo dijo explícitamente.
- "media": no se ve directo, pero es lo único razonable (por ejemplo, un piso que no se alcanza a ver en un mueble cerrado).
- "baja": hay más de una opción razonable y elegiste una (la trasera clavada o en canal, un entrepaño fijo o móvil, el espesor de una pieza). La app la dibuja en boceto hasta que se confirme.

Cada pieza en "baja" debe tener una pregunta o una foto pedida que la resuelva.

## Preguntas, fotos y sugerencias

Primero diseña, luego pregunta: entrega siempre un diseño completo con lo más común, aunque falten datos. La persona puede contestar varias preguntas de una vez, así que hazlas independientes entre sí.

- `preguntas`: hasta 3, solo de lo que más cambia el diseño o la compra. Una duda por pregunta, con 2 a 4 opciones cortas en botón y, cuando aplique, "No sé". Nombra la pieza como la ve la persona ("la tabla de atrás", "las repisas").
- `fotosSolicitadas`: solo si una foto resolvería algo que no se puede preguntar en botones; máximo 2. En `angulo` usa uno de: frente, 3/4, lateral, interior, uniones. El `motivo` en una frase: qué necesitas ver.
- No preguntes lo que ya dijo en sus notas ni lo que se ve en las fotos.
- `sugerencias`: 3 o 4 cambios que la persona podría pedir enseguida, escritos como ella los diría ("Agrega un cajón abajo", "Hazlo 10 cm más alto"). Que sean útiles para este mueble, no genéricos.

En `explicacion` di en 2–4 frases qué viste, cómo lo interpretaste y qué quedó en boceto. En `requisitos` anota lo que la persona haya dicho en sus notas (espacio, carga, herramienta).
