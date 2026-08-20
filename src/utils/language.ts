import { franc } from 'franc';

/**
 * Language detection for captured content.
 *
 * Whisper already reports the language it heard, with a confidence — that is the
 * authoritative signal and is used whenever the item had speech. Everything else
 * (carousels, images, articles, Open Graph posts) has only text, so it is
 * detected from the text itself.
 */

/** ISO 639-3 (what franc returns) → ISO 639-1 (what Whisper and humans use). */
const THREE_TO_TWO: Record<string, string> = {
  spa: 'es', eng: 'en', por: 'pt', fra: 'fr', deu: 'de', ita: 'it',
  cat: 'ca', nld: 'nl', rus: 'ru', jpn: 'ja', kor: 'ko', cmn: 'zh',
  ara: 'ar', tur: 'tr', pol: 'pl', swe: 'sv', ell: 'el', hin: 'hi',
};

export const LANGUAGE_NAMES: Record<string, string> = {
  es: 'español', en: 'inglés', pt: 'portugués', fr: 'francés', de: 'alemán',
  it: 'italiano', ca: 'catalán', nl: 'neerlandés', ru: 'ruso', ja: 'japonés',
  ko: 'coreano', zh: 'chino', ar: 'árabe', tr: 'turco', pl: 'polaco',
  sv: 'sueco', el: 'griego', hi: 'hindi',
};

/**
 * Names the language of a passage, as an ISO 639-1 code.
 *
 * Returns null rather than guessing when the text is too short to be reliable —
 * a wrong language label is worse than none, because it would send the synthesis
 * prompt in the wrong direction.
 */
export function detectLanguage(text: string | null | undefined): string | null {
  if (!text) return null;
  const sample = text.replace(/\s+/g, ' ').trim();
  if (sample.length < 40) return null;

  const code = franc(sample.slice(0, 4000), { minLength: 20 });
  if (!code || code === 'und') return null;
  return THREE_TO_TWO[code] ?? null;
}

/** Human-readable name for a code, for prompts and the dashboard. */
export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  return LANGUAGE_NAMES[code] ?? code;
}
