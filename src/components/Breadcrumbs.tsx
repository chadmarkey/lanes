import { ChevronRight, GitBranch, House } from 'lucide-react';
import type { BreadcrumbItem, BreadcrumbTarget } from '../lib/types';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (target: BreadcrumbTarget) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      data-testid="breadcrumb-nav"
      data-tauri-drag-region=""
      className="flex h-11 shrink-0 items-center border-b px-4 md:px-6"
      style={{
        backgroundColor: 'var(--l-bg)',
        borderColor: 'var(--l-line)',
      }}
    >
      <ol className="m-0 flex min-w-0 flex-1 list-none items-center gap-1 overflow-x-auto px-0.5 py-1.5 text-[13px]">
        {items.map((item, idx) => {
          const isHome = item.target.kind === 'home';
          const isBranch = item.target.kind === 'branch';

          return (
            <li key={item.id} className="flex min-w-0 shrink-0 items-center gap-1">
              {idx > 0 && (
                <ChevronRight
                  size={13}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="shrink-0"
                  style={{ color: 'var(--l-faint)' }}
                />
              )}

              {item.current ? (
                <span
                  aria-current="page"
                  className="inline-flex max-w-[200px] items-center gap-1.5 truncate rounded-[6px] px-1.5 py-0.5 font-medium sm:max-w-[320px]"
                  style={{ color: 'var(--l-text)' }}
                >
                  {isHome && (
                    <House
                      size={13}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="shrink-0"
                      style={{ color: 'var(--l-accent)' }}
                    />
                  )}
                  {item.laneColor && (
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: `var(--l-type-${item.laneColor})` }}
                    />
                  )}
                  {isBranch && (
                    <GitBranch
                      size={12}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="shrink-0"
                      style={{ color: 'var(--l-accent)' }}
                    />
                  )}
                  <span className="truncate">{item.label}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(item.target)}
                  className="inline-flex max-w-[160px] items-center gap-1.5 truncate rounded-[6px] px-1.5 py-0.5 transition-colors hover:bg-[var(--l-hover)] sm:max-w-[240px]"
                  style={{ color: 'var(--l-muted)' }}
                >
                  {isHome && (
                    <House
                      size={13}
                      strokeWidth={1.9}
                      aria-hidden="true"
                      className="shrink-0"
                    />
                  )}
                  {item.laneColor && (
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: `var(--l-type-${item.laneColor})` }}
                    />
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
