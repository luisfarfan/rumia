## 1. Setup Base de Datos

- [x] 1.1 Configurar la conexión a PostgreSQL usando `pg` y `dotenv` en `src/db/index.ts`.
- [x] 1.2 Crear el script de migración SQL (`src/db/schema.sql`) para la tabla `captured_items`.
- [x] 1.3 Implementar un script simple para ejecutar las migraciones iniciales (`npm run migrate`).

## 2. Modelos y Validación

- [x] 2.1 Definir las interfaces TypeScript (`CaptureRequest`, `CapturedItem`) en `src/core/models.ts`.
- [x] 2.2 Crear los schemas de `zod` para validación en tiempo de ejecución en `src/core/schemas.ts`.

## 3. Lógica del Capture Gateway

- [x] 3.1 Implementar `CapturedItemsRepo` en `src/db/capturedItemsRepo.ts` para inserciones seguras e idempotentes.
- [x] 3.2 Implementar el `TelegramCaptureService` en `src/bot/telegramCaptureService.ts` para parsear URLs, notas y archivos, delegando la persistencia al repositorio.

## 4. Bot de Telegram

- [x] 4.1 Instanciar y configurar el bot con `grammy` en `src/bot/index.ts`.
- [x] 4.2 Crear los listeners del bot (`bot.on('message:text')`, `bot.on('message:document')`, etc.) y conectarlos al servicio de captura.
- [x] 4.3 Implementar el feedback al usuario: responder con el ID del ítem guardado o con un mensaje de error si la base de datos falla.

## 5. Integración Final

- [x] 5.1 Agregar el script de inicio del bot en `package.json`.
- [x] 5.2 Documentar en un `README.md` cómo correr el proyecto y cómo setear las variables de entorno (`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`).
