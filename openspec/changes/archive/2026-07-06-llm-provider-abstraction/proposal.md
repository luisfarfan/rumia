# Proposal: LLM Provider Abstraction

## 1. Description
Actualmente, el proyecto AutoDiscovery Wiki depende directamente del SDK oficial de OpenAI y de la variable de entorno `OPENAI_API_KEY`. Esto limita la capacidad del sistema para aprovechar proxies más económicos o plataformas multimodelo (como CLIProxyAPI, OpenRouter, Codex, o Antigravity).

Este cambio introduce una capa de abstracción (LLM Factory) que permite cambiar de proveedor de LLM con una simple variable de entorno, usando CLIProxyAPI como el proveedor principal (base), pero permitiendo escalar o cambiar a otros en caso de caídas o necesidades específicas.

## 2. Motivation
* **Costo y Flexibilidad**: CLIProxyAPI, OpenRouter y otros proxies ofrecen los mismos modelos a una fracción del precio o permiten usar modelos Open Source.
* **Resiliencia**: Si OpenAI se cae, podemos cambiar el `LLM_PROVIDER` y seguir operando sin reescribir código.
* **Separación de Responsabilidades (SoC)**: Los servicios como `RagService` o `FactCheckerAgent` no deberían saber qué API específica se está usando.

## 3. Scope
* **In Scope**:
    * Crear interfaz `LLMProvider`.
    * Implementar el `LLMFactory`.
    * Proveedores soportados inicialmente: `CLIProxyAPI` (Default), `OpenRouter`, `Codex`, `Antigravity`.
    * Mapeo de nombres de modelos (Flash vs Pro).
    * Refactorización de servicios existentes (`ragService.ts`, `embeddingService.ts`, etc.) para usar la Factory.
* **Out of Scope**:
    * Implementar lógica de reintentos con fallback automático entre proveedores (ej. si falla CLIProxyAPI, intentar OpenRouter). Esto se puede añadir en el futuro. Por ahora el fallback es manual mediante `.env`.

## 4. Risks & Mitigations
* **Structured Outputs**: No todos los modelos no-OpenAI soportan `zodResponseFormat`.
    * *Mitigación*: Limitaremos el uso de los roles `flash` y `pro` en CLIProxyAPI y OpenRouter a modelos de la familia GPT (`gpt-4o-mini`, `gpt-4o`), o manejaremos un fallback a JSON estándar.
* **Modelos de Embeddings**: OpenRouter y otros proxies a veces no soportan bien el modelo `text-embedding-3-small`.
    * *Mitigación*: Permitiremos definir un proveedor separado para embeddings (`EMBEDDING_PROVIDER`), de forma que se pueda usar OpenAI directo para vectores y CLIProxyAPI para chat.
