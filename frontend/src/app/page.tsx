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

      {/* Both views are stacked and only hidden with `visibility`, never
          `display: none`. The graph is a canvas that measures itself: with no
          box to measure it mounts at zero, the force simulation settles
          off-screen, and its one automatic fit is spent before anyone looks.
          `inert` keeps the hidden pane out of focus and the accessibility tree. */}
      <main className="relative flex min-h-0 flex-1">
        <Pane visible={tab === 'board'}>
          <BoardView state={items} active={tab === 'board'} />
        </Pane>
        <Pane visible={tab === 'graph'}>
          <GraphView state={graph} theme={theme.resolved} />
        </Pane>
      </main>
    </div>
  );
}

function Pane({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 flex ${visible ? '' : 'invisible'}`}
      inert={!visible}
    >
      {children}
    </div>
  );
}
