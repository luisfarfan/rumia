## ADDED Requirements

### Requirement: Generate and store embeddings in batches
The system SHALL generate vector embeddings for chunks efficiently using batch API requests and persist them in PostgreSQL using pgvector, ensuring idempotency.

#### Scenario: Successful embedding generation
- **WHEN** a chunk (or batch of chunks) is generated
- **THEN** the system calls the embedding API, retrieves the vector arrays, and stores them in the `item_chunks` table linked to the original `CapturedItem`

#### Scenario: Partial failure recovery (Idempotency)
- **WHEN** processing fails midway for a large document
- **THEN** the system only requests embeddings for chunks that are not already saved in the database during the retry
