## Context

Actualmente los ítems enviados por los usuarios al bot de Telegram se guardan exitosamente en PostgreSQL en estado `received`. Sin embargo, la extracción de contenido y otras tareas no se realizan. Requerimos una infraestructura asincrónica para procesar estos mensajes sin bloquear la recepción en Telegram. Se eligió BullMQ y Redis para esta tarea.

## Goals / Non-Goals

**Goals:**
- Implementar BullMQ para procesar en segundo plano los items con estado `received`.
- Proveer un worker enrutador (dispatcher) que reciba el trabajo y delegue a manejadores (handlers) especializados según el `source_type`.
- Implementar un handler de extracción web para enlaces web (`url`).
- Implementar un handler básico para notas de voz (`audio`, `voice`).
- Actualizar el estado de los items en PostgreSQL a `extracted` o `error` y guardar el contenido extraído.

**Non-Goals:**
- No implementar workers de procesamiento pesado (como análisis semántico con LangGraph o guardado en Base de Datos Vectorial) en esta fase (eso es Fase 3).
- No implementar descarga de YouTube todavía.

## Decisions

- **Estructura de Colas**: Tendremos una cola principal llamada `ingestionQueue`.
- **Payload del Job**: El payload contendrá al menos `{ itemId: string }`. El worker buscará el item en la base de datos para asegurar tener la información más reciente.
- **Estrategia de Encolado**: El servicio de Telegram encolará directamente el trabajo en BullMQ justo después de persistir el item exitosamente en PostgreSQL (`CaptureService`). Adicionalmente, en el futuro se agregará un cron para recuperación de items `received` huérfanos.
- **Estructura del Proyecto**: Los workers vivirán en `src/workers/ingestion/` con su propio punto de entrada para poder correrlos en un proceso separado si fuera necesario.

## Risks / Trade-offs

- **Caída de Redis**: Si Redis no está disponible, el proceso fallará al intentar encolar desde el webhook de Telegram, perdiendo la inmediatez. **Mitigación**: Capturar errores de BullMQ en el `CaptureService` para que el item quede en DB como `received` (será procesado cuando se implemente el cron de recuperación, o reintentado manualmente).
- **Scraping Rate Limits**: Extracción web puede fallar. **Mitigación**: BullMQ configurado con reintentos con "backoff exponencial".
