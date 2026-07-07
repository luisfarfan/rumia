# Design Document: Token Usage Tracking

## Context
Gracias al refactor de `llm-provider-abstraction`, TODAS las llamadas de IA del sistema pasan por los métodos `generateCompletion`, `generateStructured` y `generateEmbeddings` dentro de clases que implementan `LLMProvider`. 
Esto es el escenario perfecto: en lugar de ir servicio por servicio contando tokens, interceptaremos la metadata del response (`response.usage`) dentro de los mismos Providers.

## Architecture

### 1. Database Schema
Tabla: `token_usage`
- `id`: UUID (PK)
- `item_id`: UUID (Nullable) - Para vincular a un documento/item específico.
- `session_id`: VARCHAR (Nullable) - Para vincular a un chat ID de Telegram o sesión web.
- `flow`: VARCHAR (Indexado) - Enum: `web_extraction`, `chunking`, `embedding`, `graph_extraction`, `rag_query`, `fact_checking`.
- `provider`: VARCHAR - Ej. `cliproxyapi`, `openrouter`.
- `model`: VARCHAR - Ej. `gpt-4o-mini-2024-07-18`. Se extrae directo del response de la API.
- `prompt_tokens`: INTEGER
- `completion_tokens`: INTEGER
- `total_tokens`: INTEGER
- `created_at`: TIMESTAMP

### 2. LLM Provider Extension
Modificaremos las interfaces en `src/core/llm/types.ts` para aceptar un nuevo objeto en `options`:

```typescript
export interface UsageMeta {
  flow: 'web_extraction' | 'chunking' | 'embedding' | 'graph_extraction' | 'rag_query' | 'fact_checking';
  itemId?: string;
  sessionId?: string;
}

// Y en los métodos de LLMProvider:
options?: { 
  modelTier?: 'flash' | 'pro'; 
  systemPrompt?: string; 
  schemaName?: string;
  usageMeta?: UsageMeta; 
}
// NOTA: Para `generateEmbeddings`, la firma también debe aceptar `options?: { usageMeta?: UsageMeta }`.
```

### 3. Asynchronous Recording (Fire-and-Forget)
Dentro de `CLIProxyProvider`, después de hacer el fetch, el código hará:
```typescript
if (options?.usageMeta && response.usage) {
  TokenUsageRepo.saveUsage({
    ...options.usageMeta,
    provider: 'cliproxyapi',
    model: response.model,
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    totalTokens: response.usage.total_tokens
  }).catch(err => console.error("Error saving token usage", err));
}
```
Al no usar `await`, no retrasamos la respuesta al usuario final (ej. en el bot de Telegram).

### 4. Propagación de Metadata
Los servicios (ej. `RagService.answerQuery`) deberán recibir el `sessionId` (ej. el chatId de telegram) como parámetro y pasarlo en el `usageMeta` al `LLMFactory`. Los handlers de BullMQ pasarán el `itemId`.
