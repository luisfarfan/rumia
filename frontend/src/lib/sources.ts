import {
  Code2,
  FileText,
  Image as ImageIcon,
  Link2,
  Mic,
  MessagesSquare,
  PenLine,
  Play,
  type LucideIcon,
} from 'lucide-react';

export type SourceFamily = 'video' | 'social' | 'article' | 'code' | 'photo' | 'audio' | 'note' | 'other';

/** Grouped by how the item was actually read, not by company: the three
 *  ingestion strategies are media download, Open Graph, and article text. */
const FAMILY_OF: Record<string, SourceFamily> = {
  youtube: 'video',
  tiktok: 'video',
  vimeo: 'video',
  twitch: 'video',
  dailymotion: 'video',
  soundcloud: 'audio',

  instagram: 'social',
  facebook: 'social',
  threads: 'social',
  bluesky: 'social',
  mastodon: 'social',
  x: 'social',
  twitter: 'social',
  pinterest: 'social',
  tumblr: 'social',
  reddit: 'social',
  linkedin: 'social',

  github: 'code',

  medium: 'article',
  substack: 'article',
  web: 'article',
  article: 'article',

  photo: 'photo',
  image: 'photo',
  audio: 'audio',
  voice: 'audio',
  text: 'note',
  note: 'note',
};

const ICON_OF: Record<SourceFamily, LucideIcon> = {
  video: Play,
  social: MessagesSquare,
  article: FileText,
  code: Code2,
  photo: ImageIcon,
  audio: Mic,
  note: PenLine,
  other: Link2,
};

/** Platforms whose own name is not the display name. */
const DISPLAY_NAME: Record<string, string> = {
  x: 'X',
  web: 'Web',
  github: 'GitHub',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  soundcloud: 'SoundCloud',
  photo: 'Foto',
  image: 'Imagen',
  audio: 'Audio',
  voice: 'Nota de voz',
  text: 'Nota',
  note: 'Nota',
};

export const sourceFamily = (type: string): SourceFamily => FAMILY_OF[type?.toLowerCase()] ?? 'other';

export const sourceIcon = (type: string): LucideIcon => ICON_OF[sourceFamily(type)];

export const sourceName = (type: string) => {
  if (!type) return 'Desconocido';
  const key = type.toLowerCase();
  return DISPLAY_NAME[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
};

export const CATEGORY_NAMES: Record<string, string> = {
  All: 'Todo',
  News: 'Noticia',
  Tutorial: 'Tutorial',
  Opinion: 'Opinión',
  Entertainment: 'Ocio',
  Documentation: 'Documentación',
  Other: 'Otro',
  Unknown: 'Sin clasificar',
};

export const categoryName = (category?: string | null) =>
  (category && CATEGORY_NAMES[category]) || category || 'Sin clasificar';
