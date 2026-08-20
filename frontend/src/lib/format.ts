export const LANGUAGE_NAMES: Record<string, string> = {
  es: 'español',
  en: 'inglés',
  pt: 'portugués',
  fr: 'francés',
  de: 'alemán',
  it: 'italiano',
  ca: 'catalán',
  nl: 'neerlandés',
  ru: 'ruso',
  ja: 'japonés',
  zh: 'chino',
  ko: 'coreano',
  ar: 'árabe',
};

export const languageName = (code?: string | null) =>
  (code && LANGUAGE_NAMES[code]) || code || 'desconocido';

/** Spanish content offers English; everything else offers Spanish. Translating
 *  into the language the text is already in returns it unchanged, which reads
 *  as a button that does nothing. */
export const defaultTargetFor = (code?: string | null) => (code === 'es' ? 'inglés' : 'español');

export const TRANSLATION_TARGETS = ['español', 'inglés', 'português', 'français', 'deutsch'];

const RELATIVE = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const ABSOLUTE = new Intl.DateTimeFormat('es', { dateStyle: 'long', timeStyle: 'short' });
const SHORT = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "hace 4 min" beats "19 ago, 14:32" on a board that refreshes every ten
 *  seconds: the question is always how fresh, not which calendar day. */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const delta = then - now;
  const abs = Math.abs(delta);

  if (abs < MINUTE) return 'ahora mismo';
  if (abs < HOUR) return RELATIVE.format(Math.round(delta / MINUTE), 'minute');
  if (abs < DAY) return RELATIVE.format(Math.round(delta / HOUR), 'hour');
  if (abs < 7 * DAY) return RELATIVE.format(Math.round(delta / DAY), 'day');
  return SHORT.format(then);
}

export const absoluteTime = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? '' : ABSOLUTE.format(t);
};

/** Trim to a whole word so excerpts never end mid-syllable. */
export function excerpt(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

export const hostOf = (url?: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

/** Rough reading time for the entry, so a 6000-character wall announces itself
 *  before it is opened. */
export const readingMinutes = (text?: string | null) =>
  text ? Math.max(1, Math.round(text.trim().split(/\s+/).length / 220)) : 0;

const PLURALS: Record<string, [string, string]> = {
  entrada: ['entrada', 'entradas'],
  afirmacion: ['afirmación', 'afirmaciones'],
  relacion: ['relación', 'relaciones'],
  entidad: ['entidad', 'entidades'],
  fuente: ['fuente', 'fuentes'],
};

export const plural = (key: keyof typeof PLURALS | string, n: number) => {
  const forms = PLURALS[key];
  if (!forms) return key;
  return n === 1 ? forms[0] : forms[1];
};
