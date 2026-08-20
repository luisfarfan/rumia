'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Theme } from '@/lib/entities';

export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'rumia-theme';

/** Runs before first paint, inlined in the document head. Without it the page
 *  renders as paper and then flips to night, which is worse than either. */
export const THEME_BOOTSTRAP = `(function(){try{var c=localStorage.getItem('${THEME_STORAGE_KEY}');if(c==='light'||c==='dark'){document.documentElement.dataset.theme=c}}catch(e){}})()`;

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

export interface ThemeState {
  choice: ThemeChoice;
  /** What is actually on screen right now. The graph canvas paints in JS and
   *  needs a concrete answer, not a media query. */
  resolved: Theme;
  cycle: () => void;
}

export function useTheme(): ThemeState {
  const [choice, setChoice] = useState<ThemeChoice>('system');
  const [resolved, setResolved] = useState<Theme>('light');

  // Server-rendered markup has no theme; reading it during hydration instead of
  // during render keeps the two passes identical.
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const initial: ThemeChoice = stored === 'light' || stored === 'dark' ? stored : 'system';
    setChoice(initial);
    setResolved(initial === 'system' ? systemTheme() : initial);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === 'system') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = choice;
    }

    if (choice !== 'system') {
      setResolved(choice);
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setResolved(media.matches ? 'dark' : 'light');
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [choice]);

  const cycle = useCallback(() => {
    setChoice((current) => {
      const next: ThemeChoice =
        current === 'system' ? (systemTheme() === 'dark' ? 'light' : 'dark') : current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Private browsing refuses the write; the choice still applies for the
        // life of the tab.
      }
      return next;
    });
  }, []);

  return { choice, resolved, cycle };
}
