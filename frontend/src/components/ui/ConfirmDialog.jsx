import React, { useState, useEffect } from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { Button } from './Button';
import { Input } from './Input';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ConfirmDialog = ({
  isOpen = false,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description = 'Are you sure you want to proceed?',
  confirmName, // If provided, user must type this exact string to confirm
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger' | 'primary'
  isLoading = false,
}) => {
  const [typedName, setTypedName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTypedName('');
    }
  }, [isOpen]);

  const isConfirmedDisabled = confirmName ? typedName.trim() !== confirmName.trim() : false;

  const handleOpenChange = (open) => {
    if (!open && onClose) {
      onClose();
    }
  };

  return (
    <AlertDialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-70 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 overflow-y-auto">
          <AlertDialogPrimitive.Content
            className={cn(
              'relative w-full max-w-md bg-surface-1 border border-border-strong rounded-[12px] shadow-floating p-5 z-10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150 flex flex-col gap-4'
            )}
          >
            <div className="flex items-start gap-3">
              {variant === 'danger' && (
                <div className="p-2 rounded-full bg-danger-bg text-danger shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 stroke-[1.75]" />
                </div>
              )}
              <div>
                <AlertDialogPrimitive.Title className="text-base font-semibold text-text">
                  {title}
                </AlertDialogPrimitive.Title>
                <AlertDialogPrimitive.Description className="text-xs text-text-2 mt-1 leading-relaxed">
                  {description}
                </AlertDialogPrimitive.Description>
              </div>
            </div>

            {confirmName && (
              <div className="mt-1 flex flex-col gap-2">
                <p className="text-xs text-text-3">
                  To confirm, type <span className="font-mono font-medium text-text px-1.5 py-0.5 rounded bg-surface-2 border border-border">{confirmName}</span> below:
                </p>
                <Input
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={confirmName}
                  mono
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-border">
              <AlertDialogPrimitive.Cancel asChild>
                <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                  {cancelText}
                </Button>
              </AlertDialogPrimitive.Cancel>
              <Button
                variant={variant === 'danger' ? 'danger' : 'primary'}
                onClick={onConfirm}
                disabled={isConfirmedDisabled}
                isLoading={isLoading}
              >
                {confirmText}
              </Button>
            </div>
          </AlertDialogPrimitive.Content>
        </div>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
};
