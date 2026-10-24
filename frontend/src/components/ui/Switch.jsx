import React from 'react';
import { clsx } from 'clsx';

export const Switch = React.forwardRef(({
  label,
  checked = false,
  onChange,
  disabled = false,
  className,
  id,
  ...props
}, ref) => {
  const switchId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <label htmlFor={switchId} className={clsx('inline-flex items-center gap-3 cursor-pointer select-none text-sm text-text', disabled && 'opacity-50 cursor-not-allowed')}>
      <div className="relative">
        <input
          ref={ref}
          type="checkbox"
          id={switchId}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div className={clsx(
          'w-9 h-5 rounded-full bg-surface-2 border border-border transition-colors duration-150 peer-checked:bg-primary peer-checked:border-primary',
          className
        )} />
        <div className="w-3.5 h-3.5 rounded-full bg-text-3 absolute left-0.75 top-0.75 transition-transform duration-150 peer-checked:translate-x-4 peer-checked:bg-primary-fg" />
      </div>
      {label && <span className="text-sm text-text">{label}</span>}
    </label>
  );
});

Switch.displayName = 'Switch';
