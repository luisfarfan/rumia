'use client';

import { useEffect, useRef } from 'react';

type Handler = (event: KeyboardEvent) => void;

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

/**
 * Document-level shortcuts. Every binding except Escape is suppressed while the
 * caret is in a field, so typing "j" into the search box never jumps the list.
 */
export function useHotkeys(bindings: Record<string, Handler>) {
  const ref = useRef(bindings);
  ref.current = bindings;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const handler = ref.current[event.key];
      if (!handler) return;
      if (event.key !== 'Escape' && isTyping(event.target)) return;

      handler(event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
