import { createElement } from 'react';
import type { LucideProps } from 'lucide-react';
import { sourceIcon } from '@/lib/sources';

/**
 * The glyph for a platform, picked from the source string at call time.
 * Built with `createElement` rather than `const Icon = …; <Icon />`, which
 * would look to React like a component type invented on every render.
 */
export function SourceIcon({ type, ...props }: { type: string } & LucideProps) {
  return createElement(sourceIcon(type), props);
}
