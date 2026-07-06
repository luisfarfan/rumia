## 1. Setup e Infraestructura

- [x] 1.1 Instalar dependencias: `bullmq`, `ioredis`, `@mozilla/readability`, `jsdom`, y sus respectivos `@types`.
- [x] 1.2 Configurar conexión a Redis (`src/config/redis.ts` o similar).
- [x] 1.3 Verificar esquema de base de datos (`captured_items`) para asegurarse de que tenemos campos para guardar el contenido extraído (ej. `content` o metadata adicional). Si no, crear una migración.

## 2. Core Worker y Colas

- [x] 2.1 Crear instancia de `Queue` para `ingestionQueue`.
- [x] 2.2 Crear el `Worker` principal (dispatcher) que escuche `ingestionQueue`.
- [x] 2.3 Implementar lógica de ruteo en el dispatcher basado en `sourceType` (url, audio, etc.).
- [x] 2.4 Actualizar `CaptureService` para que encole un job en `ingestionQueue` justo después de guardar un item en PostgreSQL.

## 3. Handlers Específicos

- [x] 3.1 Implementar `webExtractionHandler` que use `@mozilla/readability` y `jsdom` para descargar y extraer texto limpio de una URL.
- [x] 3.2 Implementar estructura de `audioTranscriptionHandler` (descarga del archivo desde Telegram). La transcripción con Whisper se puede dejar como un mock inicial o implementarla si se dispone de la API Key.

## 4. Persistencia y Estados

- [x] 4.1 Implementar lógica en los handlers para actualizar el estado del `captured_items` a `extracted` en caso de éxito.
- [x] 4.2 Guardar el contenido extraído (texto o transcripción) en la base de datos asociado al item.
- [x] 4.3 Manejo de errores: si el handler falla después de los reintentos, marcar el item como `error` en la base de datos.
