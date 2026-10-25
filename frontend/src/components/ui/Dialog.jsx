import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = ({
  isOpen = false,
  onClose,
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  maxWidth = 'max-w-lg',
  size,
}) => {
  const isControlled = open !== undefined;
  const isShown = isControlled ? open : isOpen;
  const handleOpenChange = (nextOpen) => {
    if (onOpenChange) onOpenChange(nextOpen);
    if (!nextOpen && onClose) onClose();
  };

  const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };
  const resolvedWidth = size ? (sizeMap[size] || size) : maxWidth;

  return (
    <RadixDialog.Root open={isShown} onOpenChange={handleOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <RadixDialog.Content
            className={cn(
              'relative w-full max-h-[calc(100vh-2rem)] flex flex-col bg-[#111111] border border-[#242424] shadow-2xl shadow-black rounded-xl text-[#EDEDED] overflow-hidden z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150',
              resolvedWidth,
              className
            )}
          >
            {(title || onClose) && (
              <div className="px-5 py-4 border-b border-[#242424] flex items-center justify-between gap-4 flex-shrink-0">
                <div>
                  {title && (
                    <RadixDialog.Title className="text-base font-semibold text-[#EDEDED]">
                      {title}
                    </RadixDialog.Title>
                  )}
                  {description && (
                    <RadixDialog.Description className="text-xs text-[#A1A1A1] mt-0.5">
                      {description}
                    </RadixDialog.Description>
                  )}
                </div>
                {onClose && (
                  <RadixDialog.Close asChild>
                    <button
                      onClick={onClose}
                      className="text-[#6E6E6E] hover:text-[#EDEDED] p-1.5 rounded-lg hover:bg-[#171717] transition-colors flex-shrink-0"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4 stroke-[1.75]" />
                    </button>
                  </RadixDialog.Close>
                )}
              </div>
            )}
            <div className="p-5 overflow-y-auto flex-1">{children}</div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

