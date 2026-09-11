'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Theme } from '@/lib/entities';

export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'rumia-theme';

/** Runs before first paint, inlined in the document head. Without it the page
 *  renders as paper and then flips to night, which is worse than either. */
export const THEME_BOOTSTRAP = `(function(){try{var c=localStorage.getItem('${THEME_STORAGE_KEY}');if(c==='light'||c==='dark'){document.documentElement.dataset.theme=c}}catch(e){}})()`;

/* The root element is the single source of truth: the bootstrap script above
   has already stamped it before React exists, so reading it during hydration
   gives the same answer the server rendered against, and the theme never has to
   be copied into component state. */

const listeners = new Set<() => void>();

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener('change', onChange);
  };
}

function currentChoice(): ThemeChoice {
  const stamped = document.documentElement.dataset.theme;
  return stamped === 'light' || stamped === 'dark' ? stamped : 'system';
}

// A single string so the snapshot stays referentially stable between renders.
function getSnapshot(): string {
  const choice = currentChoice();
  const resolved = choice === 'system' ? (prefersDark() ? 'dark' : 'light') : choice;
  return `${choice}:${resolved}`;
}

const getServerSnapshot = () => 'system:light';

export interface ThemeState {
  choice: ThemeChoice;
  /** What is actually on screen right now. The graph canvas paints in JS and
   *  needs a concrete answer, not a media query. */
  resolved: Theme;
  cycle: () => void;
}

export function useTheme(): ThemeState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [choice, resolved] = snapshot.split(':') as [ThemeChoice, Theme];

  const cycle = useCallback(() => {
    const now = currentChoice();
    const next: ThemeChoice =
      now === 'system' ? (prefersDark() ? 'light' : 'dark') : now === 'dark' ? 'light' : 'dark';

    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing refuses the write; the choice still applies for the
      // life of the tab.
    }
    listeners.forEach((notify) => notify());
  }, []);

  return { choice, resolved, cycle };
}
