# api-gateway Specification

## Purpose
TBD - created by archiving change web-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Backend API
The system SHALL expose HTTP API endpoints to serve data to the web frontend.

#### Scenario: Frontend requests data
- **WHEN** the web UI requests recent items
- **THEN** the API queries PostgreSQL and returns the items in JSON format

