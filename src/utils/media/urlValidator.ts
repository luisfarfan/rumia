/**
 * Validates that a social media URL is safe to pass to command-line tools.
 * Uses a strict whitelist of characters to prevent Command Injection.
 */
export function validateSocialMediaUrl(url: string): boolean {
  // Whitelist pattern: must start with https://, be from youtube/youtu.be/tiktok,
  // and contain only safe alphanumeric and standard URL characters (including @ and %).
  const safePattern = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|tiktok\.com)\/[a-zA-Z0-9_?=&/.-@%]+$/i;
  if (!safePattern.test(url)) {
    return false;
  }

  // Blacklist any potential shell metacharacters just to be absolutely certain
  const shellMetaChars = /[\s;$`"']/g;
  return !shellMetaChars.test(url);
}
