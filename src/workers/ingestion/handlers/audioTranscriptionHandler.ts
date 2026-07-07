import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { bot } from '../../../bot/index.js';

interface AudioTranscriptionResult {
  content: string;
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
 * Helper to call Whisper API or fallback to mock transcription.
 */
async function executeTranscription(buffer: Buffer, ext: string): Promise<AudioTranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    console.log('[AudioTranscription] Sending audio buffer to Whisper API...');
    
    const formData = new FormData();
    const blob = new Blob([buffer as any], { type: 'audio/mpeg' });
    formData.append('file', blob, `audio${ext}`);
    formData.append('model', 'whisper-1');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      throw new Error(`Whisper API transcription failed: status ${whisperResponse.status} - ${errorText}`);
    }

    const result = (await whisperResponse.json()) as { text: string };
    console.log('[AudioTranscription] Transcription succeeded via Whisper.');
    return { content: result.text.trim() };
  } else {
    console.log('[AudioTranscription] No OPENAI_API_KEY found. Using mock transcription.');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      content: `[Transcripción Mock de Audio - Extensión: ${ext}]`,
    };
  }
}
