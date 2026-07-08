## Context

El proyecto `autodiscovery-wiki` captura enlaces y archivos multimedia a través de Telegram y los procesa usando una arquitectura de agentes (LangGraph). Actualmente tenemos el `FactCheckerAgent` implementado y capaz de guardar verificaciones de confiabilidad en PostgreSQL (`claim_verifications`), pero no está integrado al flujo principal de ingestión. Adicionalmente, los ítems carecen de categorización (tags/category) para facilitar su búsqueda, y la interfaz en Next.js no expone estos datos al usuario.

## Goals / Non-Goals

**Goals:**
- Añadir metadatos semánticos (`category` estricta, `tags` libres) a todos los ítems que ingresen al sistema mediante un nuevo `CategorizationAgent`.
- Ejecutar el `CategorizationAgent` y el `FactCheckerAgent` automáticamente durante la ingestión (BullMQ).
- Modificar la UI (Next.js) para renderizar `categories`, `tags` y el estado de los `claims` evaluados (Reliability Dashboard).

**Non-Goals:**
- No implementaremos un sistema de búsqueda compleja por tags en el backend en esta fase (nos limitaremos a mostrar la data en la UI).
- No re-procesaremos los ítems antiguos en la BD, solo se aplicará a los nuevos.
- No modificaremos el `FactCheckerAgent` internamente, solo su invocación.

## Decisions

- **Arquitectura de Categorización:** Se creará un `CategorizationAgent` usando `generateStructured` de LangChain. Se utilizará una lista de categorías fijas (ej: `News`, `Tutorial`, `Opinion`, `Entertainment`, `Documentation`, `Other`) para garantizar consistencia, y se permitirá un arreglo de `tags` libres para mayor granularidad. *¿Por qué?* Evita la fragmentación de categorías principales, manteniendo la flexibilidad semántica.
- **Flujo Condicional y Resiliente en BullMQ:** Una vez que la extracción termine, el `worker.ts` truncará el texto (máximo 8k caracteres) y lo enviará al `CategorizationAgent`. Luego, el `FactCheckerAgent` **solo se ejecutará** si la categoría asignada es propensa a datos verificables (`News`, `Opinion`, `Tutorial`, `Educational`). Todo esto correrá dentro de bloques `try/catch` "suaves"; si los LLMs o Tavily fallan (ej. proxy 502), el error se logueará pero el ítem continuará hacia el guardado y `embeddingQueue`. *¿Por qué?* Ahorra tokens, dinero (Tavily), evita cuellos de botella y garantiza que un fallo externo no destruya el pipeline entero.
- **Modelo de Datos:** Añadiremos `category (VARCHAR)` y `tags (JSONB)` a `captured_items`.
- **API y Frontend:** El endpoint `/api/items` se modificará para hacer un `LEFT JOIN` con `claim_verifications`. En la UI, implementaremos un panel lateral para Fact-Checking y **botones de filtro interactivos** en la barra superior para alternar vistas por Categoría.

## Risks / Trade-offs

- **[Risk] Aumento del tiempo de procesamiento:** Llamadas a LLMs incrementarán la latencia del worker.
  - **Mitigation:** Uso de modelos rápidos (`flash`), límite de caracteres en el texto de entrada y fact-checking condicional.
- **[Risk] Fallos en APIs externas bloqueando el flujo:**
  - **Mitigation:** Implementar bloques `try/catch` con fallback a `category = 'Unknown'` y tags vacíos, permitiendo que el ítem avance a la base de datos de todas formas.
