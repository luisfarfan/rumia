import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { bot } from '../../bot/client.js';

export interface DownloadedFile {
  filePath: string;
  cleanup: () => void;
}

/**
 * Downloads a Telegram file by its file_id into a temp path.
 *
 * Returns a cleanup callback the caller must run — Telegram media is fetched on
 * every ingest, so leaking these fills the disk quietly.
 */
export async function downloadTelegramFile(fileId: string, prefix = 'tg'): Promise<DownloadedFile> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  }

  const fileInfo = await bot.api.getFile(fileId);
  if (!fileInfo.file_path) {
    throw new Error(`Could not retrieve file path for Telegram fileId: ${fileId}`);
  }

  const ext = path.extname(fileInfo.file_path) || '.bin';
  const filePath = path.join(os.tmpdir(), `${prefix}-${fileId}${ext}`);

  const response = await fetch(`https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`);
  if (!response.ok) {
    throw new Error(`Failed to download file from Telegram: status ${response.status}`);
  }

  await fs.promises.writeFile(filePath, Buffer.from(await response.arrayBuffer()));

  return {
    filePath,
    cleanup: () => {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`[telegramFile] Failed to clean up ${filePath}:`, err);
      }
    },
  };
}
