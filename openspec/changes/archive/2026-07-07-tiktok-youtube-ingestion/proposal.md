## Why

El sistema actual carece de la habilidad de ingerir videos de redes sociales (YouTube y TikTok), ya que el `webExtractionHandler` basado en JSDOM no puede descargar multimedia ni lidiar con las barreras de estas plataformas. Esta característica se pospuso en la Fase 1, pero es crítica para capturar contenido rico (podcasts de YT, tutoriales de TikTok) y procesarlo de manera agéntica.

## What Changes

- **Integración de `youtube-dl-exec` y `ffmpeg`** para descargar audio, metadatos y extraer fotogramas clave de YouTube y TikTok.
- **Seguridad y Estabilidad**: Implementación de sanitización estricta de URLs (Regex), Rate Limiting en BullMQ, uso de Streams en vez de Buffers para evitar OOM, y limpieza de archivos temporales.
- **Soporte de Subtítulos**: Parseo de subtítulos autogenerados (VTT a texto plano) para ahorrar costos de transcripción en YouTube.
- **Ingestión Multimodal (LangGraph)**: El worker invocará a un nuevo Agente que orquestará tanto modelos de audio como de Visión para sintetizar el conocimiento combinando lo que se "escucha" y lo que se "ve".
- **Refactorización de `audioTranscriptionHandler`** para soportar archivos genéricos locales en streams.

## Capabilities

### New Capabilities
- `social-media-ingestion`: Descarga de metadatos, subtítulos y audio de TikTok y YouTube de manera confiable usando `yt-dlp` sin requerir cookies o sesiones.

### Modified Capabilities
- `audio-transcription`: Se abstraerá la llamada a Whisper para soportar archivos genéricos locales en lugar de estar fuertemente acoplada a la API de Telegram.

## Impact

- **Workers de Ingestión**: Se añadirán binarios de dependencias externas (yt-dlp, ffmpeg) en el entorno de ejecución (Docker/Host).
- **Consumo de Tokens**: Los videos muy largos de YouTube sin subtítulos podrían generar archivos pesados que excedan el límite de Whisper (25MB) o el tiempo máximo del worker, requiriendo chunking o validación de tamaño.
- **Ruteo**: El `worker.ts` cambiará su lógica de enrutamiento basado en la detección de URL.
