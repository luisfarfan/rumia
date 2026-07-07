# Proposal: Token Usage Tracking System (Observability)

## 1. Description
A medida que la aplicación escala, se vuelve crítico entender exactamente cuántos tokens y dinero se están consumiendo por cada paso del pipeline. 
Este feature introduce un sistema de observabilidad detallado que interceptará todas las llamadas hechas desde el `LLMFactory` y registrará en la base de datos la cantidad de tokens consumidos, clasificados por: Flujo (ej. `rag_query`, `graph_extraction`), Sesión (ej. ID de usuario de Telegram) y Documento (`itemId`).

## 2. Motivation
* **Control de Costos**: Identificar qué fases (ej. extracción de grafos vs embeddings) están consumiendo más tokens.
* **Trazabilidad**: Poder saber exactamente qué proveedor (OpenRouter, CLIProxyAPI) y qué modelo específico se usó para una tarea en particular en un momento dado.
* **Facturación a Futuro**: Si en la Fase 7 (Dashboard) se implementan usuarios o límites, esta tabla será la base para cobrar o limitar el uso.

## 3. Scope
* **In Scope**:
    * Creación de tabla `token_usage` en PostgreSQL.
    * Actualización de la abstracción `LLMProvider` para aceptar metadata (`usageMeta`).
    * Implementación de la lógica de guardado en `CLIProxyProvider` y `OpenRouterProvider` analizando `response.usage` y `response.model`.
    * Propagación de metadatos desde los handlers (Telegram, BullMQ) hacia los servicios.
* **Out of Scope**:
    * Dashboards o gráficos en el frontend (eso pertenece al scope de `web-dashboard`). Este cambio es puramente backend (recolección de datos).

## 4. Risks & Mitigations
* **Impacto en Rendimiento**: Hacer un `INSERT` en PostgreSQL por cada llamada a LLM podría ralentizar los pipelines.
    * *Mitigación*: Se hará de forma asíncrona (`TokenUsageRepo.saveUsage` se llamará sin `await` dentro del provider, o se usará un sistema de colas, aunque al ser pocos request por segundo un `INSERT` asíncrono es más que suficiente).
* **Ausencia de datos de uso**: Algunos modelos o proxies pueden no retornar el campo `usage` en la API.
    * *Mitigación*: Se aplicarán defaults de `0` y se loggeará un warning si un proveedor no expone los tokens consumidos.
