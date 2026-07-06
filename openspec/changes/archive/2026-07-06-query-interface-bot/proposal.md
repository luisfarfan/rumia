## Why

Para que la plataforma sea útil, el usuario necesita poder hacer preguntas sobre lo que ha guardado. La interfaz más natural y con menor fricción es el mismo bot de Telegram que ya usa para capturar.

## What Changes

- Añadir comandos de Telegram como `/ask <pregunta>`.
- Implementar un flujo de LangChain/LangGraph que reciba la pregunta, busque en la base de conocimientos (Vectores + Grafo) y genere una respuesta.

## Capabilities

### New Capabilities
- `natural-language-query`: Capacidad de recibir y parsear preguntas en lenguaje natural en Telegram.
- `answer-generation`: Generación de respuestas sintetizadas usando contexto (RAG).

### Modified Capabilities

## Impact
- **Telegram Bot**: Se añadirán nuevos comandos (`/ask`).
- **Costos**: Cada consulta generará un hit a la API de embeddings y de completación de LLM (ej. GPT-4o).
