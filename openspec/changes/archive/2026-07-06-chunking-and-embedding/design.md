## Context

Tenemos el contenido crudo procesado. Para habilitar Búsqueda Semántica (RAG) necesitamos vectores. PostgreSQL nos permite usar `pgvector`, lo que evita la necesidad de una base de datos vectorial externa como Pinecone o Weaviate, manteniendo la simplicidad.

## Goals / Non-Goals

**Goals:**
- Activar `pgvector` y crear tabla `item_chunks`.
- Implementar una utilidad de "Semantic Chunking" o usar librerías como LangChain (text splitters).
- Hacer que un worker asíncrono tome los items en estado `extracted`, los parta y pida embeddings.
- Al terminar, actualizar el estado del ítem a `chunked_and_embedded`.

**Non-Goals:**
- Búsqueda RAG o interfaces de usuario (se hará después).
- Extracción de entidades y Knowledge Graph (eso pertenece a la fase 4).

## Decisions
- **Estrategia de Chunking**: Usaremos un RecursiveCharacterTextSplitter inicial, cortando por párrafos para mantener sentido semántico. 
- **Base de Datos**: Extensión `pgvector` en Postgres con índice HNSW o IVFFlat para búsqueda rápida en el futuro.
- **Modelo de Embeddings**: `text-embedding-3-small` de OpenAI por su relación costo-beneficio.

## Risks / Trade-offs
- **Límites de API (Rate Limits)**: OpenAI puede limitar si mandamos demasiados chunks de golpe. **Mitigación**: BullMQ con concurrencia controlada, enviar los chunks en batches para la API de embeddings, y llevar un registro de progreso en DB o en el payload del Job para ser idempotentes y evitar re-procesar todo un artículo larguísimo si falla al 90%.
