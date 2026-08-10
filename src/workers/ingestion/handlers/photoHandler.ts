import { ImageAnalysisService } from '../../../services/imageAnalysisService.js';
import { downloadTelegramFile } from '../../../utils/media/telegramFile.js';

interface PhotoHandlerResult {
  title: string;
  content: string;
}

/**
 * Ingests a photo sent to the bot: downloads it and reads it with the vision tier,
 * which transcribes any text in the image as well as describing it.
 */
export async function photoHandler(
  fileId: string,
  options: { caption?: string; itemId: string }
): Promise<PhotoHandlerResult> {
  console.log(`[PhotoHandler] Processing Telegram photo ${fileId}`);

  const file = await downloadTelegramFile(fileId, 'photo');
  try {
    const content = await ImageAnalysisService.analyze([file.filePath], {
      kind: 'imagen',
      ...(options.caption ? { caption: options.caption } : {}),
      usageMeta: { flow: 'web_extraction', itemId: options.itemId },
    });

    const title = options.caption?.trim().slice(0, 120) || 'Imagen sin título';
    return { title, content };
  } finally {
    file.cleanup();
  }
}
