## 1. Base de Datos
- [x] 1.1 Crear migración para habilitar la extensión `vector`.
- [x] 1.2 Crear tabla `item_chunks` con columnas: `id`, `item_id`, `chunk_index`, `content`, `embedding` (tipo vector).

## 2. Lógica de Negocio
- [x] 2.1 Instalar dependencias necesarias (ej. `openai`, `langchain` si se usa para splitters).
- [x] 2.2 Crear el servicio de `ChunkingService` para partir textos.
- [x] 2.3 Crear servicio `EmbeddingService` para interactuar con OpenAI (con soporte de batches).

## 3. Worker y Orquestación
- [x] 3.1 Crear el handler de BullMQ para este paso (`embeddingHandler`).
- [x] 3.2 Lógica idempotente: el handler debe leer si ya existen chunks en `item_chunks` para el ítem antes de llamar a OpenAI.
- [x] 3.3 Enganchar el éxito de la Fase 2 (cuando el estado es `extracted`) para que encole un job a la fase de chunking.
- [x] 3.4 Actualizar el estado del ítem a `chunked_and_embedded` al terminar exitosamente.
