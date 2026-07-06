## Context

El usuario necesita una forma de visualizar los datos capturados y el grafo. Siendo desarrollador Full Stack, una app en Next.js/React es la opción ideal.

## Goals / Non-Goals

**Goals:**
- App Next.js con TailwindCSS.
- Visualización de tabla con ítems guardados.
- Visualización gráfica (nodos/aristas) del Knowledge Graph.

**Non-Goals:**
- No reemplazará a Telegram como método de captura principal.

## Decisions
- **Stack Frontend**: Next.js App Router (React), TailwindCSS.
- **Visualización de Grafos**: Librería como `react-force-graph` o `vis-network`.

## Risks / Trade-offs
- **Mantenimiento**: Dos aplicaciones (Bot + Web). **Mitigación**: Compartir lógica en un monorepo o mantener el backend de la DB unificado.
