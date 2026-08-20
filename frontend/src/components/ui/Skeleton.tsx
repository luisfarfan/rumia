import type { CSSProperties } from 'react';

/**
 * Loading placeholders shaped like the rows they replace, so the layout does
 * not jump when the data lands. A spinner in the middle of the content area
 * tells the reader nothing about what is coming.
 */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-shimmer rounded-xs ${className}`} style={style} />;
}

export function ItemRowSkeleton({ index = 0 }: { index?: number }) {
  // Staggered widths so eight placeholders don't read as a printed pattern.
  const titleWidth = ['72%', '54%', '65%', '46%'][index % 4];
  const bodyWidth = ['88%', '76%', '92%', '68%'][index % 4];

  return (
    <div className="flex gap-4 px-5 py-5" aria-hidden="true">
      <Skeleton className="size-[104px] shrink-0 rounded-sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-0.5">
        <div className="flex gap-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-4" style={{ width: titleWidth }} />
        <Skeleton className="h-3" style={{ width: bodyWidth }} />
        <Skeleton className="mt-1 h-2.5 w-40" />
      </div>
    </div>
  );
}
