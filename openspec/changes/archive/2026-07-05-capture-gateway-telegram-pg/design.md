## Context

El proyecto es una plataforma personal para transformar contenido disperso de internet (enlaces, videos, artículos) en conocimiento estructurado. Este documento aborda la Fase 1: El **Capture Gateway**, que es el punto de entrada al sistema. 
Actualmente el usuario comparte contenido a través de diferentes canales informales, y el objetivo es centralizar la recepción mediante un bot de Telegram, asegurando que ningún ítem se pierda al almacenarlo inmediatamente en PostgreSQL antes de iniciar procesos costosos y asíncronos como la descarga y transcripción.

## Goals / Non-Goals

**Goals:**
- Recibir mensajes (texto plano que contenga URLs), enlaces y archivos desde un chat de Telegram.
- Parsear y normalizar estos mensajes en una estructura abstracta (`CaptureRequest`).
- Almacenar el contenido en PostgreSQL (`CapturedItem`) de forma síncrona.
- Responder al usuario inmediatamente en Telegram confirmando la recepción y mostrando el ID o estado de procesamiento inicial.

**Non-Goals:**
- Extraer metadatos detallados (títulos, autores, transcripciones) en esta fase (eso corresponde a fases posteriores).
- Descargar videos o audios (yt-dlp y FFmpeg no serán implementados en este spec).
- Generación de embeddings o análisis con LLMs.
- Procesamiento en background/colas (aquí solo definiremos el estado en DB como `queued` para que el sistema de colas lo recoja posteriormente).

## Decisions

1. **Framework de Telegram: `grammy`**
   - *Por qué:* Es un framework moderno para Node.js, escrito en TypeScript, con excelente rendimiento, soporte completo para la API de Telegram y facilidad para usar middlewares.
   - *Alternativas:* `telegraf` (más antiguo, menos type-safe por defecto), `node-telegram-bot-api` (muy básico, basado en callbacks antiguos).

2. **Driver de Base de Datos: `pg` nativo (con posibles query builders a futuro)**
   - *Por qué:* Iniciaremos con `pg` para las inserciones directas, manteniendo el esquema simple y rápido. A futuro se puede integrar un query builder ligero o ORM si la complejidad lo requiere, pero para persistencia inicial directa, `pg` es robusto.
   - *Alternativas:* Prisma (muy pesado), Drizzle (buena opción, se podría incorporar en el futuro para migraciones).

3. **Validación de Entradas: `zod`**
   - *Por qué:* Para garantizar que el `CaptureRequest` está bien formado antes de intentar guardarlo en PostgreSQL.

4. **Persistencia Síncrona**
   - *Por qué:* El webhook (o polling) de Telegram no debe enviar un "OK" al usuario hasta que la inserción en BD haya sido confirmada. Esto garantiza zero data-loss en caso de caídas del worker asíncrono.

## Risks / Trade-offs

- **[Risk] Telegram Webhook/Polling timeouts:** Si la base de datos es lenta o se cae, el bot no responderá a tiempo. 
  - *Mitigación:* Se establecerán timeouts estrictos en las queries de BD (ej. 2-3 segundos) para fallar rápido, loguear el error y avisar al usuario.
- **[Risk] Mensajes duplicados:** Telegram puede reintentar mensajes si no recibe un HTTP 200 en webhooks.
  - *Mitigación:* Usar el `message_id` del chat como clave de idempotencia en la base de datos (o como parte de un hash único) para evitar crear múltiples `CapturedItem` para el mismo envío.
- **[Risk] Payload demasiado grande:** Archivos gigantes enviados por Telegram.
  - *Mitigación:* La API de bots de Telegram ya limita las descargas directas a 20MB. Guardaremos solo el `file_id` y procesaremos la descarga en colas posteriores.
