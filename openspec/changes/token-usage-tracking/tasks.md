## 1. Database & Repository
- [x] 1.1 Modificar `src/db/schema.sql` para añadir la tabla `token_usage`.
- [x] 1.2 Crear `src/db/tokenUsageRepo.ts` y exportarlo en `src/db/index.ts`.
- [x] 1.3 (Opcional) Crear un script en `src/db/migrate.ts` si se requiere para crear la tabla de forma asilada, o correr el SQL manualmente.

## 2. LLM Providers Update
- [x] 2.1 Actualizar `src/core/llm/types.ts` con la interfaz `UsageMeta`.
- [x] 2.2 Actualizar `CLIProxyProvider.ts` para interceptar `usage` y llamar al repo asíncronamente.
- [x] 2.3 Actualizar `OpenRouterProvider.ts` para interceptar `usage` y llamar al repo asíncronamente.

## 3. Services Update (Propagar metadata)
- [x] 3.1 Actualizar `src/services/embeddingService.ts` (aceptar itemId opcional y pasarlo en usageMeta).
- [x] 3.2 Actualizar `src/services/graphExtractionService.ts` (pasar `itemId` y flow `graph_extraction`).
- [x] 3.3 Actualizar `src/agents/factCheckerAgent.ts` (pasar `itemId` y flow `fact_checking`).
- [x] 3.4 Actualizar `src/services/ragService.ts` (aceptar `sessionId` opcional).
- [x] 3.5 Actualizar `src/bot/index.ts` para pasar `ctx.chat.id` al `ragService`.

## 4. Testing
- [x] 4.1 Hacer una llamada al bot vía telegram o código de prueba y validar en la BD `SELECT * FROM token_usage;` que el registro de la sesión y tokens apareció exitosamente.
