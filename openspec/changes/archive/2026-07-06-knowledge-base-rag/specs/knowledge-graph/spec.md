## ADDED Requirements

### Requirement: Extract Graph Entities with Entity Resolution
The system SHALL use an LLM to extract structured nodes and edges from text content, and perform Entity Resolution to avoid duplicates before saving.

#### Scenario: Text has clear entities
- **WHEN** the system processes an article about a person founding a company
- **THEN** it extracts a Node for the person, a Node for the company, and an Edge representing "founder_of"

#### Scenario: Existing entity detection (Entity Resolution)
- **WHEN** the LLM extracts an entity named "Apple Inc." but "Apple" already exists in the graph database with high semantic similarity
- **THEN** the system reuses the existing "Apple" node ID instead of creating a duplicate node, and links new edges to it
