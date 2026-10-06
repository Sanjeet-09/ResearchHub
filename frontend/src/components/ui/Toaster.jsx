import React from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';

export const Toaster = () => {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--surface-2)',
          border: '1px solid var(--border-strong)',
          color: 'var(--text)',
          borderRadius: '8px',
          fontSize: '13px',
        },
      }}
    />
  );
};

export { toast };
