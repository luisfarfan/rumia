## ADDED Requirements

### Requirement: Multimodal Social Media Ingestion
The system SHALL ingest audio, metadata, and visual frames from YouTube and TikTok URLs using a LangGraph-based ingestion agent.

#### Scenario: User sends a TikTok URL
- **WHEN** the ingestion worker processes a valid TikTok URL
- **THEN** it downloads the audio, extracts 3-5 key visual frames, and uses both a Vision model and an Audio model to synthesize the final knowledge artifact.

### Requirement: Security & Stability
The system MUST protect the host from command injection, disk leaks, and OOM errors during media extraction.

#### Scenario: Malicious URL is submitted
- **WHEN** a URL containing shell characters (e.g. `https://youtube.com/watch?v=123; rm -rf /`) is processed
- **THEN** the worker SHALL reject the job instantly via strict Regex validation before invoking yt-dlp.

#### Scenario: Worker crashes during download
- **WHEN** the extraction process fails or times out
- **THEN** all temporary `.mp3` and `.jpg` files MUST be deleted from the `/tmp` directory via a guaranteed cleanup block.

### Requirement: Auto-Caption Fast Path
The system SHALL prioritize fetching auto-generated captions if available on YouTube videos, parsing them from VTT to plain text to save transcription costs.
