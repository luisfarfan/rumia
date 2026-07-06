## Why

Una vez extraído el texto en crudo de los artículos web y audios (Fase 2), ese texto suele ser demasiado extenso para pasarlo a un modelo de lenguaje de una sola vez. Necesitamos dividir el contenido en "chunks" más pequeños y semánticos, y luego convertirlos a representaciones numéricas (embeddings) para poder realizar búsquedas de similitud después.

## What Changes

- Implementación de un proceso de división de texto (chunking).
- Integración con API de OpenAI (u otra) para generar embeddings.
- Configuración de la extensión `pgvector` en PostgreSQL.
- Creación de tabla/esquema para guardar los chunks con sus respectivos vectores.

## Capabilities

### New Capabilities
- `text-chunking`: División inteligente de texto largo en partes procesables, manteniendo contexto semántico.
- `vector-embeddings`: Generación y almacenamiento de embeddings en PostgreSQL usando pgvector.

### Modified Capabilities

## Impact
- **Base de Datos**: Se activará la extensión `pgvector`.
- **Dependencias**: Se integrará SDK de LLM (ej. `openai`) para la generación de embeddings.
- **Costos**: Generar embeddings incurre en costo de API.
