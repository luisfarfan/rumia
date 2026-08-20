'use client';

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { GraphData, GraphNode } from '@/lib/types';
import { endpointId } from '@/lib/types';
import { entityColor, entityColorAlpha, type Theme } from '@/lib/entities';

// Loaded on the client only: the library touches `window` at import time.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then((m) => m.default), {
  ssr: false,
});

export interface GraphHandle {
  focus: (node: GraphNode) => void;
  fit: () => void;
  zoomBy: (factor: number) => void;
}

const INK = { light: 'oklch(0.245 0.015 60)', dark: 'oklch(0.940 0.008 85)' };
const RULE = { light: 'oklch(0.245 0.015 60 / 0.22)', dark: 'oklch(0.940 0.008 85 / 0.20)' };
const PAPER = { light: 'oklch(0.976 0.006 85)', dark: 'oklch(0.172 0.011 72)' };

export function GraphCanvas({
  data,
  theme,
  hidden,
  selected,
  onSelect,
  handleRef,
}: {
  data: GraphData;
  theme: Theme;
  /** Entity labels the legend has switched off. */
  hidden: Set<string>;
  selected: GraphNode | null;
  onSelect: (node: GraphNode | null) => void;
  handleRef: React.RefObject<GraphHandle | null>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const fg = useRef<any>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  // Canvas does not resolve CSS variables, and next/font hashes the family
  // name, so the stack has to be read off the document once it exists.
  const [fontStack, setFontStack] = useState('system-ui, sans-serif');

  useEffect(() => {
    setFontStack(getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif');
  }, []);

  // The canvas needs pixel dimensions; the layout only gives it a flex box.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** How many edges touch each node, so hubs draw bigger than leaves. */
  const degree = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of data.links) {
      for (const id of [endpointId(link.source), endpointId(link.target)]) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [data.links]);

  /** Direct neighbours of whatever is focused, so the rest can recede instead
   *  of competing with it. */
  const neighbours = useMemo(() => {
    const anchor = hovered ?? selected?.id;
    if (!anchor) return null;
    const set = new Set<string>([anchor]);
    for (const link of data.links) {
      const a = endpointId(link.source);
      const b = endpointId(link.target);
      if (a === anchor) set.add(b);
      if (b === anchor) set.add(a);
    }
    return set;
  }, [data.links, hovered, selected?.id]);

  const isDimmed = useCallback(
    (node: GraphNode) => {
      if (hidden.has(node.label)) return true;
      return Boolean(neighbours) && !neighbours!.has(node.id);
    },
    [hidden, neighbours],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      focus: (node) => {
        if (!fg.current) return;
        fg.current.centerAt(node.x ?? 0, node.y ?? 0, 700);
        fg.current.zoom(3, 700);
      },
      fit: () => fg.current?.zoomToFit(600, 60),
      zoomBy: (factor) => {
        if (!fg.current) return;
        fg.current.zoom(Math.min(12, Math.max(0.2, fg.current.zoom() * factor)), 260);
      },
    }),
    [handleRef],
  );

  const radiusOf = (node: GraphNode) => 3 + Math.min(7, Math.sqrt(degree.get(node.id) ?? 0) * 1.9);

  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const dimmed = isDimmed(node);
      const isFocus = node.id === (hovered ?? selected?.id);
      const r = radiusOf(node);
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = dimmed
        ? entityColorAlpha(node.label, theme, 0.14)
        : entityColor(node.label, theme);
      ctx.fill();

      if (isFocus) {
        // A ring rather than a glow: the paper ground has no light to bloom.
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, 2 * Math.PI);
        ctx.strokeStyle = INK[theme];
        ctx.lineWidth = 1.5 / scale;
        ctx.stroke();
      }

      // Labels appear as the reader zooms in, and always for the focused node:
      // 161 names drawn at once is noise, not a diagram.
      if (!dimmed && (scale > 1.5 || isFocus)) {
        const fontSize = Math.max(9, 11 / scale);
        ctx.font = `${isFocus ? 600 : 400} ${fontSize}px ${fontStack}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const text = node.name.length > 26 ? `${node.name.slice(0, 25)}…` : node.name;
        const width = ctx.measureText(text).width;

        ctx.fillStyle = PAPER[theme];
        ctx.globalAlpha = 0.82;
        ctx.fillRect(x - width / 2 - 2, y + r + 2, width + 4, fontSize + 2);
        ctx.globalAlpha = 1;

        ctx.fillStyle = INK[theme];
        ctx.fillText(text, x, y + r + 3);
      }
    },
    [isDimmed, hovered, selected?.id, theme, degree, fontStack],
  );

  const pointerArea = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, radiusOf(node) + 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [degree],
  );

  const linkColor = useCallback(
    (link: { source: string | GraphNode; target: string | GraphNode }) => {
      const a = endpointId(link.source);
      const b = endpointId(link.target);
      if (hidden.size) {
        const nodeOf = (id: string) => data.nodes.find((n) => n.id === id);
        if (hidden.has(nodeOf(a)?.label ?? '') || hidden.has(nodeOf(b)?.label ?? '')) {
          return 'transparent';
        }
      }
      if (neighbours && !(neighbours.has(a) && neighbours.has(b))) {
        return theme === 'light' ? 'oklch(0.245 0.015 60 / 0.05)' : 'oklch(0.940 0.008 85 / 0.05)';
      }
      return RULE[theme];
    },
    [hidden, neighbours, theme, data.nodes],
  );

  return (
    <div ref={wrap} className="absolute inset-0">
      {size.width > 0 && (
        <ForceGraph2D
          ref={fg}
          graphData={data}
          width={size.width}
          height={size.height}
          backgroundColor="transparent"
          nodeCanvasObject={paintNode as never}
          nodePointerAreaPaint={pointerArea as never}
          nodeLabel={() => ''}
          linkColor={linkColor as never}
          linkWidth={1}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={linkColor as never}
          onNodeClick={((node: GraphNode) => onSelect(node)) as never}
          onNodeHover={((node: GraphNode | null) => setHovered(node?.id ?? null)) as never}
          onBackgroundClick={() => onSelect(null)}
          cooldownTicks={140}
          onEngineStop={() => fg.current?.zoomToFit(500, 70)}
        />
      )}
    </div>
  );
}
