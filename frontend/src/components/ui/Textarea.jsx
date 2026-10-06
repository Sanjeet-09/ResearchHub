import React from 'react';
import { clsx } from 'clsx';

export const Textarea = React.forwardRef(({
  label,
  error,
  hint,
  mono = false,
  rows = 4,
  className,
  id,
  ...props
}, ref) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-xs font-semibold uppercase tracking-wider text-txt-muted">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={clsx(
          'w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-sm text-txt placeholder:text-txt-faint transition-colors duration-150 focus:border-accent focus:bg-surface-3 outline-none resize-y',
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

Textarea.displayName = 'Textarea';
