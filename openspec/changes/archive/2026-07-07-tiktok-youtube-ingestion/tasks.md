## 1. Setup & Security

- [x] 1.1 Install `youtube-dl-exec` and `ffmpeg-static` via npm
- [x] 1.2 Update BullMQ `ingestionQueue` config to include a rate `limiter` (e.g. 5 jobs/min) for social media jobs
- [x] 1.3 Create a strict Regex URL validator in `worker.ts` to prevent Command Injection

## 2. Media Extraction & Cleanup Utils

- [x] 2.1 Create `src/utils/media/ytDlpWrapper.ts` ensuring streams are used instead of Buffers
- [x] 2.2 Create `src/utils/media/vttParser.ts` to clean YouTube auto-captions timestamps
- [x] 2.3 Implement strict `try/finally` cleanup logic (`fs.unlinkSync`) in the wrapper to prevent Disk Leaks

## 3. LangGraph Agent (Multimodal Ingestion)

- [x] 3.1 Expand `LLMFactory` to accept specific model tiers (`vision`, `thinking`) from CLIProxyAPI
- [x] 3.2 Create `src/agents/ingestionAgent.ts` with nodes: Router, Downloader, AudioTranscriber, VisionAnalyzer, and KnowledgeSynthesizer
- [x] 3.3 Link `socialMediaHandler.ts` to invoke the `ingestionAgent` passing the sanitized URL

## 4. End-to-End Integration

- [x] 4.1 Update `worker.ts` to route YouTube/TikTok to `socialMediaHandler`
- [x] 4.2 Verify OOM limits by testing with a file close to 25MB using `fs.createReadStream`
