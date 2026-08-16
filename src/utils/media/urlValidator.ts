/**
 * Validates that a media URL is safe to pass to command-line tools.
 *
 * yt-dlp handles well over a thousand sites, but only the platforms actually
 * routed to it are allowed here: a whitelist that grows by accident stops being
 * a whitelist. The character class is escaped deliberately — `.-@` unescaped is
 * a *range* (0x2E–0x40) that quietly admits `:` `;` `<` `=` `>` `?`.
 */
export function validateSocialMediaUrl(url: string): boolean {
  // Whitelist pattern: must start with https://, be from youtube/youtu.be/tiktok,
  // and contain only safe alphanumeric and standard URL characters (including @ and %).
  const safePattern =
    /^https:\/\/(?:[a-zA-Z0-9-]+\.)*(?:youtube\.com|youtu\.be|tiktok\.com|vimeo\.com|twitch\.tv|dailymotion\.com|dai\.ly|soundcloud\.com)\/[a-zA-Z0-9_?=&/.\-@%]+$/i;
  if (!safePattern.test(url)) {
    return false;
  }

  // Blacklist any potential shell metacharacters just to be absolutely certain
  const shellMetaChars = /[\s;$`"']/g;
  return !shellMetaChars.test(url);
}
