## ADDED Requirements

### Requirement: Download Telegram audio
The system SHALL download the audio file associated with a Telegram voice or audio message.

#### Scenario: Download voice note
- **WHEN** the handler receives a job for a voice note
- **THEN** it requests the file path from Telegram API, downloads the file binary, and stores it temporarily

### Requirement: Transcribe audio to text
The system SHALL transcribe downloaded audio files into plain text.

#### Scenario: Successful transcription
- **WHEN** the handler successfully downloads an audio file
- **THEN** it sends the file to an external API (like OpenAI Whisper) to obtain the text transcript

#### Scenario: File too large or unsupported
- **WHEN** the audio file exceeds API limits or is in an unsupported format
- **THEN** the handler throws an error detailing the issue for manual intervention or conversion

### Requirement: Cleanup temporary files
The system SHALL delete downloaded audio files after processing is complete.

#### Scenario: Normal cleanup
- **WHEN** transcription succeeds or fails terminally
- **THEN** the temporary audio file is removed from the local disk
