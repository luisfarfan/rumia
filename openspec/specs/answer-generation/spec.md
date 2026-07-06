# answer-generation Specification

## Purpose
TBD - created by archiving change query-interface-bot. Update Purpose after archive.
## Requirements
### Requirement: Generate grounded answers
The system SHALL generate answers based EXCLUSIVELY on the retrieved knowledge base context.

#### Scenario: Information found
- **WHEN** context is retrieved that answers the query
- **THEN** the system generates a synthesized answer with references to the original sources

#### Scenario: Information not found
- **WHEN** no relevant context is retrieved
- **THEN** the system explicitly states that it does not have information about that topic in the personal knowledge base

