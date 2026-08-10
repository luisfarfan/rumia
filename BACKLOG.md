# Backlog — AutoDiscovery Wiki

Estado del backlog tras la auditoría de capacidades del 2026-08-08.
Cada ítem indica si **la solución ya está decidida** o si primero hace falta un spike de investigación.

Leyenda de confianza:
- 🟢 **Solución conocida** — sabemos exactamente qué código escribir.
- 🟡 **Solución parcial** — conocemos el enfoque, falta verificar un supuesto externo.
- 🔴 **Solución desconocida** — hace falta un spike antes de poder estimar o planear.

---

## P0 — Bloqueadores: rompen lo que ya está construido

### ~~B1. `bot.start()` sin guard arranca un segundo polling en el worker~~ ✅ HECHO (2026-08-08)
El cliente vive ahora en [src/bot/client.ts](src/bot/client.ts), construido pero sin arrancar;
[src/bot/index.ts](src/bot/index.ts) es el único que llama `bot.start()`, y
`audioTranscriptionHandler` importa desde `client.js`. Protegido por
[tests/botClient.test.ts](tests/botClient.test.ts), que se comprobó que **falla de verdad** al
restaurar el import viejo.

### ~~B2. El tier `vision` apunta a `gpt-4o`, que el proxy no sirve~~ ✅ HECHO (2026-08-08)
**Visión verificada de verdad**, no asumida: se generó una imagen con un código no adivinable
(`QX-7431-ZP`) más tres figuras de colores y se envió por el proxy. `gemini-3-flash` (4.6 s),
`gemini-pro-agent` (7.3 s) y `claude-sonnet-4-6` (4.1 s) leyeron el código exacto y describieron
las tres figuras. **El LLM hace OCR: no hace falta Tesseract** (esto también resuelve la parte
de OCR de B4/B5).
Los cuatro tiers salen ahora de configuración en `CLIProxyProvider` y `OpenRouterProvider`, que
tenía el mismo defecto; `CLIPROXY_VISION_MODEL=gemini-3-flash`. `CLIProxyProvider` **lanza al
construirse** si faltan `CLIPROXY_FLASH_MODEL` o `CLIPROXY_PRO_MODEL`, en vez de caer a un
literal que el proxy no serviría. El fallo de visión ya no se guarda como contenido: el ítem
queda marcado en la columna `error` y conserva la transcripción. Cubierto por
[tests/cliProxyModels.test.ts](tests/cliProxyModels.test.ts) y
[tests/ingestionAgentFailure.test.ts](tests/ingestionAgentFailure.test.ts), ambos comprobados
contra su propia regresión.

<details><summary>Diagnóstico original</summary>
**Archivo:** [src/core/llm/providers/CLIProxyProvider.ts:23](src/core/llm/providers/CLIProxyProvider.ts)
`getModel('vision')` devuelve `'gpt-4o'` a pelo, ignorando `CLIPROXY_*_MODEL`.
**Verificado contra el proxy levantado (2026-08-08):**
```
POST /v1/chat/completions {"model":"gpt-4o"}
→ 502 {"error":{"message":"unknown provider for model gpt-4o"}}
POST /v1/chat/completions {"model":"gemini-3-flash"}  → 200 OK
```
Ya no es hipótesis: **todo análisis visual falla, siempre**. Y falla en silencio — el catch de
[ingestionAgent.ts:79](src/agents/ingestionAgent.ts) guarda `[Error analizando fotogramas]`
como si fuera contenido válido, así que el item queda `extracted` sin análisis visual.
**Solución:** añadir `CLIPROXY_VISION_MODEL` y leerlo como los demás tiers; hacer que el fallo
de visión marque el item como degradado en vez de tragárselo.
**Candidatos con visión disponibles en el proxy:** `gemini-3-flash`, `gemini-3.1-flash-image`,
`gemini-pro-agent`, `claude-sonnet-4-6`, la familia `gpt-5.x`.
</details>

### ~~B13. El proxy no expone `/v1/embeddings` → toda la fase RAG está rota~~ ✅ HECHO (2026-08-08)
[OllamaProvider.ts](src/core/llm/providers/OllamaProvider.ts) nuevo, registrado en el factory
como `ollama`; `EMBEDDING_LLM_PROVIDER=ollama` contra `bge-m3` en `ubuntu-lan`. Esquema migrado
a `vector(1024)` en `item_chunks` y `nodes`. `CodexProvider` y `AntigravityProvider` dejaron de
devolver vectores de ceros: ahora lanzan.
**Verificado con la cadena real, no solo con mocks:** `EmbeddingService` → Ollama → Postgres
produjo vectores de 1024, y la búsqueda por `<=>` ordenó bien — 0.3078 para el chunk relevante
frente a 0.7727 para uno no relacionado.
**Gap conocido:** `schema.sql` usa `CREATE TABLE IF NOT EXISTS`, sin `ALTER`. Sobre una base que
ya existiera con `vector(1536)`, `npm run migrate` **no cambiaría la dimensión**. Aquí no importó
porque la base estaba vacía, pero un despliegue con datos necesitaría una migración real.
Cubierto por [tests/ollamaProvider.test.ts](tests/ollamaProvider.test.ts) y
[tests/schemaDimension.test.ts](tests/schemaDimension.test.ts), que corre la migración de verdad
e interroga la base en vez de leer el `.sql`.

<details><summary>Diagnóstico original</summary>
**Archivo:** [src/core/llm/providers/CLIProxyProvider.ts:122](src/core/llm/providers/CLIProxyProvider.ts)
`generateEmbeddings` pide `text-embedding-3-small` contra el proxy.
**Verificado contra el proxy levantado (2026-08-08):**
```
POST /v1/embeddings {"model":"text-embedding-3-small"}  → 404
```
El endpoint **no existe** en cliproxyapi, y ninguno de los 35 modelos servidos es de embeddings
(son todos de chat/imagen/video). Con `EMBEDDING_LLM_PROVIDER=cliproxyapi`, la cola de embedding
falla entera → sin chunks vectorizados → **`/ask`, la búsqueda semántica y el RAG no funcionan**.
Hallazgo nuevo, no detectado en la auditoría inicial.
**Solución encontrada (2026-08-08):** la laptop Ubuntu de la LAN (`ubuntu-lan` → 192.168.1.12)
corre **Ollama con `nomic-embed-text` ya instalado**, expuesto en `0.0.0.0:11434` y alcanzable
desde el Mac. Su endpoint OpenAI-compatible responde:
```
POST http://192.168.1.12:11434/v1/embeddings {"model":"nomic-embed-text"}  → 200, 768 dims
```
**Bloqueador:** `schema.sql` declara `vector(1536)` en `item_chunks.embedding` (línea 37) y en
los nodos del grafo (línea 51) — dimensión de `text-embedding-3-small`. `nomic-embed-text`
produce **768**. Hay que migrar el esquema a la dimensión del modelo que se elija.
Como la cola de embedding llevaba fallando con 404 desde siempre, presumiblemente **no hay
vectores almacenados que re-generar** (confirmar cuando Postgres levante).
**Modelo elegido: `bge-m3` (1024 dims).** Medido en la propia laptop (RTX 3060 6GB) con un
smoke test de 3 frases — una en español, su traducción al inglés, y una tercera en español
sobre otro tema. Se mide la similitud coseno entre el par traducido (debe ser alta) y entre
el par no relacionado (debe ser baja):

| modelo | dims | es↔en mismo tema | es↔es otro tema | margen | latencia (caliente) |
|---|---|---|---|---|---|
| `bge-m3` | 1024 | **0.9253** | 0.3338 | +0.5915 | 0.19 s |
| `qwen3-embedding:0.6b` | 1024 | 0.7724 | **0.1261** | **+0.6463** | 0.21 s |
| `nomic-embed-text` | 768 | 0.8001 | 0.6211 | +0.1791 | 0.73 s |

`nomic-embed-text` queda **descartado**: puntúa 0.62 entre textos sin ninguna relación, o sea
no discrimina — el top-k del RAG sería ruido. Los otros dos son ambos buenos; se elige `bge-m3`
por su alineación translingüe muy superior (0.93), que es el caso de uso real de esta wiki:
preguntar en español y recuperar también contenido en inglés. `qwen3-embedding:0.6b` es un
segundo cercano, con separación aún más nítida, y es el reemplazo directo si `bge-m3` decepciona.
**Ambos son de 1024 dims**, así que la migración de esquema es la misma y la elección final no
bloquea el trabajo. (Ojo: 3 frases es un smoke test, no un benchmark; sirve para descartar,
no para afinar.)
**Dependencia operativa:** la laptop tiene que estar encendida y en la LAN para que la cola de
embedding funcione. Evaluar si eso es aceptable o si conviene un fallback.
</details>

### ~~B3. La transcripción de audio está en modo mock~~ ✅ HECHO (2026-08-09)
**faster-whisper `large-v3` cuantizado a int8_float16** en `ubuntu-lan`, servido por un endpoint
compatible con la API de OpenAI en `:9000` (`~/whisper-server/`, arranca con `run.sh`). La
cuantización es lo que lo hace caber: fp16 pide ~10GB y la RTX 3060 Laptop tiene 6.
**Medido con verdad conocida**, no asumido:

| | esperado → obtenido |
|---|---|
| Español | *"...guarda los embeddings en Postgres..."* → idéntico salvo dos nombres propios que el TTS pronunció mal |
| Inglés | idéntico carácter por carácter (`prob 0.999`) |
| Mezcla es/en | *"Le metí un deploy al backend y el pipeline de embeddings..."* → idéntico |

`audioTranscriptionHandler` usa `WHISPER_BASE_URL` / `WHISPER_MODEL` y **ya no tiene fallback
simulado**: sin configuración, o con respuesta vacía, lanza. El fallo se propaga como
degradación en vez de guardarse como transcripción.
**Gap operativo:** el servidor corre con `setsid`, no como servicio; no sobrevive a un reinicio
de la laptop. Encaja en [B17](#b17).

<details><summary>Diagnóstico original</summary>
**Archivo:** [src/workers/ingestion/handlers/audioTranscriptionHandler.ts:89](src/workers/ingestion/handlers/audioTranscriptionHandler.ts)
`executeTranscription` llama directo a `api.openai.com` con `OPENAI_API_KEY` — **sin pasar por
el proxy** — y esa variable no existe en `.env`. Todo audio devuelve literalmente
`[Transcripción Mock de Audio]`. Afecta a notas de voz, audios subidos, TikTok hablado y
YouTube sin auto-captions.
**Spike necesario:** decidir la ruta de transcripción entre
(a) `OPENAI_API_KEY` real contra Whisper,
(b) whisper.cpp / faster-whisper local,
(c) audio nativo a un Gemini multimodal a través de cliproxyapi.
**Dato verificado (2026-08-08):** el proxy **no expone `/v1/audio/transcriptions`** ni sirve
ningún modelo tipo whisper — así que la opción (c) solo es viable pasando el audio como parte
multimodal de `/v1/chat/completions` a un Gemini 3.x, no por el endpoint de transcripción.
Sin esta decisión no se puede planear el resto de la ingesta multimodal.
</details>

### B24. Las etapas posteriores borraban la marca de degradación 🟢 HECHO (2026-08-09)
Encontrado end-to-end, no por los tests: el worker de ingesta escribía el motivo en
`captured_items.error` y luego **embedding y graph hacían `error: null` al terminar con éxito**,
borrando el único rastro de que un ítem se ingirió incompleto. La lógica de marcado era correcta
en aislamiento todo el tiempo; el ítem acababa pareciendo completo.
Cubierto por [tests/degradationSurvives.test.ts](tests/degradationSurvives.test.ts), con control
positivo sobre el worker de ingesta para que el guard no sea vacío.

---

### ~~B14. `generateStructured` está roto: el proxy ignora `response_format`~~ ✅ HECHO (2026-08-08)
[structuredOutput.ts](src/core/llm/structuredOutput.ts) nuevo, usado por ambos proveedores:
el esquema JSON se pide **también en el prompt**, la respuesta se extrae con tolerancia
(bloques ```json, JSON incrustado en prosa, llaves y comillas escapadas dentro de strings), se
**valida contra el esquema Zod**, y hay un turno de reparación antes de rendirse.
**Segundo bug encontrado de paso:** el código hacía `JSON.parse(content) as T` **sin validar**,
así que un JSON con la forma equivocada pasaba como si estuviera comprobado. Ahora `safeParse`
decide, y si falla se lanza.
**Verificado en el pipeline real** (los mismos 4 links que fallaron): categorías reales
—`Documentation`, `Tutorial`, `Entertainment`— con sus tags, en vez de `Unknown` en todos.
Cubierto por [tests/structuredOutput.test.ts](tests/structuredOutput.test.ts), incluido el caso
exacto del bug (`**Category**: Tutorial`) y el JSON válido de forma incorrecta.

### B16. Un ítem sin contenido real igual se categoriza 🟢 NUEVO
En la prueba, el link de Instagram (31 chars, solo la URL cruda porque no hay handler) salió
categorizado como `Entertainment` con tags `nasa, space, astronomy`. El agente clasificó **la
URL**, no el contenido. El ítem parece procesado cuando no se ingirió nada.
**Solución:** exigir un mínimo de contenido antes de categorizar, y marcar el resto como
no ingerido en vez de dejar que herede una categoría inventada a partir de la URL.

<details><summary>Diagnóstico original</summary>
**Descubierto probando el worker real el 2026-08-08**, no por los tests.
[CLIProxyProvider.ts:134](src/core/llm/providers/CLIProxyProvider.ts) manda
`response_format: zodResponseFormat(...)` (el `json_schema` de OpenAI). cliproxyapi/Gemini lo
**ignora** y responde en Markdown, así que el `JSON.parse` revienta:
```
Unexpected token '*', "**Category"... is not valid JSON
```
Afecta a **los cuatro** consumidores de salida estructurada:
[categorizationAgent.ts:29](src/agents/categorizationAgent.ts),
[factCheckerAgent.ts:40 y :92](src/agents/factCheckerAgent.ts),
[graphExtractionService.ts:21](src/services/graphExtractionService.ts).
**Impacto medido:** los 6 ítems de la prueba quedaron con `category = 'Unknown'`. Y como el
fact-checking está condicionado a que la categoría sea News/Opinion/Tutorial, **nunca se
ejecuta**. La extracción de grafo cae igual. Todo en silencio: el ítem termina en `extracted`.
**Spike necesario:** decidir entre pedir JSON por prompt y parsear con tolerancia, usar el
`json_schema` solo con modelos que lo soporten, o reintentar con reparación. Es la misma familia
de bug que B2: una función que parece funcionar y no produce nada útil.

### B15. El scraper de TikTok se rate-limitea sin reintentos 🟢 NUEVO
Durante la prueba del worker el carrusel falló y cayó al fallback degradado; minutos después la
misma llamada devolvió las 8 imágenes. La causa fue rate-limiting de TikTok tras varias llamadas
seguidas (`GetUserPosts` llegó a agotar 10 reintentos con "Empty response").
El encadenamiento se comportó bien — degradó, lo marcó y no tumbó el pipeline — pero
[tiktokCarouselHandler.ts](src/workers/ingestion/handlers/tiktokCarouselHandler.ts) necesita
reintento con backoff antes de rendirse.

## P1 — Rutas muertas y capacidades base

### B4. Instagram, X, LinkedIn, Reddit, GitHub y PDFs-por-URL no se procesan 🟡
**Archivo:** [src/workers/ingestion/worker.ts:64](src/workers/ingestion/worker.ts)
`detectSource` los etiqueta correctamente ([telegramCaptureService.ts:29](src/bot/telegramCaptureService.ts))
pero la condición de la rama web los excluye explícitamente y no existe rama propia para ellos
→ caen al `else` de la línea 90 (*"unhandled source type"*) y se guardan como texto crudo.
Facebook ni siquiera está en `detectSource`.
**Solución conocida para el routing:** X, Reddit y GitHub tienen HTML servible; basta con
sacarlos de la lista de exclusión para que pasen por Readability. Lo que hay *detrás* de la
rama de Instagram y Facebook es otro problema (ver B8).

### ~~B5. Las imágenes no se capturan en absoluto — no hay OCR~~ ✅ HECHO (2026-08-08)
`bot.on('message:photo')` toma la rendición más grande que envía Telegram y la encola;
[photoHandler.ts](src/workers/ingestion/handlers/photoHandler.ts) la descarga y la lee con
[ImageAnalysisService](src/services/imageAnalysisService.ts), que pide transcripción literal del
texto **y** descripción visual en la misma llamada. **Sin Tesseract: el tier vision hace el OCR.**
El caption viaja como contexto y como título.
**No verificado end-to-end**: requiere mandar una foto real por Telegram. La lógica está cubierta
por [tests/imageIngestion.test.ts](tests/imageIngestion.test.ts), incluida la limpieza del
temporal cuando el análisis falla.

<details><summary>Diagnóstico original</summary>
**Archivo:** [src/bot/index.ts](src/bot/index.ts)
El bot escucha `text`, `document`, `audio` y `voice`. **No hay `bot.on('message:photo')`**:
mandas una foto y no se guarda ni se responde nada. No existe OCR en ningún punto del repo;
la única capacidad visual es el vision LLM sobre keyframes de video.
**Solución:** handler `message:photo` → descarga por `file_id` → `imageAnalysisHandler` que
mande la imagen al tier `vision` con un prompt que extraiga tanto la descripción como el texto
literal visible. Un vision LLM moderno cubre el caso OCR sin librería aparte.
**Depende de B2.**
</details>

---

## P1.5 — El tablón: lo que falta para que la UI sea la vista principal

*Auditado el 2026-08-08 levantando el dashboard de verdad y mirándolo.* Lo que **ya funciona**:
tarjetas con badges de fuente/categoría/estado de pipeline, filtros por categoría, buscador,
panel de detalle con texto extraído completo, sección de fact-checking con fuentes de Tavily, y
el Graph Explorer con su grafo force-directed. El carrusel de TikTok se ve con su transcripción.

### B17. Arrancar el sistema requiere 5 procesos a mano 🟢
`npm start` (bot), `npm run worker`, `worker:embedding`, `worker:graph`, y `npm run dev` en
`frontend/`. No hay orquestación. **Pasó en la auditoría**: olvidé el worker de grafo y el
Graph Explorer salía vacío con "No nodes or relations found" — el mensaje no dice cuál de los
cinco procesos falta.
**Solución:** un `npm run dev:all` (concurrently) o añadir los workers al `docker-compose.yml`.

### B18. El frontend no tiene `.env` propio 🟢
Next.js solo lee variables del directorio del proyecto, así que `DATABASE_URL` llegaba vacío y
`/api/items` habría devuelto 500. Se creó `frontend/.env.local` a mano durante la auditoría.
**Solución:** un `frontend/.env.example` versionado y una nota en el README; hoy nadie que clone
el repo puede arrancar la UI sin descubrir esto por su cuenta.

### B19. El tablón no se refresca solo ni muestra imágenes 🟢
Dos huecos para que se sienta un tablón de noticias:
- **Sin refresco automático**: hay que recargar la página para ver lo que acaba de llegar.
  Falta polling o SSE.
- **Sin imágenes**: el carrusel de TikTok se lee y se transcribe, pero en la UI solo se ve el
  texto. No se guarda ninguna miniatura ni las imágenes originales, así que un tablón de
  contenido visual se ve como un muro de párrafos.

### B23. La síntesis rellena con conocimiento del modelo, sin marcar qué vino del video 🟡 NUEVO
*Observado el 2026-08-09* ingiriendo un TikTok de **7 segundos**
(`@sebas.soto222/video/7667367088930999566`). La entrada resultante tiene **5873 caracteres**,
con tablas explicando qué hace cada herramienta, una sección de "Key Concepts" que nombra una
filosofía ("Zero-to-One Lean Stack") y cuatro conclusiones.
El video solo mostraba una lista de nombres en pantalla. **Casi todo el texto es conocimiento
del modelo, no contenido del video**, y nada lo distingue. En una base de conocimiento personal
eso es peligroso: se relee dentro de un año como si el video lo hubiera dicho.
La causa está en el prompt de [ingestionAgent.ts](src/agents/ingestionAgent.ts), que pide
*"highly detailed, comprehensive"* — eso invita a rellenar.
**Solución:** pedir fidelidad a la fuente, y separar explícitamente lo observado de lo inferido
(p. ej. una sección "Contexto añadido por el asistente" claramente marcada).

### B21. El fact-checker verifica el artefacto, no el contenido 🟡 NUEVO
*Observado en el dashboard el 2026-08-09.* Sobre el carrusel de TikTok, las 3 afirmaciones
extraídas fueron sobre el **documento**, no sobre lo que el documento dice:
- *"The document describes an 8-slide presentation detailing seven UI design styles"* → **FALSE**
  (porque la búsqueda web no encuentra ese carrusel, claro)
- *"The mock interface text described in Slide 7 references 'Apple iOS26'"* → INCONCLUSIVE
- *"Slide 5 contains references to an event called 'ONE&ALL 2019'"* → INCONCLUSIVE

Verificar contra búsqueda web una afirmación sobre la existencia del propio ítem no puede dar
otra cosa. Lo útil sería extraer afirmaciones **fácticas del contenido** ("el glassmorfismo usa
transparencia y desenfoque", "iOS 26 introduce Liquid Glass") y verificar esas.
**Solución:** ajustar el prompt de extracción de claims para exigir afirmaciones verificables
sobre el mundo, y descartar las meta-afirmaciones sobre el propio documento. Añadir un umbral
que omita el fact-checking cuando no salga ninguna afirmación de ese tipo.

### B22. Un ítem en `error` se ve igual que uno pendiente 🟢 NUEVO
El link de Facebook falló la extracción (comportamiento correcto y nuevo), pero en el dashboard
aparece con el badge `Captured` — el mismo que un ítem recién llegado. No hay indicación de
fallo ni se muestra el mensaje de la columna `error`.
**Solución:** un badge de estado `Error` distinguible y mostrar el motivo en el panel de detalle.
Esto también hará visible el `degradedReason` de los ítems parcialmente ingeridos.

### B20. El RAG solo existe en Telegram 🟢
`/ask` no está expuesto en la web. El buscador del dashboard filtra por texto en cliente, no usa
los embeddings. La búsqueda semántica ya funciona ([B13](#b13)) — falta un endpoint y una caja
de preguntas.

## P2 — Cobertura de formatos

### ~~B6. Carruseles de imágenes de TikTok no se entienden~~ ✅ HECHO (2026-08-08)
[tiktokCarouselHandler.ts](src/workers/ingestion/handlers/tiktokCarouselHandler.ts) nuevo. El
worker ya no manda los `Unsupported URL` de TikTok a extracción web: prueba el carrusel primero
y solo cae a metadatos si eso también falla (marcándolo como degradado). Tope de 12 diapositivas,
**registrado en el log, no truncado en silencio**.
Se corrigió además el mime fijo `image/jpeg` de ambos proveedores: ahora se deriva de la
extensión con [imageMime.ts](src/utils/media/imageMime.ts), porque TikTok sirve webp.
**Verificado end-to-end con el carrusel real**: 8 diapositivas descargadas y leídas, con
transcripción literal ("SI CREAS UN APP O WEB", "7 ESTILOS DE UI QUE DEBES USAR") más descripción
del fondo. Cubierto por [tests/imageIngestion.test.ts](tests/imageIngestion.test.ts), que además
comprueba que no se filtran temporales al disco.

<details><summary>Diagnóstico original</summary>
**Probado end-to-end el 2026-08-08** sobre un carrusel real (`vt.tiktok.com/ZSC3gB3rQ`, que
resuelve a una URL `/photo/` y por eso yt-dlp la rechaza):
1. `@tobyg74/tiktok-api-dl` (v1) devolvió el caption y **las 8 URLs de imagen**.
2. Se descargaron 4 diapositivas (1080x1918 webp) y se pasaron al tier `vision`.
3. El modelo **transcribió literalmente el texto de cada diapositiva** ("GLASSMORFISMO —
   transparencia y blur con sensación de vidrio esmerilado", etc.) y resumió el carrusel.

O sea: la capacidad está confirmada, **solo falta cablearla**. El trabajo es un handler que
detecte `/photo/`, llame a `tiktok-api-dl`, baje las imágenes y las mande al tier `vision`.
**Ojo con el formato:** las imágenes vienen en **webp** y ambos proveedores construyen el data
URI con `data:image/jpeg;base64` fijo ([CLIProxyProvider.ts:89](src/core/llm/providers/CLIProxyProvider.ts),
[OpenRouterProvider.ts:80](src/core/llm/providers/OpenRouterProvider.ts)). En la prueba se
convirtieron a JPEG antes de enviarlas, así que ese literal **no está validado con webp** —
hay que derivar el mime de la extensión o convertir en el handler.

<details><summary>Diagnóstico original</summary>
**Archivo:** [src/workers/ingestion/worker.ts:53](src/workers/ingestion/worker.ts)
yt-dlp devuelve `Unsupported URL` y el fallback va a `webExtractionHandler`, que hace un `fetch`
plano; TikTok responde con muro JS, Readability devuelve null y solo sobrevive el `og:description`.
Las imágenes del carrusel nunca se descargan ni se analizan.
**Solución parcial:** `@tobyg74/tiktok-api-dl` ya está en `package.json` y hay un scratch de
prueba ([scratch_test_tiktok_dl.ts](scratch_test_tiktok_dl.ts)) — falta cablearlo a un handler
que baje cada imagen y la pase por el mismo `imageAnalysisHandler` de B5.
**Riesgo:** es un scraper no oficial; conviene medir su tasa de éxito antes de depender de él.
**Depende de B5.**
</details>

### B7. Solo 5 keyframes por video, sin importar la duración 🟢
**Archivo:** [src/utils/media/ytDlpWrapper.ts:121](src/utils/media/ytDlpWrapper.ts)
Un TikTok de puro texto con 10 pantallas pierde la mitad del contenido; un video de 40 min se
resume con 5 imágenes.
**Solución:** densidad adaptativa por duración (con techo por costo de tokens), y para
contenido con mucho texto en pantalla, detección de cambio de escena en vez de intervalo fijo.

### B8. Los subtítulos solo se intentan en YouTube 🟢
**Archivo:** [src/utils/media/ytDlpWrapper.ts:60](src/utils/media/ytDlpWrapper.ts)
El check `isYoutube` hace que TikTok siempre baje audio, aunque yt-dlp a veces exponga
subtítulos/captions incrustados. Con B3 en mock, esto agrava el problema.
**Solución:** intentar el fast-path de subtítulos para cualquier fuente y caer a audio solo si
no hay.

### B9. PDFs y documentos subidos nunca se parsean 🟢
Se guarda el `file_id` de Telegram pero el worker no tiene rama para `type === 'file'` o `'pdf'`.
**Solución:** handler que descargue el archivo y extraiga texto con `unpdf` o `pdf-parse`;
para PDFs escaneados, caer al pipeline de visión de B5.

---

## P3 — Costoso, frágil o higiene

### ~~B10. Instagram y Facebook necesitan sesión~~ ✅ HECHO (2026-08-09) — la premisa era falsa
[metaPostHandler.ts](src/workers/ingestion/handlers/metaPostHandler.ts) +
[ogTags.ts](src/utils/media/ogTags.ts). Pide el post con UA de crawler, extrae el caption de los
`og:` y **manda `og:image` al tier de visión**, que ya hacía OCR.
**Verificado por la cola real:**

| | resultado |
|---|---|
| Post de Instagram | `graph_extracted`, **3516 chars**, imagen leída, sin degradar |
| Post de Facebook | `graph_extracted`, **1443 chars**, imagen leída, sin degradar |
| URL de perfil | **rechazada** con un mensaje explícito, en vez de guardar la biografía como si fuera un post |

**Bug encontrado al probarlo, misma familia que el del webp:** el `og:image` de Facebook apunta
a una ruta `.png` cuyos **bytes son JPEG**. Deducir la extensión de la URL producía un data URI
que declaraba un tipo que el contenido no tenía, y el modelo lo rechazaba (Facebook salía con
256 chars y degradado). Ahora manda el `Content-Type` servido, no la ruta.

<details><summary>Cómo se descubrió que la premisa era falsa</summary>
**La afirmación anterior de este backlog era falsa** y venía de un error de método: se probaron
URLs de **perfil** (`instagram.com/nasa/`, `facebook.com/nasa/`), que son feeds renderizados por
JS, y se concluyó que hacía falta sesión. Un **post individual** es otra cosa: Meta tiene que
servir metadatos en el HTML inicial para que WhatsApp, Twitter y iMessage pinten la tarjeta de
previsualización.

Probado sin cookies ni sesión, con `User-Agent: facebookexternalhit/1.1`:

| | resultado |
|---|---|
| `instagram.com/p/DbvghjnkxeH/` | `og:title` con el caption completo, `og:description` con likes/comentarios/fecha, `og:image` con la URL real de la imagen |
| `facebook.com/NASA/posts/pfbid02…` | `og:description` con el texto del post, `og:image` con su imagen |

**Detalle clave:** con un UA de navegador normal **no** hay `og:` tags (Instagram devuelve 610KB
de JS sin metadatos). Meta los sirve solo a user-agents de crawler. Es el mismo mecanismo que
usa cualquier generador de previsualizaciones.

**Ruta implementable, sin spike:** handler que pida el post con UA de crawler, extraiga
`og:title`/`og:description` como texto y **pase `og:image` al tier de visión**, que ya existe
([ImageAnalysisService](src/services/imageAnalysisService.ts)) y ya hace OCR. Eso da caption
+ lectura de la imagen, que para un post de Instagram es prácticamente todo el contenido.

**Límites honestos:** solo el primer medio de un carrusel; sin comentarios; sin video; y depende
de que Meta siga sirviendo metadatos por UA — si lo cambian, se rompe. Los **feeds de perfil**
siguen sin ser accesibles, y eso no cambia.
</details>

### B11. `.-@` dentro de la clase de caracteres del validador es un rango no intencionado 🟢
**Archivo:** [src/utils/media/urlValidator.ts:8](src/utils/media/urlValidator.ts)
`[a-zA-Z0-9_?=&/.-@%]` interpreta `.-@` como rango 0x2E–0x40, colando `: ; < = > ?`.
No es explotable (yt-dlp usa `execFile` sin shell y el blacklist atrapa `;`), pero es un
descuido que conviene escapar: `[a-zA-Z0-9_?=&/.\-@%]`.

### ~~B12. No hay comando de test, lint ni typecheck~~ ✅ HECHO en parte (2026-08-08)
`npm run typecheck` (`tsc --noEmit`) en verde con `strict` intacto y sin ninguna directiva de
supresión; los 8 errores se resolvieron con `@types/pg` y tipando las filas de las tres
consultas de [ragService.ts](src/services/ragService.ts). `npm run test` ejecuta vitest.
`rein verify` ahora reporta `test [ok]` y `typecheck [ok]`.
**Queda pendiente:** `lint` sigue en `missingCommands`.
