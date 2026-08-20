export type Theme = 'light' | 'dark';

interface EntityType {
  /** Label as the extraction agent writes it into `nodes.label`. */
  key: string;
  name: string;
  /** Two tunings of one hue: dark ink on paper, bright ink at night. Canvas is
   *  painted in JS, so these cannot live in CSS variables. */
  light: string;
  dark: string;
}

/* A risograph set rather than the usual screen primaries: every hue is pulled
   toward print ink so the network reads as a drawn diagram on the paper ground
   instead of a neon constellation. */
const TYPES: EntityType[] = [
  { key: 'Person', name: 'Persona', light: 'oklch(0.545 0.145 32)', dark: 'oklch(0.730 0.130 32)' },
  { key: 'Organization', name: 'Organización', light: 'oklch(0.500 0.115 252)', dark: 'oklch(0.715 0.105 252)' },
  { key: 'Location', name: 'Lugar', light: 'oklch(0.520 0.090 192)', dark: 'oklch(0.750 0.085 192)' },
  { key: 'Technology', name: 'Tecnología', light: 'oklch(0.505 0.130 305)', dark: 'oklch(0.725 0.115 305)' },
  { key: 'Event', name: 'Evento', light: 'oklch(0.585 0.115 68)', dark: 'oklch(0.785 0.110 72)' },
  { key: 'Concept', name: 'Concepto', light: 'oklch(0.550 0.140 350)', dark: 'oklch(0.730 0.125 350)' },
];

const FALLBACK: EntityType = {
  key: 'Other',
  name: 'Otro',
  light: 'oklch(0.575 0.012 70)',
  dark: 'oklch(0.660 0.012 75)',
};

export const ENTITY_TYPES = TYPES;

const byKey = new Map(TYPES.map((t) => [t.key, t]));

export const entityName = (label: string) => byKey.get(label)?.name ?? label;

export const entityColor = (label: string, theme: Theme) =>
  (byKey.get(label) ?? FALLBACK)[theme];

/** Same hue, translucent, for links and dimmed nodes. */
export function entityColorAlpha(label: string, theme: Theme, alpha: number) {
  const base = entityColor(label, theme);
  return base.replace(/\)$/, ` / ${alpha})`);
}

/** Relation types come out of the model in SCREAMING_SNAKE. Nobody reads that
 *  as a sentence, so the inspector lowercases and spaces it. */
export const humanizeRelation = (label: string) =>
  label.replace(/_/g, ' ').toLowerCase();
