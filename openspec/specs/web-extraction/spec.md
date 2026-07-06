# web-extraction Specification

## Purpose
TBD - created by archiving change capture-workers-bullmq. Update Purpose after archive.
## Requirements
### Requirement: Extract text from web pages
The system SHALL extract clean, readable text from a given web URL.

#### Scenario: Successful text extraction
- **WHEN** the handler receives a valid web URL
- **THEN** it downloads the HTML, parses it, extracts the main content (removing navigation, footers, etc.), and returns the plain text

#### Scenario: Handle download errors
- **WHEN** the handler attempts to extract a URL but the server returns a 404 or 500
- **THEN** it throws an error that allows BullMQ to retry the job

### Requirement: Extract page metadata
The system SHALL extract title and description metadata alongside the content.

#### Scenario: Metadata available
- **WHEN** the HTML document has `<title>` and `<meta name="description">` tags
- **THEN** the handler extracts these fields to enrich the stored item

