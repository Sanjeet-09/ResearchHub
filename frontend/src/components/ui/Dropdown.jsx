import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

export const Dropdown = ({ trigger, items = [], align = 'right', className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          className={clsx(
            'absolute z-dropdown mt-1.5 w-48 rounded-lg bg-[#111111] border border-[#242424] shadow-2xl shadow-black py-1 focus:outline-none animate-in fade-in slide-in-from-top-1 duration-150',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={`div-${idx}`} className="my-1 border-t border-border" />;
            }
            return (
              <button
                key={idx}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setIsOpen(false);
                }}
                disabled={item.disabled}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-left transition-colors duration-150',
                  item.danger ? 'text-danger hover:bg-danger-bg' : 'text-text hover:bg-surface-2',
                  item.disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {item.icon && <item.icon className="w-4 h-4 shrink-0 stroke-[1.75]" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
