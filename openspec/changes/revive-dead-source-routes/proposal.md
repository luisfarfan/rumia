## Why

Las fuentes `github`, `x` y `linkedin` se detectan correctamente en la captura y luego se
descartan: la condición de la rama web del worker las excluye de forma explícita, así que caen
en la rama no manejada y el ítem se guarda con la URL cruda como contenido. Medido el
2026-08-08 con el handler actual, la extracción genérica saca **3720, 1435 y 8995 caracteres
reales** de esas tres fuentes — el contenido estaba a un cambio de lista de distancia.

Además, cuando una página no ofrece texto legible, el handler devuelve el marcador
`"No readable text extracted."` como si fuera contenido. El ítem termina en `extracted`, se
categoriza, se vectoriza y aparece en el dashboard indistinguible de uno bien ingerido.

## What Changes

- **Enrutado extraíble y testeable:** la decisión de qué handler procesa cada ítem sale del
  closure del `Worker` de BullMQ a una función exportada, invocable sin Redis. La condición
  deja de estar duplicada.
- **Tres fuentes revividas:** `github`, `x` y `linkedin` pasan por la extracción web en vez de
  caer en la rama no manejada.
- **El fallo de extracción deja de ser contenido:** sin artículo legible ni meta description, el
  handler lanza y el ítem falla, en lugar de guardar un marcador que parece contenido.

## Capabilities

### Modified Capabilities
- `async-processing`: el despacho por tipo de fuente vive en una función testeable y cubre
  `github`, `x` y `linkedin`.
- `web-extraction`: una página sin texto extraíble es un fallo, no un resultado vacío.

## Impact

- **Comportamiento observable:** URLs que hoy terminan en `extracted` con 27 caracteres pasarán
  a `error`. Es el objetivo del cambio, pero aparecerán ítems en rojo en el dashboard que antes
  se veían correctos y vacíos.
- **Fuera de alcance:** Reddit e Instagram siguen sin ruta propia. `old.reddit.com` solo
  devuelve el boilerplate de búsqueda (545 caracteres) e Instagram exige sesión autenticada.
- **Sin cambios de esquema ni de dependencias.**
