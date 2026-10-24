import React from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';

export const Toaster = () => {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--surface-1)',
          border: '1px solid var(--border-strong)',
          color: 'var(--text)',
          borderRadius: '12px',
          fontSize: '13px',
          boxShadow: '0 12px 32px #000000',
        },
      }}
    />
  );
};

export { toast };
