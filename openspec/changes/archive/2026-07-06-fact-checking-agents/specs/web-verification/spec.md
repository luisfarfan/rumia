## ADDED Requirements

### Requirement: Autonomous Web Verification
The system SHALL search the live web to verify the extracted claims.

#### Scenario: Claim is true
- **WHEN** the agent searches the web and finds reliable sources confirming the claim
- **THEN** it marks the claim as True and attaches the source URLs

#### Scenario: Claim is false
- **WHEN** the agent searches the web and finds reliable sources debunking the claim
- **THEN** it marks the claim as False and attaches the debunking URLs
