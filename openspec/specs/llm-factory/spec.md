# llm-factory Specification

## Purpose
TBD - created by archiving change llm-provider-abstraction. Update Purpose after archive.
## Requirements
### Requirement: LLM Factory Provider Abstraction
The system SHALL abstract all LLM/OpenAI calls through an LLM Factory interface supporting multiple providers (CLIProxyAPI, OpenRouter, Codex, Antigravity).

#### Scenario: Dynamic routing of chat and embeddings
- **WHEN** CHAT_LLM_PROVIDER or EMBEDDING_LLM_PROVIDER is configured in .env
- **THEN** LLMFactory instantiates the correct provider dynamically

