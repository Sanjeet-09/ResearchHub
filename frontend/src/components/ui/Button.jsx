import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Button = React.forwardRef(({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  isLoading = false,
  loading = false,
  disabled = false,
  className,
  type = 'button',
  icon: Icon,
  ...props
}, ref) => {
  const isBusy = isLoading || loading;
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-[#EDEDED] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none';

  const variants = {
    primary: 'bg-[#EDEDED] text-[#0A0A0A] hover:bg-white hover:text-[#0A0A0A] active:bg-[#EDEDED] active:text-[#0A0A0A]',
    secondary: 'bg-[#171717] text-[#EDEDED] border border-[#242424] hover:bg-[#242424] hover:text-white',
    outline: 'bg-[#171717] text-[#EDEDED] border border-[#242424] hover:bg-[#242424] hover:text-white',
    ghost: 'bg-transparent text-[#A1A1A1] hover:bg-[#1F1F1F] hover:text-[#EDEDED]',
    danger: 'bg-[#2D1315] text-[#F87171] border border-[#F87171]/20 hover:bg-[#3D1A1D]',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 h-8 gap-1.5',
    md: 'text-sm px-4 py-2 h-9 gap-2',
    lg: 'text-sm px-5 py-2.5 h-11 gap-2',
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isBusy}
      className={cn(baseStyles, variants[variant] || variants.primary, sizes[size], className)}
      {...props}
    >
      {isBusy ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0 stroke-[1.75]" />
      ) : null}
      {children && <span className={cn(variant === 'primary' && 'text-[#0A0A0A] hover:text-[#0A0A0A]')}>{children}</span>}
    </button>
  );
});

Button.displayName = 'Button';

