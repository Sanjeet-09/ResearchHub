import React from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

export const Select = React.forwardRef(({
  label,
  options = [],
  error,
  hint,
  className,
  id,
  children,
  ...props
}, ref) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-wider text-txt-muted">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'w-full appearance-none bg-surface-2 border border-border rounded-input px-3 py-2 pr-8 text-sm text-txt transition-colors duration-150 focus:border-accent focus:bg-surface-3 outline-none cursor-pointer',
            error && 'border-danger focus:border-danger',
            className
          )}
          {...props}
        >
          {children ? children : options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface-2 text-txt">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-txt-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
      {hint && !error && <span className="text-xs text-txt-faint">{hint}</span>}
    </div>
  );
});

Select.displayName = 'Select';
