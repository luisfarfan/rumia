## MODIFIED Requirements

### Requirement: Process jobs based on source type
The system SHALL resolve the handler for a captured item in a single exported function that can
be invoked without a queue or a Redis connection, and the dispatcher worker SHALL delegate to it
rather than reimplementing the condition.

#### Scenario: Dispatching URL job
- **WHEN** the worker processes a job whose item has a source type of `url`, `web`, `github`, `x` or `linkedin` and an original URL
- **THEN** the resolver delegates the processing to the web extraction handler

#### Scenario: Dispatching Audio job
- **WHEN** the worker processes a job with source type `audio` or `voice`, whether or not the item also carries a URL parsed from its caption
- **THEN** the resolver delegates the processing to the audio transcription handler, because the recording is the content

#### Scenario: Dispatching media jobs
- **WHEN** the worker processes a job with source type `youtube` or `tiktok`
- **THEN** the resolver delegates to the social media handler as it did before

#### Scenario: TikTok photo carousel
- **WHEN** the social media handler rejects a TikTok URL as unsupported, which is how photo carousels present themselves
- **THEN** the resolver falls back to the carousel handler, and only if that also fails does it fall back to page metadata, marking the item degraded

#### Scenario: Dispatching a photo
- **WHEN** the worker processes a job with source type `photo`, whether or not a URL was parsed out of its caption
- **THEN** the resolver delegates to the photo handler, because the image is the content and a link in the caption must not divert the item to a web scrape

#### Scenario: A handler reports degraded output
- **WHEN** a handler completes but reports that part of the pipeline was unavailable
- **THEN** the resolver returns that reason to its caller so a degraded item stays distinguishable from a complete one

#### Scenario: No handler applies
- **WHEN** no handler matches the item's source type
- **THEN** the resolver reports the item as unhandled and no content is invented for it

#### Scenario: A handler fails
- **WHEN** the selected handler throws
- **THEN** the resolver propagates the error instead of turning it into content
