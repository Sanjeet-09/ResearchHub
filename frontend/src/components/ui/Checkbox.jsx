import React from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

export const Checkbox = React.forwardRef(({
  label,
  checked = false,
  onChange,
  disabled = false,
  className,
  id,
  ...props
}, ref) => {
  const checkboxId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <label htmlFor={checkboxId} className={clsx('inline-flex items-center gap-2.5 cursor-pointer select-none text-sm text-txt', disabled && 'opacity-50 cursor-not-allowed')}>
      <div className="relative flex items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div className={clsx(
          'w-4 h-4 rounded border border-border bg-surface-2 transition-colors duration-150 peer-checked:bg-accent peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg',
          className
        )} />
        {checked && <Check className="w-3 h-3 text-bg absolute pointer-events-none stroke-[3]" />}
      </div>
      {label && <span>{label}</span>}
    </label>
  );
});

Checkbox.displayName = 'Checkbox';
