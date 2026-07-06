## 1. Setup y DB
- [x] 1.1 Configurar API Key de Tavily/SerpAPI.
- [x] 1.2 Crear tabla `claim_verifications` para guardar los reportes.

## 2. Agente LangGraph
- [x] 2.1 Crear el nodo de Extracción de Claims.
- [x] 2.2 Crear el nodo de Verificación (ReAct Agent con Tools de búsqueda).
- [x] 2.3 Ensamblar el grafo y definir estados (`StateGraph`).

## 3. Integración
- [x] 3.1 Añadir comando de Telegram `/verify <itemId>` para disparar el agente manualmente.
