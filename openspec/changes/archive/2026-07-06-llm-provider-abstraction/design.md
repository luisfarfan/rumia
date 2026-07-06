# Design Document: LLM Provider Abstraction

## Context
El sistema tiene 4 puntos donde llama a IA:
1. **Extraction (Phase 2/Audio)**: Transcripción (Whisper).
2. **Embeddings (Phase 3)**: Vectorización de chunks y entidades.
3. **Graph Extraction (Phase 4)**: Extracción estructurada (Nodos y Aristas).
4. **RAG & Fact-Checking (Phase 5/6)**: Razonamiento lógico y generación de texto.

## Goals
- Abstener todas estas llamadas bajo una única interfaz `LLMProvider`.
- Instanciar la interfaz correcta basándose en el `.env`.

## Architecture

### 1. El Patrón Factory
Se creará un `LLMFactory.ts` que expondrá métodos estáticos:
- `getChatProvider(): LLMProvider`
- `getEmbeddingProvider(): LLMProvider`

### 2. La Interfaz `LLMProvider`
```typescript
export interface LLMProvider {
  // Para chat y RAG
  generateCompletion(prompt: string, options?: { modelTier?: 'flash' | 'pro', systemPrompt?: string }): Promise<string>;
  
  // Para Graph y Fact-Checking (Structured Outputs)
  generateStructured<T>(prompt: string, schema: any, options?: { modelTier?: 'flash' | 'pro', systemPrompt?: string, schemaName: string }): Promise<T>;
  
  // Para la fase 3 (Vectores)
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
```

### 3. Mapeo de Nombres de Modelos
Debido a que OpenRouter usa nombres como `openai/gpt-4o-mini` y CLIProxyAPI usa `gpt-4o-mini`, cada proveedor manejará su propia traducción de la abstracción `flash` / `pro` a su string interno.

### 4. Implementaciones Específicas
- **CLIProxyProvider**: Utiliza la librería `openai` de npm pero inyecta el `baseURL` de CLIProxyAPI. Actuará como el default.
- **OpenRouterProvider**: Utiliza la librería `openai` apuntando al endpoint de OpenRouter y ajustando el modelo al prefijo adecuado.
- **CodexProvider** / **AntigravityProvider**: Clases preparadas para conectarse a esos entornos.

## Manejo de Huecos Arquitectónicos (Gaps Fixed)
1. **Gap de Embeddings**: Al crear `getEmbeddingProvider()` separado de `getChatProvider()`, el usuario puede en el `.env` decidir usar OpenAI para embeddings (porque los proxies a veces fallan ahí) y CLIProxyAPI para todo el chat, optimizando costos sin romper el sistema.
2. **Gap de Structured Outputs**: Al delegar la llamada estructurada a la clase de la implementación (`generateStructured`), si un proveedor (ej. Antigravity) no soporta el formato exacto de Zod de OpenAI, su clase puede sobreescribir la lógica para pedirle al LLM que devuelva JSON y hacer el parseo manual con `Zod.parse()`.
