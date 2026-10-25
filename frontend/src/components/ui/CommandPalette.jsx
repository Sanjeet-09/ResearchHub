import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { Search, FolderKanban, FlaskConical, CalendarClock, Terminal, Compass, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CommandPalette = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) {
          onClose();
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
      <div className="fixed inset-0 bg-black/75 backdrop-blur-[2px]" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-[#111111] border border-[#242424] shadow-2xl shadow-black rounded-xl text-[#EDEDED] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
        <Command className="w-full">
          <div className="flex items-center border-b border-[#242424] px-4">
            <Search className="w-4 h-4 text-[#6E6E6E] shrink-0 mr-3 stroke-[1.75]" />
            <Command.Input
              placeholder="Search projects, experiments, datasets, lab..."
              className="w-full bg-transparent py-3.5 text-sm text-[#EDEDED] placeholder-[#6E6E6E] outline-none"
              autoFocus
            />
            <button onClick={onClose} className="p-1 text-[#6E6E6E] hover:text-[#EDEDED] rounded-lg hover:bg-[#171717] transition-colors">
              <X className="w-4 h-4 stroke-[1.75]" />
            </button>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="py-6 text-center text-xs text-text-3">
              No matching results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-xs font-medium text-text-3 px-2 py-1.5">
              <Command.Item
                onSelect={() => handleSelect('/')}
                className="flex items-center gap-3 px-3 py-2 text-xs text-text rounded-[8px] hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <Compass className="w-4 h-4 text-text-2 stroke-[1.75]" />
                <span>Dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/projects')}
                className="flex items-center gap-3 px-3 py-2 text-xs text-text rounded-[8px] hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <FolderKanban className="w-4 h-4 text-text-2 stroke-[1.75]" />
                <span>Projects</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/equipment')}
                className="flex items-center gap-3 px-3 py-2 text-xs text-text rounded-[8px] hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <CalendarClock className="w-4 h-4 text-text-2 stroke-[1.75]" />
                <span>Equipment Reservation</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/lab')}
                className="flex items-center gap-3 px-3 py-2 text-xs text-text rounded-[8px] hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <Terminal className="w-4 h-4 text-text-2 stroke-[1.75]" />
                <span>Testing Environment (Lab)</span>
              </Command.Item>
              {import.meta.env.DEV && (
                <Command.Item
                  onSelect={() => handleSelect('/design')}
                  className="flex items-center gap-3 px-3 py-2 text-xs text-text rounded-[8px] hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <FlaskConical className="w-4 h-4 text-text-2 stroke-[1.75]" />
                  <span>Design System Showcase (/design)</span>
                </Command.Item>
              )}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
