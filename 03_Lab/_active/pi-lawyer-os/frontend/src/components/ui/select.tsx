import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Minimal native-select wrapper matching the shadcn/ui Select API surface
// that LeadIntakeForm uses:
//   <Select value={v} onValueChange={fn}>
//     <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
//     <SelectContent>
//       <SelectItem value="x">Label</SelectItem>
//     </SelectContent>
//   </Select>
// ---------------------------------------------------------------------------

interface SelectContextValue {
  value: string;
  onValueChange: (v: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  disabled: boolean;
}

const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  disabled: false,
});

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function Select({ value, defaultValue = '', onValueChange, disabled = false, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);

  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;

  function handleChange(v: string) {
    if (!controlled) setInternalValue(v);
    onValueChange?.(v);
    setOpen(false);
  }

  return (
    <SelectContext.Provider
      value={{ value: currentValue, onValueChange: handleChange, open, setOpen, disabled }}
    >
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, disabled } = React.useContext(SelectContext);
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext);
  return (
    <span className={value ? undefined : 'text-gray-400'}>
      {value || placeholder || ''}
    </span>
  );
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

function SelectContent({ children, className }: SelectContentProps) {
  const { open } = React.useContext(SelectContext);
  if (!open) return null;
  return (
    <div
      className={cn(
        'absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md',
        className
      )}
    >
      <div className="py-1">{children}</div>
    </div>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function SelectItem({ value, children, className }: SelectItemProps) {
  const { value: selectedValue, onValueChange } = React.useContext(SelectContext);
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center px-3 py-1.5 text-sm hover:bg-gray-100 cursor-pointer',
        selectedValue === value && 'font-medium bg-gray-50',
        className
      )}
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
