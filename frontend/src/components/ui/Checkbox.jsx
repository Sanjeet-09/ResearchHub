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
    <label htmlFor={checkboxId} className={clsx('inline-flex items-center gap-2.5 cursor-pointer select-none text-sm text-text', disabled && 'opacity-50 cursor-not-allowed')}>
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
          'w-4 h-4 rounded-[4px] border border-border bg-surface-2 transition-colors duration-150 peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-[#EDEDED] peer-focus-visible:outline-offset-2',
          className
        )} />
        {checked && <Check className="w-3 h-3 text-primary-fg absolute pointer-events-none stroke-[2.5]" />}
      </div>
      {label && <span className="text-sm text-text">{label}</span>}
    </label>
  );
});

Checkbox.displayName = 'Checkbox';
