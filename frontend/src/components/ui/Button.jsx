import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Button = React.forwardRef(({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'danger'
  size = 'md', // 'sm' (32px) | 'md' (36px) | 'lg' (44px)
  isLoading = false,
  disabled = false,
  className,
  type = 'button',
  icon: Icon,
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors duration-150 rounded-[8px] focus-visible:outline-2 focus-visible:outline-[#EDEDED] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none';

  const variants = {
    primary: 'bg-primary text-primary-fg font-medium hover:bg-white active:bg-[#EDEDED]',
    secondary: 'bg-surface-2 text-text border border-border hover:bg-surface-3 hover:border-border-strong',
    ghost: 'text-text-2 hover:text-text hover:bg-surface-2',
    danger: 'bg-danger-bg text-danger hover:bg-[#38181A] border border-transparent',
  };

  const sizes = {
    sm: 'text-xs px-3 h-8 gap-1.5',
    md: 'text-sm px-4 h-9 gap-2', // 36px default height
    lg: 'text-sm px-5 h-11 gap-2', // 44px login/register height
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={cn(baseStyles, variants[variant] || variants.primary, sizes[size], className)}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0 stroke-[1.75]" />
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
});

Button.displayName = 'Button';
