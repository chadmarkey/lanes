import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface AccessibleDialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  align?: 'center' | 'top';
  children: ReactNode;
}

/**
 * Shared accessible modal container:
 * - role="dialog" + aria-modal="true"
 * - Escape & backdrop click dismissal
 * - Tab / Shift+Tab focus trap
 * - Automatic focus entry and focus restoration to trigger on close
 */
export function AccessibleDialog({
  open,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  initialFocusRef,
  align = 'center',
  children,
}: AccessibleDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = window.requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const first = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (first) {
        first.focus();
      } else {
        containerRef.current?.focus();
      }
    });

    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !containerRef.current) return;
      const focusables = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !containerRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !containerRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  return (
    <div
      className={`lanes-dialog-backdrop fixed inset-0 z-50 flex justify-center bg-black/45 p-4 ${
        align === 'top' ? 'items-start pt-[10vh]' : 'items-center'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className="lanes-dialog-surface w-full max-w-fit outline-none"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Smooth CSS grid-row collapsible disclosure container.
 * Keeps content non-interactive & hidden from screen readers when closed.
 */
export function CollapsibleRegion({
  open,
  id,
  children,
}: {
  open: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="lanes-disclosure" data-open={open ? 'true' : 'false'} aria-hidden={!open}>
      <div className="lanes-disclosure-inner">{open ? children : null}</div>
    </div>
  );
}

/**
 * Dismisses an open popup menu on outside pointerdown or Escape,
 * and enables Up/Down/Home/End keyboard navigation across [role="menuitem"].
 */
export function useDismissibleMenu<T extends string>(
  openMenu: T | null,
  setOpenMenu: (next: T | null) => void,
  containerRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!openMenu) return;

    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpenMenu(null);
        return;
      }
      if (!containerRef.current) return;
      const menu = containerRef.current.querySelector<HTMLElement>('[role="menu"]');
      if (!menu) return;
      const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
      if (items.length === 0) return;

      const idx = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(idx + 1) % items.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu, setOpenMenu, containerRef]);
}

/**
 * Standard WAI-ARIA horizontal tablist keyboard handler (ArrowLeft / ArrowRight / Home / End).
 */
export function handleTablistKeyDown<T extends string>(
  e: KeyboardEvent<HTMLElement>,
  tabs: readonly T[],
  current: T,
  onSelect: (next: T) => void
) {
  const idx = tabs.indexOf(current);
  if (idx < 0) return;
  let nextIdx = -1;
  if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') nextIdx = 0;
  else if (e.key === 'End') nextIdx = tabs.length - 1;
  if (nextIdx >= 0) {
    e.preventDefault();
    onSelect(tabs[nextIdx]);
    const list = e.currentTarget;
    window.requestAnimationFrame(() => {
      const buttons = list.querySelectorAll<HTMLElement>('[role="tab"]');
      buttons[nextIdx]?.focus();
    });
  }
}

/**
 * Two-step inline confirmation hook for high-stakes actions (e.g. Merge to main).
 * First click arms the key for 4 seconds; second click triggers execution.
 */
export function useTwoStepConfirm(timeoutMs = 8000) {
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  function disarm() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmedKey(null);
  }

  function trigger(key: string, onConfirmed: () => unknown) {
    if (armedKey === key) {
      disarm();
      void onConfirmed();
      return;
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setArmedKey(key);
    timerRef.current = window.setTimeout(() => {
      setArmedKey((curr) => (curr === key ? null : curr));
      timerRef.current = null;
    }, timeoutMs);
  }

  return { armedKey, trigger, disarm };
}
