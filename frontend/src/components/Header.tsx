'use client';

import { LayoutList, Moon, Network, Sun } from 'lucide-react';
import type { ThemeState } from '@/hooks/useTheme';
import { plural } from '@/lib/format';
import { Mark } from '@/components/ui/Mark';

export type Tab = 'board' | 'graph';

const TABS: Array<{ key: Tab; label: string; Icon: typeof LayoutList }> = [
  { key: 'board', label: 'Tablón', Icon: LayoutList },
  { key: 'graph', label: 'Grafo', Icon: Network },
];

export function Header({
  tab,
  onTab,
  itemCount,
  live,
  theme,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  itemCount: number;
  /** False while the first poll is in flight or after one has failed. */
  live: boolean;
  theme: ThemeState;
}) {
  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-4 border-b border-rule bg-raised px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Mark />
        <div className="min-w-0">
          <h1 className="text-base leading-none font-semibold tracking-tight text-ink">Rumia</h1>
          <p className="mt-0.5 hidden truncate text-2xs text-faint sm:block">
            lo que ya te tragaste, masticado otra vez
          </p>
        </div>
      </div>

      <nav
        aria-label="Vistas"
        className="mx-auto flex gap-0.5 rounded-md border border-rule bg-sunken p-0.5"
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTab(key)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex h-7 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors duration-150 ${
                active
                  ? 'bg-paper text-ink shadow-card'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Icon size={14} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <span
          className="hidden items-center gap-1.5 text-xs text-faint sm:inline-flex"
          title={live ? 'El tablón se refresca cada diez segundos' : 'Sin conexión con la base'}
        >
          <span
            className={`size-1.5 rounded-full ${live ? 'animate-pulse bg-accent' : 'bg-bad'}`}
            aria-hidden="true"
          />
          {itemCount} {plural('entrada', itemCount)}
        </span>
        <button
          type="button"
          onClick={theme.cycle}
          className="btn btn-ghost btn-icon"
          aria-label={theme.resolved === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={theme.resolved === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme.resolved === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
