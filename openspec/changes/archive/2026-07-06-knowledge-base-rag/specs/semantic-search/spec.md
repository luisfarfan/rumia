## ADDED Requirements

### Requirement: Hybrid Search
The system SHALL support searching the knowledge base using both vector similarity and graph traversals.

#### Scenario: User queries for relationships
- **WHEN** a user searches for entities related to a specific topic
- **THEN** the system finds the starting node via vector search and traverses its edges to return connected context
