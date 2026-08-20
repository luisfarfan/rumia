'use client';

import { ArrowLeft, ArrowRight, MousePointerClick } from 'lucide-react';
import type { GraphData, GraphNode } from '@/lib/types';
import { endpointId } from '@/lib/types';
import { entityColor, entityName, humanizeRelation, type Theme } from '@/lib/entities';
import { plural } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * One entity and everything the extraction attached to it. Relations read as
 * sentences; the previous `--(WORKS_AT)--> Anthropic` rendering was a debug
 * dump wearing a UI.
 */
export function NodeInspector({
  node,
  data,
  theme,
  onSelect,
}: {
  node: GraphNode | null;
  data: GraphData;
  theme: Theme;
  onSelect: (node: GraphNode) => void;
}) {
  if (!node) {
    return (
      <EmptyState icon={MousePointerClick} title="Ningún nodo seleccionado">
        Toca cualquier punto de la red para ver qué es, qué propiedades guarda y con qué está
        conectado.
      </EmptyState>
    );
  }

  const relations = data.links
    .map((link) => {
      const from = endpointId(link.source);
      const to = endpointId(link.target);
      if (from !== node.id && to !== node.id) return null;
      const outbound = from === node.id;
      const otherId = outbound ? to : from;
      return {
        id: link.id,
        outbound,
        label: humanizeRelation(link.label),
        other: data.nodes.find((n) => n.id === otherId) ?? null,
        otherId,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => Number(b.outbound) - Number(a.outbound) || a.label.localeCompare(b.label));

  const properties = Object.entries(node.properties ?? {}).filter(
    ([, value]) => value !== null && value !== '' && value !== undefined,
  );

  return (
    <div className="animate-fade flex flex-col gap-5 p-5">
      <div>
        <span
          className="mb-2 inline-flex h-5 items-center gap-1.5 rounded-xs px-1.5 font-mono text-2xs tracking-wide text-ink uppercase"
          style={{ backgroundColor: `color-mix(in oklab, ${entityColor(node.label, theme)} 22%, transparent)` }}
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entityColor(node.label, theme) }}
            aria-hidden="true"
          />
          {entityName(node.label)}
        </span>
        <h2 className="text-lg leading-tight font-semibold text-balance text-ink">{node.name}</h2>
        <p className="mt-1 text-xs text-faint">
          {relations.length} {plural('relacion', relations.length)}
        </p>
      </div>

      {properties.length > 0 && (
        <section>
          <h3 className="u-label mb-2">Propiedades</h3>
          <dl className="well divide-y divide-rule">
            {properties.map(([key, value]) => (
              <div key={key} className="flex flex-col gap-0.5 px-3 py-2">
                <dt className="font-mono text-2xs tracking-wide text-faint uppercase">{key}</dt>
                <dd className="text-sm leading-snug text-ink">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {relations.length > 0 && (
        <section>
          <h3 className="u-label mb-2">Conexiones</h3>
          <ul className="flex flex-col gap-1">
            {relations.map((relation) => (
              <li key={relation.id}>
                <button
                  type="button"
                  disabled={!relation.other}
                  onClick={() => relation.other && onSelect(relation.other)}
                  className="group flex w-full items-baseline gap-2 rounded-sm px-2 py-1.5 text-left transition-colors enabled:hover:bg-hover disabled:cursor-default"
                >
                  {relation.outbound ? (
                    <ArrowRight size={12} className="shrink-0 translate-y-0.5 text-faint" aria-hidden="true" />
                  ) : (
                    <ArrowLeft size={12} className="shrink-0 translate-y-0.5 text-faint" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="text-muted">{relation.label} </span>
                    <span
                      className={`font-medium ${
                        relation.other ? 'text-ink group-hover:text-accent' : 'text-faint'
                      }`}
                    >
                      {relation.other?.name ?? relation.otherId}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
