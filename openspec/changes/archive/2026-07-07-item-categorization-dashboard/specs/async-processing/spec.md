## MODIFIED Requirements

### Requirement: Update item status
The system SHALL update the status of the item in the database after processing, including executing resilient, conditional categorization and fact-checking workflows before marking it as complete.

#### Scenario: Successful processing with full metadata
- **WHEN** a handler successfully extracts content or transcribes the item
- **THEN** the system truncates the text if necessary, invokes the CategorizationAgent, conditionally invokes FactCheckerAgent (based on category), saves metadata, and updates state to `extracted`.

#### Scenario: Fallback processing on LLM/API failure
- **WHEN** the CategorizationAgent or FactCheckerAgent throws an error (e.g. 502 proxy error, timeout)
- **THEN** the system gracefully catches the error, sets category to `Unknown`, logs the error, and still successfully updates the state to `extracted`.

#### Scenario: Failed core extraction
- **WHEN** a core extraction handler encounters an unrecoverable error
- **THEN** the system updates the database state to `error` and records the error details.
