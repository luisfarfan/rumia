## MODIFIED Requirements

### Requirement: Process jobs based on source type
The system SHALL resolve the handler for a captured item in a single exported function that can
be invoked without a queue or a Redis connection, and the dispatcher worker SHALL delegate to it
rather than reimplementing the condition.

#### Scenario: Dispatching URL job
- **WHEN** the worker processes a job whose item has a source type of `url`, `web`, `github`, `x` or `linkedin` and an original URL
- **THEN** the resolver delegates the processing to the web extraction handler

#### Scenario: Dispatching Audio job
- **WHEN** the worker processes a job with source type `audio` or `voice`
- **THEN** the resolver delegates the processing to the audio transcription handler

#### Scenario: Dispatching media jobs
- **WHEN** the worker processes a job with source type `youtube` or `tiktok`
- **THEN** the resolver delegates to the social media handler as it did before

#### Scenario: `photo` has no dedicated handler yet
- **WHEN** the worker processes a job with source type `photo`
- **THEN** the resolver reports the item as unhandled, same as before this change (out of scope: no photo handler exists in this codebase yet)

#### Scenario: No handler applies
- **WHEN** no handler matches the item's source type
- **THEN** the resolver reports the item as unhandled and no content is invented for it

#### Scenario: A handler fails
- **WHEN** the selected handler throws
- **THEN** the resolver propagates the error instead of turning it into content
