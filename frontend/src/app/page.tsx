'use client';

import { useState } from 'react';
import { Header, type Tab } from '@/components/Header';
import { BoardView } from '@/components/board/BoardView';
import { GraphView } from '@/components/graph/GraphView';
import { useGraph } from '@/hooks/useGraph';
import { useItems } from '@/hooks/useItems';
import { useTheme } from '@/hooks/useTheme';

export default function Home() {
  const [tab, setTab] = useState<Tab>('board');
  const theme = useTheme();
  const items = useItems();
  const graph = useGraph();

  return (
    <div className="relative z-10 flex h-full flex-col">
      <Header
        tab={tab}
        onTab={setTab}
        itemCount={items.items.length}
        live={!items.loading && !items.error}
        theme={theme}
      />

      {/* Both views stay mounted: the force simulation settles once, and coming
          back from the board should not re-run the layout from scratch. */}
      <main className="flex min-h-0 flex-1 flex-col">
        <div className={tab === 'board' ? 'flex min-h-0 flex-1' : 'hidden'}>
          <BoardView state={items} active={tab === 'board'} />
        </div>
        <div className={tab === 'graph' ? 'flex min-h-0 flex-1' : 'hidden'}>
          <GraphView state={graph} theme={theme.resolved} />
        </div>
      </main>
    </div>
  );
}
