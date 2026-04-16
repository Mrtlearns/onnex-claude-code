/**
 * Headless DropdownMenu — no Radix dependency.
 * Closes on outside click or Escape key.
 */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// ── Context ──────────────────────────────────────────────────

interface DropdownCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const Ctx = createContext<DropdownCtx>({ open: false, setOpen: () => {} });

// ── Root ─────────────────────────────────────────────────────

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
    };
  }, []);

  return (
    <Ctx.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative inline-block">
        {children}
      </div>
    </Ctx.Provider>
  );
}

// ── Trigger ──────────────────────────────────────────────────

interface TriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}
export function DropdownMenuTrigger({ children, asChild }: TriggerProps) {
  const { open, setOpen } = useContext(Ctx);
  if (asChild && isValidElement(children)) {
    return cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => setOpen(!open),
    });
  }
  return (
    <button type="button" onClick={() => setOpen(!open)}>
      {children}
    </button>
  );
}

// ── Content ──────────────────────────────────────────────────

interface ContentProps {
  children: React.ReactNode;
  align?: 'start' | 'end' | 'center';
  className?: string;
}
export function DropdownMenuContent({ children, align = 'start', className }: ContentProps) {
  const { open } = useContext(Ctx);
  if (!open) return null;
  return (
    <div
      className={cn(
        'absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-white shadow-md',
        align === 'end' && 'right-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        align === 'start' && 'left-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Label ────────────────────────────────────────────────────

export function DropdownMenuLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-3 py-2 text-xs font-semibold text-gray-500', className)}>
      {children}
    </div>
  );
}

// ── Separator ────────────────────────────────────────────────

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-gray-100" />;
}

// ── Item ─────────────────────────────────────────────────────

interface ItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}
export function DropdownMenuItem({ children, onClick, className }: ItemProps) {
  const { setOpen } = useContext(Ctx);
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:bg-gray-50',
        className,
      )}
      onClick={() => {
        onClick?.();
        setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

// ── helpers (avoid extra imports) ────────────────────────────
import { isValidElement, cloneElement } from 'react';
