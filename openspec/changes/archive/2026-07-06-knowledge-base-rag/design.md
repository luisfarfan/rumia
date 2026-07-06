## Context

Extraer un Knowledge Graph mejora radicalmente la calidad de respuestas complejas comparado con un RAG puro. Queremos usar PostgreSQL para ambas cosas (Vector + Graph) para no añadir bases de datos de grafos pesadas como Neo4j por ahora.

## Goals / Non-Goals

**Goals:**
- Diseñar tablas de Postgres para representar Nodos y Relaciones.
- Escribir prompts estructurados (Zod) para que un LLM extraiga entidades de los `CapturedItem`.
- Guardar entidades relacionándolas al documento origen.
- Actualizar el estado del ítem a `graph_extracted`.

**Non-Goals:**
- Neo4j no se usará. Implementaremos grafos básicos en SQL.

## Decisions
- **Esquema de Grafo**: 
  - `nodes`: `id`, `label`, `name`, `properties` (JSONB)
  - `edges`: `id`, `source_node`, `target_node`, `type`, `properties` (JSONB)
- **Método de Extracción**: OpenAI `gpt-4o-mini` con Structured Outputs (JSON Schema / Zod) para asegurar que siempre devuelva arrays de Nodos y Relaciones parseables.
- **Entity Resolution**: Para evitar duplicados ("Elon Musk" vs "Elon"), antes de insertar un nuevo nodo, se calculará su embedding de texto (usando el nombre) o se usará similitud trigram/vectorial para ver si ya existe. Si existe (similitud > 0.9), reutilizamos su ID y le agregamos la relación, de lo contrario, creamos uno nuevo.

## Risks / Trade-offs
- **Consistencia de Entidades**: El LLM puede nombrar mal las entidades. **Mitigación**: El Entity Resolution Step (similitud semántica de nombres) mitigará fuertemente los nodos fragmentados.
