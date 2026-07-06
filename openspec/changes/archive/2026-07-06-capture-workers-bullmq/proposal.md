## Why

Con la Fase 1 completada, nuestro sistema es capaz de recibir y persistir contenido en PostgreSQL con estado `received`. Ahora necesitamos procesar este contenido en segundo plano para no bloquear el bot y permitir reintentos en caso de fallos. BullMQ con Redis es la solución elegida por su madurez, velocidad y capacidades de orquestación visual.

## What Changes

- Integración de Redis y configuración de BullMQ.
- Creación de un `Worker` principal (dispatcher) que encola trabajos para procesar items en estado `received`.
- Creación de workers especializados para:
  - Extracción de artículos web (usando Readability o similar).
  - Transcripción de audios (usando un API como OpenAI Whisper o similar).
- Actualización del estado de los `CapturedItem` en PostgreSQL de `received` a `processed` o `error`.

## Capabilities

### New Capabilities
- `async-processing`: Sistema base de colas con BullMQ para procesar items asincrónicamente y manejar reintentos.
- `web-extraction`: Capacidad de descargar y extraer el texto limpio de enlaces a artículos web.
- `audio-transcription`: Capacidad de descargar y transcribir notas de voz/audios de Telegram.

### Modified Capabilities

## Impact

- **Infraestructura**: Se requiere correr Redis localmente y en producción.
- **Base de Datos**: Se actualizará el registro de `captured_items` con el texto extraído y cambios de estado.
- **Dependencias**: Nuevas dependencias `bullmq`, `ioredis`, y librerías para scraping (ej. `jsdom`, `@mozilla/readability`).
