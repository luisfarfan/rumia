'use client';

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import type { GraphData, GraphNode } from '@/lib/types';
import { endpointId } from '@/lib/types';
import { entityColor, entityColorAlpha, type Theme } from '@/lib/entities';

// Loaded on the client only: the library touches `window` at import time.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then((m) => m.default), {
  ssr: false,
});

/* The dynamic import erases the component's generics, so the published
   `ForceGraphMethods` type is the untyped default here. Two of the calls this
   component needs — retuning a d3 force and forcing a repaint — are absent from
   it entirely, so they go through one narrow declared surface rather than
   loosening the whole ref to `any`. */
interface D3Force {
  strength: (value: number) => D3Force;
  distance: (value: number) => D3Force;
  distanceMax: (value: number) => D3Force;
}

interface ForceGraphExtras {
  d3Force: (name: string) => D3Force | undefined;
  d3ReheatSimulation: () => void;
  refresh: () => void;
}

export interface GraphHandle {
  focus: (node: GraphNode) => void;
  fit: () => void;
  zoomBy: (factor: number) => void;
}

const INK = { light: 'oklch(0.245 0.015 60)', dark: 'oklch(0.940 0.008 85)' };
const RULE = { light: 'oklch(0.245 0.015 60 / 0.28)', dark: 'oklch(0.940 0.008 85 / 0.26)' };
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
  const fg = useRef<ForceGraphMethods | undefined>(undefined);
  const extras = () => fg.current as unknown as ForceGraphExtras | undefined;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  // Canvas does not resolve CSS variables, and next/font hashes the family
  // name, so the stack has to be read off the document once it exists. Held in
  // a ref because only the paint callback ever reads it.
  const fontStack = useRef('system-ui, sans-serif');

  useEffect(() => {
    fontStack.current = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    extras()?.refresh();
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

  /**
   * `zoomToFit` frames the extremes, and a knowledge graph always has a few
   * orphan entities drifting far from everything else — one of them shrinks the
   * whole network to a speck. Framing the middle 90% instead keeps the readable
   * part readable and lets the strays fall outside the view.
   */
  const fitToCluster = useCallback(
    (ms = 500) => {
      const graph = fg.current;
      if (!graph || !size.width || !size.height) return;

      // The simulation mutates the very objects handed to it, so the positions
      // land back on `data.nodes`; the React wrapper exposes no data getter.
      const nodes = data.nodes.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y));
      if (!nodes.length) return;

      const span = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const cut = Math.floor(sorted.length * 0.05);
        const lo = sorted[cut];
        const hi = sorted[sorted.length - 1 - cut];
        return { mid: (lo + hi) / 2, length: Math.max(1, hi - lo) };
      };

      const x = span(nodes.map((n) => n.x!));
      const y = span(nodes.map((n) => n.y!));
      const padding = 72;
      const scale = Math.min(
        (size.width - padding) / x.length,
        (size.height - padding) / y.length,
      );

      graph.centerAt(x.mid, y.mid, ms);
      graph.zoom(Math.min(2.5, Math.max(0.4, scale)), ms);
    },
    [size.width, size.height, data.nodes],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      focus: (node) => {
        if (!fg.current || !Number.isFinite(node.x)) return;
        fg.current.centerAt(node.x, node.y, 700);
        fg.current.zoom(2.4, 700);
      },
      fit: () => fitToCluster(600),
      zoomBy: (factor) => {
        if (!fg.current) return;
        fg.current.zoom(Math.min(12, Math.max(0.2, fg.current.zoom() * factor)), 260);
      },
    }),
    [fitToCluster],
  );

  const radiusOf = useCallback(
    (node: GraphNode) => 3 + Math.min(7, Math.sqrt(degree.get(node.id) ?? 0) * 1.9),
    [degree],
  );

  /* Two things have to happen the moment the canvas gains a size, which is the
     moment the graph tab is first opened rather than the moment this component
     mounts:

     1. Retune the forces. The stock charge of -30 packs 171 nodes into a
        confetti blob where no edge is legible; pushing them apart and
        lengthening the links turns it back into a diagram.
     2. Refit the camera. The simulation would otherwise spend its one
        automatic fit while the tab was still display:none. */
  useEffect(() => {
    if (!size.width || !size.height || !data.nodes.length) return;

    const graph = extras();
    if (graph) {
      graph.d3Force('charge')?.strength(-155).distanceMax(280);
      graph.d3Force('link')?.distance(46).strength(0.32);
      // Without this the unconnected entities drift off forever.
      graph.d3Force('center')?.strength(0.28);
      graph.d3ReheatSimulation();
    }

    // Long enough for the reheated simulation to have spread out; the engine's
    // own stop event frames it again once it truly settles.
    const id = setTimeout(() => fitToCluster(400), 1000);
    return () => clearTimeout(id);
  }, [size.width, size.height, data, fitToCluster]);

  /* Highlighting, dimming and the theme swap all change only how nodes are
     painted, not the graph data, and the engine has usually come to rest by
     then. Without an explicit refresh the canvas keeps showing the last frame
     the simulation drew. */
  useEffect(() => {
    extras()?.refresh();
  }, [hovered, selected?.id, hidden, theme]);

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

      // Labels arrive in two waves as the reader zooms: first the hubs, then
      // everything. 171 names drawn at once is noise, not a diagram.
      const hub = (degree.get(node.id) ?? 0) >= 5;
      const named = isFocus || scale > 3.2 || (hub && scale > 1.6);
      if (!dimmed && named) {
        // Divided by the scale so the label holds one constant on-screen size
        // however far the reader has zoomed in.
        const fontSize = 12 / scale;
        const pad = 3 / scale;
        ctx.font = `${isFocus ? 600 : 400} ${fontSize}px ${fontStack.current}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const text = node.name.length > 26 ? `${node.name.slice(0, 25)}…` : node.name;
        const width = ctx.measureText(text).width;
        const top = y + r + pad;

        ctx.fillStyle = PAPER[theme];
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x - width / 2 - pad, top, width + pad * 2, fontSize + pad);
        ctx.globalAlpha = 1;

        ctx.fillStyle = INK[theme];
        ctx.fillText(text, x, top + pad / 2);
      }
    },
    [isDimmed, hovered, selected?.id, theme, radiusOf, degree],
  );

  const pointerArea = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, radiusOf(node) + 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [radiusOf],
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
          onEngineStop={() => fitToCluster(400)}
        />
      )}
    </div>
  );
}
