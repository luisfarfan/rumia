## 1. Core Abstraction
- [x] 1.1 Crear carpeta `src/core/llm` y `src/core/llm/providers`.
- [x] 1.2 Definir la interfaz `LLMProvider` en `types.ts` (métodos `generateCompletion`, `generateStructured`, `generateEmbeddings`).
- [x] 1.3 Actualizar `.env.example` y validar variables en configuración si existe.

## 2. Providers Implementations
- [x] 2.1 Implementar `CLIProxyProvider` reutilizando el cliente de `openai` nativo pero con `baseURL` dinámico.
- [x] 2.2 Implementar `OpenRouterProvider` con su lógica de nombres de modelo (`openai/gpt-4o-mini`).
- [x] 2.3 Dejar creados los esqueletos (stubs) para `CodexProvider` y `AntigravityProvider`.
- [x] 2.4 Implementar `LLMFactory` con `getChatProvider()` y `getEmbeddingProvider()` leyendo el `.env`.

## 3. Refactorización (Dependency Injection)
- [x] 3.1 Refactorizar `src/services/embeddingService.ts` para usar la Factory.
- [x] 3.2 Refactorizar `src/services/ragService.ts` para usar la Factory.
- [x] 3.3 Refactorizar `src/services/graphExtractionService.ts` para usar `generateStructured` de la Factory.
- [x] 3.4 Refactorizar `src/agents/factCheckerAgent.ts` para usar la Factory.

## 4. Verificación
- [x] 4.1 Ejecutar el bot de Telegram y probar una pregunta por RAG (`/ask`) para asegurar que el ruteo funciona vía CLIProxyAPI.
