## Why

El sistema necesita un punto de entrada confiable para capturar el contenido (URLs, textos, archivos, audios) compartido por el usuario antes de enviarlo a procesamiento asíncrono. Telegram es el canal inicial elegido por su ubicuidad, soporte nativo para multimedia y facilidad de uso al compartir desde dispositivos móviles. Se utiliza PostgreSQL para la persistencia inmediata del estado raw, garantizando que no se pierda información aunque los procesos posteriores (como yt-dlp o IA) fallen o se demoren.

## What Changes

- Implementación de un bot de Telegram utilizando el framework `grammy` para recibir mensajes, enlaces y archivos.
- Diseño de la abstracción `CaptureRequest` para normalizar las entradas, preparándolo para futuros canales.
- Diseño e implementación del esquema en PostgreSQL para almacenar registros de `CapturedItem`.
- Definición de una máquina de estados básica (ej: `received`, `queued`, `failed`) para dar trazabilidad a cada item capturado.
- Conexión del bot con la base de datos para garantizar la inserción (persistencia inicial) de cada mensaje capturado antes de responder al usuario.

## Capabilities

### New Capabilities
- `telegram-capture`: Recepción de mensajes e interacciones de Telegram y normalización a `CaptureRequest`.
- `initial-persistence`: Almacenamiento y trazabilidad de los elementos (`CapturedItem`) en PostgreSQL con manejo de estados.

### Modified Capabilities
<!-- No requirement changes in existing capabilities since it's a new project -->

## Impact

- **Base de Datos**: Creación de las primeras tablas en la base de datos PostgreSQL.
- **Arquitectura**: Establece la base de la fase 1 de Ingestión (El Capture Gateway).
- **Dependencias**: Se integran `grammy`, `pg`, y `zod` al flujo principal de la aplicación.
