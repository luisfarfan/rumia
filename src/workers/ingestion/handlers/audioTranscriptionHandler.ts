import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { bot } from '../../../bot/index.js';

interface AudioTranscriptionResult {
  content: string;
}

/**
 * Downloads audio from Telegram, sends it to Whisper (if API key exists) or mocks it, and deletes the temporary file.
 */
export async function audioTranscriptionHandler(
  fileId: string,
  fileSize?: number
): Promise<AudioTranscriptionResult> {
  console.log(`Starting audio transcription for Telegram fileId: ${fileId}`);

  // Check file size limit (25 MB = 25 * 1024 * 1024 bytes)
  const MAX_SIZE = 25 * 1024 * 1024;
  if (fileSize && fileSize > MAX_SIZE) {
    throw new Error(`Audio file exceeds Whisper limit of 25MB (Size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB)`);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  }

  // 1. Get file path from Telegram API
  const fileInfo = await bot.api.getFile(fileId);
  if (!fileInfo.file_path) {
    throw new Error(`Could not retrieve file path for Telegram fileId: ${fileId}`);
  }

  const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
  const ext = path.extname(fileInfo.file_path) || '.oga';
  const tempFilePath = path.join(os.tmpdir(), `tg-${fileId}${ext}`);

  try {
    // 2. Download the file binary
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio file from Telegram: status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Save to temp file on local disk
    await fs.promises.writeFile(tempFilePath, buffer);
    console.log(`Temporary audio file saved to: ${tempFilePath}`);

    // Check actual file size on disk if not provided
    const stats = await fs.promises.stat(tempFilePath);
    if (stats.size > MAX_SIZE) {
      throw new Error(`Downloaded audio file exceeds Whisper limit of 25MB (Size: ${(stats.size / (1024 * 1024)).toFixed(2)}MB)`);
    }

    // 3. Transcribe audio to text
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      console.log('OpenAI API Key detected. Sending audio to Whisper API...');
      
      const formData = new FormData();
      // Native Blob in Node 18+
      const blob = new Blob([buffer], { type: 'audio/ogg' });
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
      console.log('Transcription succeeded via Whisper.');
      return { content: result.text.trim() };
    } else {
      console.log('No OPENAI_API_KEY found. Using mock transcription.');
      // Simulate API latency
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
        content: `[Transcripción Mock de Audio/Nota de voz de Telegram - ID del archivo: ${fileId}]`,
      };
    }
  } finally {
    // 4. Cleanup temporary files
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
