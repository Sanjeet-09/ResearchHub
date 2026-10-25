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
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <AlertDialogPrimitive.Content
            className={cn(
              'relative w-full max-w-md bg-[#111111] border border-[#242424] shadow-2xl shadow-black rounded-xl text-[#EDEDED] p-5 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150 flex flex-col gap-4'
            )}
          >
            <div className="flex items-start gap-3">
              {variant === 'danger' && (
                <div className="p-2 rounded-full bg-[#2D1315] text-[#F87171] shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 stroke-[1.75]" />
                </div>
              )}
              <div>
                <AlertDialogPrimitive.Title className="text-base font-semibold text-[#EDEDED]">
                  {title}
                </AlertDialogPrimitive.Title>
                <AlertDialogPrimitive.Description className="text-xs text-[#A1A1A1] mt-1 leading-relaxed">
                  {description}
                </AlertDialogPrimitive.Description>
              </div>
            </div>

            {confirmName && (
              <div className="mt-1 flex flex-col gap-2">
                <p className="text-xs text-[#6E6E6E]">
                  To confirm, type <span className="font-mono font-medium text-[#EDEDED] px-1.5 py-0.5 rounded bg-[#171717] border border-[#242424]">{confirmName}</span> below:
                </p>
                <Input
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={confirmName}
                  mono
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-[#242424]">
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
