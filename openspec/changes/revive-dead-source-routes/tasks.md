# Change: revive-dead-source-routes

## Why
GitHub, X y LinkedIn se detectan y luego se descartan: la condición de la rama web los excluye
explícitamente, así que caen en `unhandled` y se guardan como la URL cruda. Medido hoy, la
extracción genérica saca 3720, 1435 y 8995 caracteres reales de ellos — el contenido estaba a
un cambio de lista de distancia. Y cuando una página no da nada, el handler guarda el marcador
"No readable text extracted." como si fuera contenido, así que el ítem parece ingerido, se
categoriza y se vectoriza.

## Scope
- In: la decisión de qué handler procesa cada ítem, y el fallo de extracción web
- Out: Reddit e Instagram (necesitan vía propia), el tablón web (B17-B20), transcripción (B3)

## Decisions
- D1 Reddit e Instagram quedan fuera: `old.reddit.com` solo devuelve el boilerplate de búsqueda e Instagram exige sesión
- D2 Sin nada legible el handler lanza, y ese error se propaga: el ítem falla en vez de parecer ingerido

---

- [x] T001 Sacar el enrutado a una función testeable y admitir GitHub, X y LinkedIn
  - Type: implementation
  - Depends on: none
  - Human review: false
  - Verification: `npx vitest run tests/extractionRouting.test.ts`
  - Acceptance:
    - la elección de handler por ítem vive en una función exportada, invocable sin BullMQ ni Redis
    - un ítem con `detectedSource` `github`, `x` o `linkedin` y con URL se enruta a extracción web
    - los ítems `youtube`, `tiktok`, `photo`, `audio` y `voice` conservan el handler que ya usaban, incluido el fallback a carrusel de TikTok cuando yt-dlp rechaza la URL
    - una foto cuyo caption contiene un enlace sigue yendo a su handler de imagen, no a extracción web
    - un ítem `audio` o `voice` con enlace en el caption va a transcripción, no a extracción web
    - el motivo de degradación que devuelve un handler llega intacto a quien llama
    - un ítem sin handler aplicable sigue cayendo a la rama no manejada, sin inventar contenido
    - el fuente de `src/workers/ingestion/worker.ts` ya no contiene la lista de tipos de fuente: la condición vive en un solo sitio
    - cuando un handler lanza, la función propaga el error en vez de convertirlo en contenido

- [x] T002 Un fallo de extracción deja de guardarse como contenido
  - Type: implementation
  - Depends on: T001
  - Human review: false
  - Verification: `npx vitest run tests/webExtractionFailure.test.ts`
  - Acceptance:
    - cuando la página no da ni artículo legible ni meta description, el handler lanza
    - el literal "No readable text extracted." ya no aparece en el fuente de `src/`
    - cuando hay meta description pero no artículo legible, esa description se devuelve como contenido
    - un artículo legible se sigue devolviendo íntegro
