## Why

Una base de datos vectorial permite búsquedas por similitud, pero pierde las relaciones explícitas (e.g., "Persona A es CEO de Empresa B"). Para construir un sistema experto, necesitamos extraer entidades y relaciones de nuestro contenido capturado, combinando un Knowledge Graph con Retrieval-Augmented Generation (RAG).

## What Changes

- Creación de esquema para un Knowledge Graph (Nodos y Aristas/Edges) en PostgreSQL.
- Implementación de un proceso (posiblemente un Agente o Worker de LLM) que lea el texto crudo y extraiga tripletas (Sujeto, Predicado, Objeto).
- Implementación de búsqueda híbrida (Vectorial + Grafos).

## Capabilities

### New Capabilities
- `knowledge-graph`: Extracción y almacenamiento de entidades y relaciones.
- `semantic-search`: Búsqueda híbrida combinando similitud de cosenos (vectores) y consultas de grafos.

### Modified Capabilities

## Impact
- **Base de Datos**: Nuevas tablas `nodes` y `edges`.
- **Dependencias**: Posible uso de `@langchain/graph` o herramientas de extracción estructurada de OpenAI.
