import React, { useState, useEffect, useRef } from 'react';
import { projectApi } from '../../services/api';
import { Badge } from '../ui';
import {
  FolderKanban,
  ChevronDown,
  Check,
  Plus,
  Search,
  X,
  Loader2,
} from 'lucide-react';

export const ProjectSelectCombobox = ({
  projects = [],
  selectedProjectId,
  onSelectProject,
  userRole,
  onProjectCreated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Sync input text when selected project changes
  useEffect(() => {
    if (selectedProject) {
      setQuery(selectedProject.title);
    } else if (!selectedProjectId) {
      setQuery('');
    }
  }, [selectedProjectId, selectedProject?.title]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        // Reset query text to current selected project if left unfinished
        if (selectedProject) {
          setQuery(selectedProject.title);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedProject]);

  // Filter projects by user search text
  const filteredProjects = projects.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.status && p.status.toLowerCase().includes(q))
    );
  });

  const canCreate =
    userRole === 'professor' ||
    userRole === 'researcher' ||
    userRole === 'admin';

  const exactMatch = projects.some(
    (p) => p.title.toLowerCase() === query.trim().toLowerCase()
  );

  const handleSelect = (project) => {
    onSelectProject(project.id, project);
    setQuery(project.title);
    setIsOpen(false);
  };

  const handleCreate = async () => {
    const trimmed = query.trim();
    if (!trimmed || !canCreate) return;
    try {
      setCreating(true);
      const newProj = await projectApi.createProject({
        title: trimmed,
        description: 'Created from Testing Environment',
      });
      if (onProjectCreated) onProjectCreated(newProj);
      onSelectProject(newProj.id, newProj);
      setQuery(newProj.title);
      setIsOpen(false);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      if (selectedProject) setQuery(selectedProject.title);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProjects.length > 0) {
        handleSelect(filteredProjects[0]);
      } else if (!exactMatch && canCreate && query.trim()) {
        handleCreate();
      }
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setQuery('');
    setIsOpen(true);
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Searchable Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-txt-muted pointer-events-none flex items-center">
          <Search className="w-3.5 h-3.5" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            // If user types an exact matching title, auto-select it
            const matched = projects.find(
              (p) => p.title.toLowerCase() === e.target.value.trim().toLowerCase()
            );
            if (matched && matched.id !== selectedProjectId) {
              onSelectProject(matched.id, matched);
            }
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Type to search or write project name..."
          className="w-full bg-surface-2 border border-border rounded-input pl-9 pr-20 py-2 text-xs text-txt placeholder:text-txt-muted focus:outline-none focus:border-accent focus:bg-surface-3 transition-colors font-medium shadow-sm"
        />

        {/* Right side controls */}
        <div className="absolute right-2 flex items-center gap-1.5 text-txt-muted">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-surface hover:text-txt transition-colors"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              if (!isOpen && inputRef.current) inputRef.current.focus();
            }}
            className="p-1 rounded hover:bg-surface hover:text-txt transition-colors"
            title={isOpen ? 'Close projects' : 'Show all projects'}
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-accent' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-surface border border-border rounded-lg shadow-2xl overflow-hidden z-30 max-h-64 overflow-y-auto divide-y divide-border/40 animate-in fade-in slide-in-from-top-1 duration-150">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((p) => {
              const isSelected = p.id === selectedProjectId;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'hover:bg-surface-2 text-txt'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderKanban
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-accent' : 'text-txt-muted'
                      }`}
                    />
                    <span className="truncate">{p.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {p.status && (
                      <Badge
                        variant={isSelected ? 'accent' : 'secondary'}
                        className="text-[9px] uppercase font-mono px-1.5 py-0.2"
                      >
                        {p.status}
                      </Badge>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-3 text-xs text-txt-muted text-center italic">
              No existing projects match "{query}"
            </div>
          )}

          {/* Quick Create option for professors/researchers if no exact match */}
          {query.trim() && !exactMatch && canCreate && (
            <div
              onClick={handleCreate}
              className="p-2.5 bg-surface-2/60 hover:bg-surface-2 text-accent flex items-center justify-between gap-2 text-xs cursor-pointer border-t border-border transition-colors font-medium"
            >
              <div className="flex items-center gap-2 min-w-0 truncate">
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">
                  Create new project <strong className="text-txt">"{query.trim()}"</strong>
                </span>
              </div>
              <span className="text-[10px] text-txt-faint uppercase font-mono shrink-0">
                Press Enter
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
