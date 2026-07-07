## MODIFIED Requirements

### Requirement: Local File Support for Transcription
The system SHALL support transcribing local audio files directly, in addition to Telegram Voice Notes.

#### Scenario: Worker requests transcription of a downloaded MP3
- **WHEN** a local MP3 file path is provided to the audioTranscriptionHandler
- **THEN** it sends the local file buffer directly to the Whisper API, bypassing the Telegram file download step
