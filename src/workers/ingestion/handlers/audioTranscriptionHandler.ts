import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { bot } from '../../../bot/client.js';

interface AudioTranscriptionResult {
  content: string;
  /** The language Whisper actually heard, as ISO 639-1. Authoritative: it comes
   *  from the audio itself, not from guessing at the text afterwards. */
  language: string | null;
}

/**
 * Transcribes audio. If fileId is a local filesystem path, transcribes it directly.
 * Otherwise, downloads the file from Telegram and transcribes it.
 */
export async function audioTranscriptionHandler(
  fileId: string,
  fileSize?: number
): Promise<AudioTranscriptionResult> {
  const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

  const isLocalFile = fs.existsSync(fileId);

  if (isLocalFile) {
    console.log(`[AudioTranscription] Detected local file path: ${fileId}. Transcribing directly...`);
    const stats = await fs.promises.stat(fileId);
    if (stats.size > MAX_SIZE) {
      throw new Error(`Audio file exceeds Whisper limit of 25MB (Size: ${(stats.size / (1024 * 1024)).toFixed(2)}MB)`);
    }

    const buffer = await fs.promises.readFile(fileId);
    const ext = path.extname(fileId) || '.mp3';

    return executeTranscription(buffer, ext);
  }

  // Telegram Ingestion Path
  console.log(`Starting audio transcription for Telegram fileId: ${fileId}`);
  if (fileSize && fileSize > MAX_SIZE) {
    throw new Error(`Audio file exceeds Whisper limit of 25MB (Size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB)`);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  }

  const fileInfo = await bot.api.getFile(fileId);
  if (!fileInfo.file_path) {
    throw new Error(`Could not retrieve file path for Telegram fileId: ${fileId}`);
  }

  const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
  const ext = path.extname(fileInfo.file_path) || '.oga';
  const tempFilePath = path.join(os.tmpdir(), `tg-${fileId}${ext}`);

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio file from Telegram: status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await fs.promises.writeFile(tempFilePath, buffer);
    console.log(`Temporary audio file saved to: ${tempFilePath}`);

    const stats = await fs.promises.stat(tempFilePath);
    if (stats.size > MAX_SIZE) {
      throw new Error(`Downloaded audio file exceeds Whisper limit of 25MB (Size: ${(stats.size / (1024 * 1024)).toFixed(2)}MB)`);
    }

    return await executeTranscription(buffer, ext);
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath);
        console.log(`Cleaned up temporary audio file: ${tempFilePath}`);
      }
    } catch (cleanupError) {
      console.error(`Failed to clean up temporary audio file ${tempFilePath}:`, cleanupError);
    }
  }
}

/**
 * Sends audio to an OpenAI-compatible transcription endpoint.
 *
 * There is deliberately no mock fallback. The previous version returned
 * "[Transcripción Mock de Audio]" whenever no API key was configured, and that
 * placeholder was stored as content, categorized, embedded and pushed into the
 * graph — every spoken item looked ingested while carrying nothing. A missing or
 * unreachable transcriber must fail loudly instead.
 */
async function executeTranscription(buffer: Buffer, ext: string): Promise<AudioTranscriptionResult> {
  const baseUrl = process.env.WHISPER_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      'WHISPER_BASE_URL is not configured, so audio cannot be transcribed. ' +
        'Point it at an OpenAI-compatible transcription endpoint (see .env.example).'
    );
  }

  const model = process.env.WHISPER_MODEL || 'large-v3';
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/audio/transcriptions`;

  console.log(`[AudioTranscription] Sending audio to ${endpoint} (model: ${model})...`);

  const formData = new FormData();
  formData.append('file', new Blob([buffer as any], { type: 'audio/mpeg' }), `audio${ext}`);
  formData.append('model', model);
  // No `language` field on purpose: forcing one degrades the other, and this
  // corpus mixes Spanish and English inside single sentences.

  const headers: Record<string, string> = {};
  const apiKey = process.env.WHISPER_API_KEY;
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, { method: 'POST', headers, body: formData });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Transcription failed: status ${response.status} - ${detail}`.trim());
  }

  const result = (await response.json()) as { text?: string; language?: string };
  const text = (result.text ?? '').trim();
  if (!text) {
    throw new Error('Transcription returned no text: refusing to store an empty transcript as content.');
  }

  console.log(`[AudioTranscription] Transcribed ${text.length} chars (language: ${result.language ?? 'auto'}).`);
  return { content: text, language: result.language ?? null };
}
