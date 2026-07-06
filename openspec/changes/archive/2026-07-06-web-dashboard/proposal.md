## Why

Telegram es excelente para captura y consultas rápidas, pero para explorar conexiones complejas, revisar reportes de fact-checking largos o ver el Knowledge Graph, necesitamos una interfaz visual más rica.

## What Changes

- Creación de una aplicación web frontend (Next.js o Vite).
- Exposición de endpoints API para consultar la base de datos PostgreSQL desde el frontend.

## Capabilities

### New Capabilities
- `web-ui`: Interfaz gráfica para explorar los ítems capturados, el grafo de conocimiento y realizar búsquedas.
- `api-gateway`: Puntos de acceso HTTP para proveer datos a la interfaz.

### Modified Capabilities

## Impact
- **Repositorio**: Se añadirá una carpeta `/web` o `/frontend` con un nuevo proyecto.
- **Seguridad**: Habrá que implementar autenticación básica para que solo el dueño vea sus datos.
