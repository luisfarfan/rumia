import youtubeDl from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export interface IngestionMediaResult {
  title: string;
  duration: number;
  /** The platform's own poster frame, for the dashboard preview. */
  thumbnailUrl: string | null;
  subtitlesText: string | null;
  audioPath: string | null;
  framePaths: string[];
  cleanup: () => void;
}

export class YtDlpWrapper {
  /**
   * Extracts metadata, downloads audio (if no subtitles found), and extracts keyframes from a YouTube/TikTok URL.
   * Returns a structured object with a cleanup function to prevent disk leaks.
   */
  static async extractMedia(url: string): Promise<IngestionMediaResult> {
    const uniqueId = `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const tempDir = path.join(os.tmpdir(), uniqueId);
    fs.mkdirSync(tempDir, { recursive: true });

    // Helper to track and safely delete files/directories
    const cleanup = () => {
      console.log(`[YtDlpWrapper] Cleaning up temporary directory: ${tempDir}`);
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (err) {
        console.error(`[YtDlpWrapper] Failed to clean up temp dir ${tempDir}:`, err);
      }
    };

    try {
      console.log(`[YtDlpWrapper] Fetching metadata for URL: ${url}`);
      // 1. Fetch Metadata
      const metadata = await (youtubeDl as any)(url, {
        dumpSingleJson: true,
        noWarnings: true,
        preferFreeFormats: true,
      });

      const title = metadata.title || 'Untitled Video';
      const duration = Number(metadata.duration) || 0;
      const thumbnailUrl: string | null = metadata.thumbnail || metadata.thumbnails?.at(-1)?.url || null;
      console.log(`[YtDlpWrapper] Metadata retrieved. Title: "${title}", Duration: ${duration}s`);

      // 2. Try fetching subtitles (Fast-Path for YouTube)
      let subtitlesText: string | null = null;
      let audioPath: string | null = null;
      let framePaths: string[] = [];

      const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');

      if (isYoutube) {
        console.log('[YtDlpWrapper] YouTube detected. Trying auto-captions download...');
        const subsPrefix = path.join(tempDir, 'subs');
        
        try {
          await (youtubeDl as any)(url, {
            writeAutoSubs: true,
            skipDownload: true,
            subLang: 'es,en',
            output: subsPrefix,
          });

          // Check if any subtitle file was downloaded (.vtt)
          const files = fs.readdirSync(tempDir);
          const subsFile = files.find((f) => f.startsWith('subs') && f.endsWith('.vtt'));
          
          if (subsFile) {
            const subsPath = path.join(tempDir, subsFile);
            const rawVtt = fs.readFileSync(subsPath, 'utf8');
            const { parseVtt } = await import('./vttParser.js');
            subtitlesText = parseVtt(rawVtt);
            console.log(`[YtDlpWrapper] Auto-captions successfully parsed (${subtitlesText.length} chars). Skipping Whisper transcription.`);
          }
        } catch (subError) {
          console.log('[YtDlpWrapper] No auto-captions found or failed to download. Will fall back to audio transcription.');
        }
      }

      // 3. Download Audio (if no subtitles were resolved)
      if (!subtitlesText) {
        console.log('[YtDlpWrapper] Downloading audio stream...');
        const tempAudioPath = path.join(tempDir, 'audio.mp3');
        
        await (youtubeDl as any)(url, {
          extractAudio: true,
          audioFormat: 'mp3',
          output: tempAudioPath,
        });

        if (fs.existsSync(tempAudioPath)) {
          audioPath = tempAudioPath;
          console.log(`[YtDlpWrapper] Audio downloaded to: ${audioPath}`);
        }
      }

      // 4. Extract Keyframes (Multimodal Context)
      // We extract 5 frames spaced evenly throughout the video duration
      if (duration > 0 && ffmpegPath) {
        console.log('[YtDlpWrapper] Downloading low-res video stream for frame extraction...');
        const tempVideoPath = path.join(tempDir, 'video.mp4');
        
        // Download lowest resolution video format to save bandwidth
        await (youtubeDl as any)(url, {
          format: 'worst[ext=mp4]/worst',
          output: tempVideoPath,
        });

        if (fs.existsSync(tempVideoPath)) {
          console.log(`[YtDlpWrapper] Extracting visual frames using FFmpeg static...`);
          const interval = duration / 5;
          const fps = 1 / Math.max(1, interval);
          const framePattern = path.join(tempDir, 'frame-%03d.jpg');

          const binaryPath = ffmpegPath as any as string;
          await execFileAsync(binaryPath, [
            '-i', tempVideoPath,
            '-vf', `fps=${fps}`,
            '-vframes', '5',
            framePattern,
          ]);

          // Collect extracted frames
          const files = fs.readdirSync(tempDir);
          framePaths = files
            .filter((f) => f.startsWith('frame-') && f.endsWith('.jpg'))
            .map((f) => path.join(tempDir, f))
            .sort();

          console.log(`[YtDlpWrapper] Extracted ${framePaths.length} keyframes.`);
        }
      }

      return {
        title,
        duration,
        thumbnailUrl,
        subtitlesText,
        audioPath,
        framePaths,
        cleanup,
      };
    } catch (error) {
      // In case of any failure during extraction, clean up immediately to avoid disk leaks
      cleanup();
      throw error;
    }
  }
}
