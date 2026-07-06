## 1. Telegram Bot
- [x] 1.1 Registrar el comando `/ask` en grammy.
- [x] 1.2 Añadir feedback de "Escribiendo..." mientras el LLM procesa.

## 2. RAG Pipeline Híbrido
- [x] 2.1 Implementar un Custom Retriever en LangChain.
- [x] 2.2 Lógica del Retriever: Buscar top K chunks usando similitud vectorial en Postgres (`pgvector`).
- [x] 2.3 Lógica del Retriever: A partir de los chunks devueltos, buscar sus nodos y aristas (vecinos grado 1) asociados en el Grafo de PostgreSQL.
- [x] 2.4 Crear el chain final (Prompt + LLM) para inyectar el contexto combinado (Texto de Chunks + Relaciones del Grafo) y la pregunta.
- [x] 2.5 Formatear respuesta con links a las fuentes (urls originales recuperadas).

## 3. Integración
- [x] 3.1 Conectar el comando de Telegram con el RAG Pipeline.
