# Autodiscovery Wiki - Ingestion Gateway (Telegram)

Este repositorio es una plataforma personal para capturar, procesar, verificar y consultar conocimiento proveniente de internet y redes sociales de forma estructurada.

Esta es la implementación de la **Fase 1: Capture Gateway** con Telegram y persistencia inicial en PostgreSQL.

## Requisitos Previos

- **Node.js** (v18 o superior)
- **PostgreSQL**
- Un token de Bot de Telegram (obtenido a través de [@BotFather](https://t.me/BotFather))

## Configuración

1. Clona el repositorio (o ubícate en el directorio del proyecto).
2. Copia el archivo de variables de entorno de ejemplo:
   ```bash
   cp .env.example .env
   ```
3. Configura tu `.env` con las credenciales de tu base de datos y tu token de Telegram:
   - `DATABASE_URL`: El string de conexión a tu base de datos de PostgreSQL.
   - `TELEGRAM_BOT_TOKEN`: El token del bot de Telegram.

## Instalación y Migraciones

Instala las dependencias:
```bash
npm install
```

Ejecuta las migraciones de la base de datos para crear la tabla de elementos capturados (`captured_items`):
```bash
npm run migrate
```

## Ejecución

Para iniciar el Bot de Telegram en modo de desarrollo (usando `tsx`):
```bash
npm start
```

## Cómo Funciona

El bot escucha los siguientes tipos de mensajes enviados por el usuario:
- **Mensajes de texto con URLs**: Captura la primera URL del texto e introduce una nota si existe texto adicional.
- **Documentos (PDFs, etc.)**, **Audios**, **Notas de voz** y **Videos**: Registra la metadata del archivo en la base de datos (con su respectivo `file_id` de Telegram) sin descargarlo de forma inmediata.

Cada entrada se persiste inmediatamente en PostgreSQL con el estado inicial `received`, asegurando que no se pierda nada de información antes de los procesamientos asíncronos posteriores.
