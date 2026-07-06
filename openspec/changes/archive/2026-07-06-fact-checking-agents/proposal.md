## Why

No todo lo que guardamos de internet es cierto. Necesitamos un mecanismo avanzado que tome los claims (afirmaciones) hechos en un artículo o video y los contraste contra la web en tiempo real para verificar su credibilidad.

## What Changes

- Implementación de un ciclo de agente (LangGraph ReAct) que use herramientas de búsqueda web (Tavily o SerpAPI).
- Un paso de extracción que identifique claims verificables en el documento.
- Almacenamiento del estado de verificación en la base de datos (Verdadero, Falso, Inconcluso).

## Capabilities

### New Capabilities
- `claim-extraction`: Identificación automatizada de afirmaciones fácticas.
- `web-verification`: Verificación autónoma de claims contra fuentes de internet.

### Modified Capabilities

## Impact
- **Dependencias**: Se integrará un proveedor de búsqueda web.
- **Base de datos**: Nuevo campo o tabla para resultados de fact-checking.
