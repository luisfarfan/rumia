## ADDED Requirements

### Requirement: Telegram Text and URL Capture
The system SHALL capture text messages containing links or notes sent to the Telegram bot and format them into a `CaptureRequest`.

#### Scenario: User sends a simple URL
- **WHEN** the user sends a message containing only "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
- **THEN** the system extracts the URL, sets the `sourceChannel` to "telegram", and prepares a `CaptureRequest`

#### Scenario: User sends a URL with a note
- **WHEN** the user sends a message like "Mira este video: https://example.com"
- **THEN** the system captures the URL, and stores "Mira este video:" as a `note` in the `CaptureRequest`

### Requirement: Telegram File Capture
The system SHALL capture metadata for documents, audios, and videos sent to the Telegram bot without downloading them immediately.

#### Scenario: User forwards a PDF document
- **WHEN** the user forwards or uploads a PDF document
- **THEN** the system captures the Telegram `file_id` and MIME type, and sets `sourceChannel` to "telegram"

### Requirement: Immediate User Feedback
The system SHALL reply to the user immediately after the `CaptureRequest` has been successfully persisted.

#### Scenario: Successful capture and persistence
- **WHEN** a `CaptureRequest` is successfully saved to the database
- **THEN** the bot replies with a confirmation message (e.g., "Contenido registrado exitosamente") and its ID.

#### Scenario: Database persistence fails
- **WHEN** the system fails to save the `CaptureRequest` due to a database error
- **THEN** the bot replies with an error message indicating that the content could not be saved, prompting the user to try again.
