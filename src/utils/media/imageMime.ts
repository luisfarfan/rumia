import * as path from 'path';

const BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
};

/**
 * Resolves the media type for a data URI from the file's extension.
 *
 * Both providers used to label every image `image/jpeg` regardless of what it
 * was. TikTok carousels arrive as webp, so a mislabelled payload would reach the
 * vision model as a JPEG that is not one.
 */
export function imageMimeType(filePath: string): string {
  return BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'image/jpeg';
}

/**
 * Picks a file extension from a served `Content-Type`.
 *
 * Trusting the URL instead is not safe: Facebook serves post images from paths
 * ending in `.png` whose bytes are actually JPEG, and saving those as `.png`
 * makes the data URI declare a type the payload does not have — which the vision
 * model rejects. The response header describes the bytes; the path does not.
 */
export function extensionForContentType(contentType: string | null | undefined): string | null {
  if (!contentType) return null;
  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  if (!normalized) return null;

  for (const [ext, mime] of Object.entries(BY_EXTENSION)) {
    if (mime === normalized) return ext === '.jpeg' ? '.jpg' : ext;
  }
  return null;
}
