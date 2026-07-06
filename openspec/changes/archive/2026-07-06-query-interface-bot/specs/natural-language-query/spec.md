## ADDED Requirements

### Requirement: Process natural language queries
The system SHALL accept `/ask` commands in Telegram and route them to the query pipeline.

#### Scenario: User asks a question
- **WHEN** user sends `/ask What did Elon Musk say about AI?`
- **THEN** the system acknowledges the query and begins processing
