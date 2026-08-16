/**
 * The single place that knows which platform a URL belongs to and how it should
 * be read. Both the capture service and the ingestion dispatcher import from
 * here, so a platform is added in one file rather than three.
 */

/** How a source's content is obtained. */
export type SourceStrategy =
  | 'media' // yt-dlp: downloads audio and frames, then transcribes and reads them
  | 'post' // Open Graph: caption plus the post image read by the vision tier
  | 'web' // Readability: article text
  | 'file' // uploaded to the bot rather than linked
  | 'none'; // no route yet

interface SourceDefinition {
  /** Matched against the URL's hostname, ignoring a leading `www.`. */
  hosts: string[];
  strategy: SourceStrategy;
}

/**
 * Platforms yt-dlp can download. It supports well over a thousand sites; these
 * are the ones worth routing there rather than reading as a page, because the
 * media *is* the content.
 */
const MEDIA_SOURCES: Record<string, SourceDefinition> = {
  youtube: { hosts: ['youtube.com', 'youtu.be', 'm.youtube.com'], strategy: 'media' },
  tiktok: { hosts: ['tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com'], strategy: 'media' },
  vimeo: { hosts: ['vimeo.com', 'player.vimeo.com'], strategy: 'media' },
  twitch: { hosts: ['twitch.tv', 'clips.twitch.tv'], strategy: 'media' },
  dailymotion: { hosts: ['dailymotion.com', 'dai.ly'], strategy: 'media' },
  soundcloud: { hosts: ['soundcloud.com', 'on.soundcloud.com'], strategy: 'media' },
};

/**
 * Platforms that serve their content as Open Graph tags.
 *
 * Verified by request, not assumed: each of these returns a usable `og:title` or
 * `og:description` to a crawler user agent, with no session. It is the same
 * mechanism every link-preview card depends on.
 */
const POST_SOURCES: Record<string, SourceDefinition> = {
  instagram: { hosts: ['instagram.com', 'instagr.am'], strategy: 'post' },
  facebook: { hosts: ['facebook.com', 'fb.com', 'fb.watch', 'm.facebook.com'], strategy: 'post' },
  threads: { hosts: ['threads.com', 'threads.net'], strategy: 'post' },
  bluesky: { hosts: ['bsky.app'], strategy: 'post' },
  mastodon: { hosts: ['mastodon.social', 'mastodon.online', 'mas.to', 'fosstodon.org'], strategy: 'post' },
  pinterest: { hosts: ['pinterest.com', 'pin.it'], strategy: 'post' },
  tumblr: { hosts: ['tumblr.com'], strategy: 'post' },
  x: { hosts: ['x.com', 'twitter.com'], strategy: 'post' },
};

/** Platforms best read as an article. */
const WEB_SOURCES: Record<string, SourceDefinition> = {
  github: { hosts: ['github.com', 'gist.github.com'], strategy: 'web' },
  linkedin: { hosts: ['linkedin.com'], strategy: 'web' },
  medium: { hosts: ['medium.com'], strategy: 'web' },
  substack: { hosts: ['substack.com'], strategy: 'web' },
  /**
   * Reddit has no working route. Its JSON API answers 403 without OAuth,
   * `old.reddit.com` redirects, and a post's Open Graph tags are a generic stub
   * ("Explore this post and more from the programming community") with no title
   * and no body. Kept named so the dashboard can say why rather than showing a
   * bare URL.
   */
  reddit: { hosts: ['reddit.com', 'redd.it'], strategy: 'none' },
};

const ALL_SOURCES: Record<string, SourceDefinition> = {
  ...MEDIA_SOURCES,
  ...POST_SOURCES,
  ...WEB_SOURCES,
};

/** Strips `www.` so `www.tiktok.com` and `tiktok.com` are the same host. */
function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Names the platform a URL belongs to.
 *
 * Matches the hostname or any of its parent domains, so regional and mobile
 * subdomains (`m.youtube.com`, `es.wikipedia.org`) resolve without listing each
 * one. Unknown hosts are `web`, which is a real strategy, not a fallback for
 * failure.
 */
export function detectSource(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const hostname = hostnameOf(url);
  if (!hostname) return undefined;

  for (const [name, def] of Object.entries(ALL_SOURCES)) {
    if (def.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
      return name;
    }
  }

  if (url.toLowerCase().split('?')[0]?.endsWith('.pdf')) return 'pdf';
  return 'web';
}

/** How the named source should be read. Unknown names are read as web pages. */
export function strategyFor(source: string | undefined): SourceStrategy {
  if (!source) return 'web';
  if (source === 'photo') return 'file';
  if (source === 'audio' || source === 'voice') return 'file';
  if (source === 'pdf') return 'none';
  return ALL_SOURCES[source]?.strategy ?? 'web';
}

/** Every platform name known to the system, for tests and documentation. */
export const KNOWN_SOURCES = Object.keys(ALL_SOURCES);
