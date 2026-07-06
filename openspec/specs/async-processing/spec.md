# async-processing Specification

## Purpose
TBD - created by archiving change capture-workers-bullmq. Update Purpose after archive.
## Requirements
### Requirement: Queue items for processing
The system SHALL enqueue a job in BullMQ when an item is successfully saved to the database with state `received`.

#### Scenario: Item received via Telegram
- **WHEN** the Telegram bot receives a message and successfully persists it to the database
- **THEN** the system enqueues a job containing the `itemId` and `sourceType` into the `ingestionQueue`

### Requirement: Process jobs based on source type
The system SHALL have a dispatcher worker that delegates jobs to specific handlers based on the `sourceType`.

#### Scenario: Dispatching URL job
- **WHEN** the worker processes a job with `sourceType` equal to `url`
- **THEN** the worker delegates the processing to the web extraction handler

#### Scenario: Dispatching Audio job
- **WHEN** the worker processes a job with `sourceType` equal to `audio` or `voice`
- **THEN** the worker delegates the processing to the audio transcription handler

### Requirement: Update item status
The system SHALL update the status of the item in the database after processing.

#### Scenario: Successful processing
- **WHEN** a handler successfully extracts content or transcribes the item
- **THEN** the system updates the database state to `extracted` and saves the extracted content

#### Scenario: Failed processing
- **WHEN** a handler encounters an unrecoverable error or exceeds retry limits
- **THEN** the system updates the database state to `error` and records the error details

