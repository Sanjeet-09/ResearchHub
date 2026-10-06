import React from 'react';
import { clsx } from 'clsx';

export const Input = React.forwardRef(({
  label,
  error,
  hint,
  mono = false,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-txt-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          'w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-sm text-txt placeholder:text-txt-faint transition-colors duration-150 focus:border-accent focus:bg-surface-3 outline-none',
          mono && 'font-mono text-xs',
          error && 'border-danger focus:border-danger',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
      {hint && !error && <span className="text-xs text-txt-faint">{hint}</span>}
    </div>
  );
});

Input.displayName = 'Input';
