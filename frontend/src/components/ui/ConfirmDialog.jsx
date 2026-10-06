import React, { useState, useEffect } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Input } from './Input';
import { AlertTriangle } from 'lucide-react';

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

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          {variant === 'danger' && (
            <div className="p-2.5 rounded-full bg-danger/10 text-danger shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-txt">{title}</h3>
            <p className="text-sm text-txt-muted mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        {confirmName && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-xs text-txt-muted">
              To confirm, type <span className="font-mono font-semibold text-txt px-1.5 py-0.5 rounded bg-surface-2">{confirmName}</span> below:
            </p>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={confirmName}
              mono
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={isConfirmedDisabled}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
