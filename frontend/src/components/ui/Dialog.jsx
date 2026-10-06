import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

export const Dialog = ({
  isOpen = false,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'max-w-lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-bg/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Box with fade + 4px rise */}
      <div
        className={clsx(
          'relative w-full bg-surface border border-border rounded-modal shadow-2xl overflow-hidden z-10 animate-in fade-in slide-in-from-bottom-1 duration-200',
          maxWidth,
          className
        )}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-semibold text-txt">{title}</h2>}
            {description && <p className="text-xs text-txt-muted mt-1">{description}</p>}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-txt-muted hover:text-txt p-1 rounded-input hover:bg-surface-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
