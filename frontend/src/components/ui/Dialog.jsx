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
}) => {
  const isControlled = open !== undefined;
  const isShown = isControlled ? open : isOpen;
  const handleOpenChange = (nextOpen) => {
    if (onOpenChange) onOpenChange(nextOpen);
    if (!nextOpen && onClose) onClose();
  };

  return (
    <RadixDialog.Root open={isShown} onOpenChange={handleOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-70 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 overflow-y-auto">
          <RadixDialog.Content
            className={cn(
              'relative w-full max-h-[calc(100vh-2rem)] flex flex-col bg-surface-1 border border-border-strong rounded-[12px] shadow-floating overflow-hidden z-10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150',
              maxWidth,
              className
            )}
          >
            {(title || onClose) && (
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
                <div>
                  {title && (
                    <RadixDialog.Title className="text-base font-semibold text-text">
                      {title}
                    </RadixDialog.Title>
                  )}
                  {description && (
                    <RadixDialog.Description className="text-xs text-text-2 mt-0.5">
                      {description}
                    </RadixDialog.Description>
                  )}
                </div>
                {onClose && (
                  <RadixDialog.Close asChild>
                    <button
                      onClick={onClose}
                      className="text-text-3 hover:text-text p-1.5 rounded-[8px] hover:bg-surface-2 transition-colors flex-shrink-0"
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
