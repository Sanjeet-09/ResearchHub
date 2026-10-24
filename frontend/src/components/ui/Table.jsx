import React from 'react';
import { cn } from '@/lib/utils';

export const Table = ({ children, className, ...props }) => (
  <div className="w-full overflow-x-auto">
    <table className={cn('w-full text-left text-sm border-collapse', className)} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader = ({ children, className, ...props }) => (
  <thead className={cn('border-b border-border text-xs text-text-3 font-medium', className)} {...props}>
    {children}
  </thead>
);

export const TableBody = ({ children, className, ...props }) => (
  <tbody className={cn('divide-y divide-border', className)} {...props}>
    {children}
  </tbody>
);

export const TableRow = ({ children, className, hover = true, ...props }) => (
  <tr className={cn('transition-colors duration-150', hover && 'hover:bg-surface-2', className)} {...props}>
    {children}
  </tr>
);

export const TableHead = ({ children, className, ...props }) => (
  <th className={cn('px-4 py-3 text-left font-medium text-text-3 text-xs', className)} {...props}>
    {children}
  </th>
);

export const TableCell = ({ children, className, mono = false, ...props }) => (
  <td className={cn('px-4 py-3 text-text text-sm', mono && 'font-mono text-xs text-text-2 tabular-nums', className)} {...props}>
    {children}
  </td>
);
