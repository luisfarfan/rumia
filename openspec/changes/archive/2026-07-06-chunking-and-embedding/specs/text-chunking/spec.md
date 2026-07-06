## ADDED Requirements

### Requirement: Split text into chunks
The system SHALL split large text content into smaller chunks of maximum specified length while preserving semantic boundaries (e.g. paragraphs, sentences).

#### Scenario: Text exceeds chunk size
- **WHEN** a document has 2000 tokens and the limit is 500
- **THEN** it is split into multiple chunks with optional overlap to retain context
