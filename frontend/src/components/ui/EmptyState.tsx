import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Empty states teach the interface rather than announcing an absence: each one
 * says what would fill this space and what to do to make it appear.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="animate-fade flex flex-1 flex-col items-center justify-center gap-3 px-8 py-20 text-center">
      <span className="mb-1 grid size-11 place-items-center rounded-md border border-rule bg-sunken">
        <Icon size={19} strokeWidth={1.6} className="text-faint" />
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children && (
        <p className="max-w-[38ch] text-sm leading-relaxed text-muted text-balance">{children}</p>
      )}
      {action}
    </div>
  );
}
