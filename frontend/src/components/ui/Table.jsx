import React from 'react';
import { clsx } from 'clsx';

export const Table = ({ children, className, ...props }) => (
  <div className="w-full overflow-x-auto border border-border rounded-card bg-surface">
    <table className={clsx('w-full text-left text-sm border-collapse', className)} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader = ({ children, className, ...props }) => (
  <thead className={clsx('bg-surface-2/60 border-b border-border text-xs uppercase tracking-wider text-txt-muted font-semibold', className)} {...props}>
    {children}
  </thead>
);

export const TableBody = ({ children, className, ...props }) => (
  <tbody className={clsx('divide-y divide-border', className)} {...props}>
    {children}
  </tbody>
);

export const TableRow = ({ children, className, hover = true, ...props }) => (
  <tr className={clsx('transition-colors duration-150', hover && 'hover:bg-surface-2/40', className)} {...props}>
    {children}
  </tr>
);

export const TableHead = ({ children, className, ...props }) => (
  <th className={clsx('px-4 py-3 text-left font-semibold text-txt-muted', className)} {...props}>
    {children}
  </th>
);

export const TableCell = ({ children, className, mono = false, ...props }) => (
  <td className={clsx('px-4 py-3.5 text-txt text-sm', mono && 'font-mono text-xs text-txt-muted', className)} {...props}>
    {children}
  </td>
);
