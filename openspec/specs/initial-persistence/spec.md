## ADDED Requirements

### Requirement: Database Schema Initialization
The system SHALL define and execute a PostgreSQL schema script to create the necessary tables for initial persistence, primarily the `CapturedItem` table.

#### Scenario: Running database setup
- **WHEN** the application starts or the migration script is run
- **THEN** it creates the `captured_items` table with columns for id, userId, originalUrl, rawInput, sourceChannel, status, error, and timestamps.

### Requirement: Idempotent Insertion
The system SHALL prevent duplicate `CapturedItem` records from being created if the same message is retried by the input channel (e.g., Telegram webhook retries).

#### Scenario: Channel retries a webhook payload
- **WHEN** the system receives an identical payload with the same external message identifier within a short time frame
- **THEN** it ensures only one `CapturedItem` is recorded in the database, ignoring the duplicate or returning the existing ID.

### Requirement: State Management
The system SHALL default the status of a new `CapturedItem` to `received` upon initial insertion.

#### Scenario: Storing a new item
- **WHEN** a valid `CaptureRequest` is persisted
- **THEN** the `status` column of the inserted row is set to "received" and the `createdAt` timestamp is recorded.
