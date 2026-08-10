## Why

Actualmente el sistema ingesta contenido multimodal exitosamente y cuenta con un agente de Fact-Checking, pero esta metadata valiosa no está integrada en el pipeline automático ni visible para el usuario. Categorizar los ítems, asignarles tags y exponer su nivel de confiabilidad (Fact-Checking) en un Dashboard de Next.js permitirá a los usuarios explorar y confiar en su base de conocimiento de manera intuitiva y rápida.

## What Changes

- **Integración de Categorización y Fact-Checking en el Pipeline:** El Worker de BullMQ ahora ejecutará un nuevo `CategorizationAgent` (para tags y categoría) y el `FactCheckerAgent` existente inmediatamente después de extraer el contenido del ítem.
- **Evolución del Modelo de Datos:** Se añaden columnas `category` (VARCHAR) y `tags` (JSONB) a la tabla `captured_items` en PostgreSQL.
- **Extensión del API de Next.js:** El endpoint `/api/items` expondrá la categoría, tags y el arreglo de `claim_verifications` por cada ítem.
- **Dashboard UI Enriquecido:** La interfaz principal (Next.js) mostrará badges coloridos para las Categorías, "pills" para los Tags, y una nueva sección lateral detallada que visualice si las afirmaciones del ítem son Confiables (✅ True), Falsas (❌ False) o Inconclusas (⚠️ Inconclusive).

## Capabilities

### New Capabilities
- `item-categorization`: Clasificación automática de ítems en categorías estrictas predefinidas y asignación de tags semánticos libres utilizando un agente LLM estructurado.
- `reliability-dashboard`: Visualización en tiempo real del estado de confiabilidad (Fact-Checking) y metadatos de los ítems en la interfaz de usuario de Next.js.

### Modified Capabilities
- `async-processing`: Modificación para invocar agentes de categorización y fact-checking como parte obligatoria del ciclo de vida de ingestión de un ítem.

## Impact

- **Base de Datos:** Modificaciones menores en `schema.sql` (no destructivas).
- **Backend (Workers):** El pipeline de ingestión tardará un par de segundos extra por ítem al consumir 2 llamadas adicionales a LLMs vía `CLIProxyAPI`.
- **Frontend:** El dashboard de Next.js (`page.tsx`) requerirá una actualización de UI que aprovechará los nuevos campos del API.
