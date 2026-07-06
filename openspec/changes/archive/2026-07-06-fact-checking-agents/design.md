## Context

Este es el núcleo "inteligente" de la plataforma. Para no gastar LLM innecesariamente, esto solo debe correr sobre documentos marcados para verificación o claims que el usuario explícitamente pida investigar.

## Goals / Non-Goals

**Goals:**
- Agente ReAct con LangGraph.
- Herramienta de búsqueda (Tavily API).
- Guardar el reporte de verificación (qué fuentes se usaron, conclusión).

**Non-Goals:**
- No verificaremos *todo* lo que entra automáticamente, solo artículos/noticias o lo que el usuario pida.

## Decisions
- **Framework de Agentes**: `LangGraph` para control de flujo y human-in-the-loop si es necesario.
- **Herramienta de Búsqueda**: Tavily, ya que está optimizada para RAG y LLMs (devuelve contenido limpio).

## Risks / Trade-offs
- **Hallucinations en Verificación**: El agente puede concluir algo falso. **Mitigación**: Siempre proveer los links usados para la conclusión para revisión manual.
