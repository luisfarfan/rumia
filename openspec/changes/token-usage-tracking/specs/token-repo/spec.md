# Specs: Token Repo & Interceptors

## 1. Database Updates (`src/db/schema.sql` y `src/db/tokenUsageRepo.ts`)
- Añadir el bloque `CREATE TABLE IF NOT EXISTS token_usage (...)`.
- Crear el repositorio `TokenUsageRepo` con el método `saveUsage`.
- Incluir un método `getAggregatedStats(groupBy: 'flow' | 'provider' | 'session_id')` que devuelva sumatorias (útil para el futuro Dashboard).

## 2. LLM Abstraction (`src/core/llm/types.ts`)
- Añadir el type `UsageMeta`.
- Actualizar todas las firmas de los métodos `generateCompletion`, `generateStructured` y `generateEmbeddings`.

## 3. Provider Implementations (`src/core/llm/providers/*`)
- En `CLIProxyProvider` y `OpenRouterProvider`, extraer `response.usage` y `response.model`.
- Si `options.usageMeta` existe, llamar a `TokenUsageRepo.saveUsage()` en background.
- Para Embeddings, el response también devuelve `.usage.prompt_tokens` y `response.model`, así que debe loggearse igual (con `completion_tokens = 0`).

## 4. Services Refactor
Propagar metadata en llamadas a la Factory:
- `embeddingService.ts`: `usageMeta: { flow: 'embedding', itemId: options?.itemId }` (Actualizar servicio para recibir itemId).
- `graphExtractionService.ts`: `usageMeta: { flow: 'graph_extraction', itemId }`.
- `factCheckerAgent.ts`: `usageMeta: { flow: 'fact_checking', itemId: state.itemId }`.
- `ragService.ts`: Modificar firma de `answerQuery(queryText, sessionId?)`. Usar `usageMeta: { flow: 'rag_query', sessionId }`.
- `bot/index.ts`: Modificar las llamadas a `RagService.answerQuery` enviando `ctx.chat.id.toString()`.
