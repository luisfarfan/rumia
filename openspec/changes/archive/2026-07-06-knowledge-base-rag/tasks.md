## 1. Esquema de Base de Datos
- [x] 1.1 Crear migración para tablas `nodes` y `edges`.
- [x] 1.2 Añadir índices para búsquedas rápidas de grafos en SQL y pgvector/trgm para nombres de nodos.

## 2. LLM Extraction y Entity Resolution
- [x] 2.1 Definir esquema de Zod para `GraphExtractionResult` (nodes, edges).
- [x] 2.2 Implementar servicio que llama a OpenAI con Structured Outputs.
- [x] 2.3 Implementar servicio de `EntityResolution` que antes de insertar un nodo busque similaridad en PostgreSQL.
- [x] 2.4 Lógica para insertar/actualizar nodos en base de datos de manera robusta.

## 3. Integración
- [x] 3.1 Crear worker de BullMQ para `knowledgeGraphExtraction`.
- [x] 3.2 Enganchar a la cola solo los ítems con estado `chunked_and_embedded`.
- [x] 3.3 Actualizar estado del ítem a `graph_extracted` al finalizar.
