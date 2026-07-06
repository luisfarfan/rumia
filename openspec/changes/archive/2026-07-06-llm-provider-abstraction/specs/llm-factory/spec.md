# LLM Factory Specification

## ADDED Requirements

### Requirement: LLM Factory Provider Abstraction
The system SHALL abstract all LLM/OpenAI calls through an LLM Factory interface supporting multiple providers (CLIProxyAPI, OpenRouter, Codex, Antigravity).

#### Scenario: Dynamic routing of chat and embeddings
- **WHEN** CHAT_LLM_PROVIDER or EMBEDDING_LLM_PROVIDER is configured in .env
- **THEN** LLMFactory instantiates the correct provider dynamically

## 1. Directory Structure
```
src/core/llm/
  ├── types.ts (interfaces)
  ├── LLMFactory.ts
  ├── providers/
  │    ├── CLIProxyProvider.ts
  │    ├── OpenRouterProvider.ts
  │    ├── CodexProvider.ts
  │    └── AntigravityProvider.ts
```

## 2. Environment Variables (`.env`)
Se deben requerir estas variables:
```env
# Providers
CHAT_LLM_PROVIDER=cliproxyapi # cliproxyapi | openrouter | codex | antigravity
EMBEDDING_LLM_PROVIDER=cliproxyapi # Puede ser distinto si el proxy no soporta embeddings

# CLI Proxy API (Default)
CLIPROXY_API_KEY=your_key
CLIPROXY_BASE_URL=https://api.tu-proxy.com/v1
CLIPROXY_FLASH_MODEL=gpt-4o-mini
CLIPROXY_PRO_MODEL=gpt-4o

# OpenRouter
OPENROUTER_API_KEY=your_key
OPENROUTER_FLASH_MODEL=openai/gpt-4o-mini
OPENROUTER_PRO_MODEL=openai/gpt-4o

# Codex / Antigravity
CODEX_API_KEY=your_key
ANTIGRAVITY_API_KEY=your_key
```

## 3. Refactoring Contract
Los siguientes archivos deben ser modificados para eliminar el `import { OpenAI } from 'openai';`:
- `src/services/embeddingService.ts`: Reemplazar por `LLMFactory.getEmbeddingProvider().generateEmbeddings(texts)`
- `src/services/graphExtractionService.ts`: Reemplazar por `LLMFactory.getChatProvider().generateStructured(...)`
- `src/services/ragService.ts`: Reemplazar por `LLMFactory.getChatProvider().generateCompletion(...)`
- `src/agents/factCheckerAgent.ts`: Reemplazar por `LLMFactory.getChatProvider().generateStructured(...)`
