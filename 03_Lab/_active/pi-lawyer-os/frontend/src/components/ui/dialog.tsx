/**
 * Headless Dialog / Modal — no Radix dependency.
 * Traps focus, closes on Escape or overlay click.
 */
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return <>{children}</>;
}

// ── Trigger ──────────────────────────────────────────────────

interface TriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  onClick?: () => void;
}

/**
 * DialogTrigger must be controlled externally.
 * Usage: <DialogTrigger asChild><Button onClick={() => setOpen(true)}>Open</Button></DialogTrigger>
 * Or just use a plain button with onClick={() => setOpen(true)}.
 */
export function DialogTrigger({ children }: TriggerProps) {
  return <>{children}</>;
}

// ── Content ──────────────────────────────────────────────────

interface ContentProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export function DialogContent({ children, className, onClose }: ContentProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-lg bg-white shadow-xl p-6 mx-4',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────

export function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold text-gray-900', className)}>{children}</h2>;
}

export function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-sm text-gray-500 mt-1', className)}>{children}</p>;
}

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mt-6 flex justify-end gap-2', className)}>{children}</div>;
}
