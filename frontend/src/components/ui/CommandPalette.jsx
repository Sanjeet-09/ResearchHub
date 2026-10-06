import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Search, Folder, TestTube, Database, Compass, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CommandPalette = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via custom handler if needed
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
      <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-surface border border-border rounded-modal shadow-2xl overflow-hidden z-10 animate-in fade-in slide-in-from-top-2 duration-150">
        <Command className="w-full">
          <div className="flex items-center border-b border-border px-4">
            <Search className="w-4 h-4 text-txt-muted shrink-0 mr-3" />
            <Command.Input
              placeholder="Type a command or search projects, datasets, experiments..."
              className="w-full bg-transparent py-3.5 text-sm text-txt placeholder:text-txt-faint outline-none"
              autoFocus
            />
            <button onClick={onClose} className="p-1 text-txt-muted hover:text-txt rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="py-6 text-center text-xs text-txt-muted">
              No matching results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-[10px] uppercase font-semibold text-txt-faint px-2 py-1.5">
              <Command.Item
                onSelect={() => handleSelect('/')}
                className="flex items-center gap-3 px-3 py-2 text-xs text-txt rounded-input hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <Compass className="w-4 h-4 text-accent" />
                <span>Dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/projects')}
                className="flex items-center gap-3 px-3 py-2 text-xs text-txt rounded-input hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <Folder className="w-4 h-4 text-accent" />
                <span>Projects</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/equipment')}
                className="flex items-center gap-3 px-3 py-2 text-xs text-txt rounded-input hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <TestTube className="w-4 h-4 text-accent" />
                <span>Equipment Reservation</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/lab')}
                className="flex items-center gap-3 px-3 py-2 text-xs text-txt rounded-input hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <Database className="w-4 h-4 text-accent" />
                <span>Testing Environment (Lab)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/design')}
                className="flex items-center gap-3 px-3 py-2 text-xs text-txt rounded-input hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <Compass className="w-4 h-4 text-warning" />
                <span>Design System Showcase (/design)</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
