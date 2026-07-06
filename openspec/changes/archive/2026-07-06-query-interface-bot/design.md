## Context

El usuario interactúa con la plataforma primariamente por Telegram. Necesitamos un pipeline de RAG (Retrieval-Augmented Generation) para responder a sus dudas basado *exclusivamente* en sus documentos capturados.

## Goals / Non-Goals

**Goals:**
- Integrar LangChain/LangGraph para orquestar el flujo: Query -> Embed -> Search Vector -> Search Graph -> Synthesize Answer.
- Devolver respuesta formateada en Markdown por Telegram.
- Proveer citas (referencias) a los documentos originales usados para la respuesta.

**Non-Goals:**
- El bot no responderá preguntas usando su conocimiento general, solo usará la base de datos personal.

## Decisions
- **LLM para Respuesta**: OpenAI `gpt-4o-mini` por velocidad y costo.
- **Orquestador**: `LangChain` (JS/TS) para el pipeline de RAG.
- **Estrategia de Retrieval (Búsqueda Híbrida)**: Debido a que LangChain no tiene un retriever híbrido específico para nuestro Postgres+Graph, construiremos uno custom con este algoritmo:
  1. Extraer los top `K` (ej. 5) `item_chunks` más relevantes mediante similitud vectorial (cosine distance en pgvector).
  2. Extraer los nombres de los Nodos del grafo mencionados en esos chunks.
  3. Consultar la tabla `edges` en PostgreSQL para traer todos los vecinos de grado 1 de esos Nodos (contexto relacional).
  4. Inyectar todo (Texto de los chunks + Lista de relaciones en formato texto) al contexto del prompt final del LLM.

## Risks / Trade-offs
- **Alucinaciones**: El LLM podría inventar cosas. **Mitigación**: Prompt estricto: "Responde ÚNICAMENTE usando el contexto provisto".
