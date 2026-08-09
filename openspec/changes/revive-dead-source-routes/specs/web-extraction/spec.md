## MODIFIED Requirements

### Requirement: Extract text from web pages
The system SHALL extract clean, readable text from a given web URL, and SHALL treat a page with
no extractable text as a failure rather than returning placeholder text as content.

#### Scenario: Successful text extraction
- **WHEN** the handler receives a valid web URL
- **THEN** it downloads the HTML, parses it, extracts the main content (removing navigation, footers, etc.), and returns the plain text

#### Scenario: Handle download errors
- **WHEN** the handler attempts to extract a URL but the server returns a 404 or 500
- **THEN** it throws an error that allows BullMQ to retry the job

#### Scenario: Page has no readable article but has metadata
- **WHEN** the parser finds no readable article but the page exposes a meta description
- **THEN** the handler returns that description as the content

#### Scenario: Page has nothing extractable
- **WHEN** the parser finds neither a readable article nor a meta description
- **THEN** the handler throws, so the item is recorded as failed instead of being stored with placeholder text that would then be categorized and embedded
