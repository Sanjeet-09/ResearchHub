import React, { useState, useEffect } from 'react';
import { Button, Card, Badge } from '../ui';
import { documentApi } from '../../services/api';
import {
  FileText,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Code,
  AlertTriangle,
  Lightbulb,
  Info,
  Sparkles,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Table as TableIcon,
  Sigma,
  Copy,
  Check,
  Download,
  Save,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export const LabNotionEditor = ({
  projectId,
  sessionId,
  sessionName,
  onExportSuccess,
}) => {
  const [docTitle, setDocTitle] = useState('Research Hypothesis & Lab Journal');
  const [icon, setIcon] = useState('📓');
  const [isExporting, setIsExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Saved locally');
  const [showSlashMenu, setShowSlashMenu] = useState(null); // block id

  const defaultBlocks = [
    {
      id: 'b-1',
      type: 'callout',
      variant: 'info',
      content: 'This Notion-style lab journal is tied to your testing environment. Use it to log hypotheses, record parameter settings, and formulate experiment observations.',
    },
    {
      id: 'b-2',
      type: 'h1',
      content: '1. Objective & Research Question',
    },
    {
      id: 'b-3',
      type: 'paragraph',
      content: 'Investigate the sensitivity and accuracy thresholds when processing high-variance sample datasets using the configured computing profile.',
    },
    {
      id: 'b-4',
      type: 'h2',
      content: '2. Mathematical Formulation',
    },
    {
      id: 'b-5',
      type: 'math',
      content: 'f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} \\exp\\left( -\\frac{(x - \\mu)^2}{2\\sigma^2} \\right)',
    },
    {
      id: 'b-6',
      type: 'h2',
      content: '3. Experiment Checklist',
    },
    {
      id: 'b-7',
      type: 'todo',
      checked: true,
      content: 'Configure random seed generator and partition cross-validation splits',
    },
    {
      id: 'b-8',
      type: 'todo',
      checked: true,
      content: 'Verify environment dependencies and package lock integrity',
    },
    {
      id: 'b-9',
      type: 'todo',
      checked: false,
      content: 'Execute hyperparameter grid search across 5 validation folds',
    },
    {
      id: 'b-10',
      type: 'todo',
      checked: false,
      content: 'Export finalized figures and summary report to Project Documents',
    },
    {
      id: 'b-11',
      type: 'h2',
      content: '4. Key Findings & Observations',
    },
    {
      id: 'b-12',
      type: 'callout',
      variant: 'tip',
      content: 'Key finding: Learning rate of 1e-4 with AdamW optimization demonstrated steady convergence without overshooting the validation minimum.',
    },
  ];

  const storageKey = `rh_lab_notion_${sessionId || 'draft'}`;

  const [blocks, setBlocks] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.blocks && parsed.blocks.length > 0) return parsed.blocks;
      }
    } catch (e) {}
    return defaultBlocks;
  });

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ title: docTitle, icon, blocks }));
      setSaveStatus('All changes saved');
    } catch (e) {}
  }, [docTitle, icon, blocks, storageKey]);

  const updateBlock = (id, field, value) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
    setSaveStatus('Saving...');
  };

  const addBlock = (afterId, type = 'paragraph') => {
    const newBlock = {
      id: `b-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      content: '',
      checked: false,
      variant: 'info',
    };

    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId);
      if (idx === -1) return [...prev, newBlock];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newBlock);
      return copy;
    });
    setShowSlashMenu(null);
  };

  const deleteBlock = (id) => {
    if (blocks.length <= 1) return;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    setBlocks((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(newIdx, 0, item);
      return copy;
    });
  };

  // Export to Markdown string
  const generateMarkdown = () => {
    let md = `# ${icon} ${docTitle}\n\n`;
    md += `*Generated from ResearchHub OS Testing Environment (${sessionName || 'Lab Session'})*\n\n---\n\n`;

    for (const b of blocks) {
      if (b.type === 'h1') md += `# ${b.content}\n\n`;
      else if (b.type === 'h2') md += `## ${b.content}\n\n`;
      else if (b.type === 'h3') md += `### ${b.content}\n\n`;
      else if (b.type === 'paragraph') md += `${b.content}\n\n`;
      else if (b.type === 'todo') md += `- [${b.checked ? 'x' : ' '}] ${b.content}\n`;
      else if (b.type === 'bullet') md += `- ${b.content}\n`;
      else if (b.type === 'numbered') md += `1. ${b.content}\n`;
      else if (b.type === 'quote') md += `> ${b.content}\n\n`;
      else if (b.type === 'math') md += `$$\n${b.content}\n$$\n\n`;
      else if (b.type === 'code') md += `\`\`\`python\n${b.content}\n\`\`\`\n\n`;
      else if (b.type === 'callout') md += `> **[${b.variant.toUpperCase()}]**: ${b.content}\n\n`;
      else if (b.type === 'divider') md += `---\n\n`;
    }
    return md;
  };

  // Export directly to project Documents tab
  const handleExportToDocuments = async () => {
    if (!projectId) {
      alert('No project ID found for this session');
      return;
    }
    try {
      setIsExporting(true);
      const markdownContent = generateMarkdown();
      const fileName = `${docTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
      const blob = new Blob([markdownContent], { type: 'text/markdown' });
      const file = new File([blob], fileName, { type: 'text/markdown' });

      // 1. Get signed upload url
      const { uploadUrl, gcsPath } = await documentApi.getUploadUrl(projectId, {
        fileName,
        mimeType: 'text/markdown',
        docType: 'note',
        title: `${icon} ${docTitle}`,
      });

      // 2. Binary upload
      await documentApi.uploadFileBinary(uploadUrl, file);

      // 3. Confirm document registration
      await documentApi.createDocument(projectId, {
        title: `${icon} ${docTitle}`,
        docType: 'note',
        gcsPath,
        mimeType: 'text/markdown',
        sizeBytes: blob.size,
        fileName,
      });

      if (onExportSuccess) {
        onExportSuccess('Note successfully published to Project Documents!');
      } else {
        alert('Note successfully published to Project Documents repository!');
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to export document');
    } finally {
      setIsExporting(false);
    }
  };

  // Download locally as .md
  const handleDownloadMarkdown = () => {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const iconsList = ['📓', '🔬', '🧪', '📊', '💡', '📝', '⚡', '📐', '🧠'];

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden text-txt">
      {/* Top Editor Bar */}
      <div className="min-h-12 py-2 px-4 sm:px-6 bg-surface border-b border-border flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-txt-muted flex-wrap">
          <span className="flex items-center gap-1 font-mono text-[11px] text-accent">
            <Sparkles className="w-3.5 h-3.5" />
            Notion Journal
          </span>
          <span>·</span>
          <span className="text-[11px] text-txt-faint">{saveStatus}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            icon={Download}
            onClick={handleDownloadMarkdown}
            title="Download raw Markdown"
          >
            Download .md
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={Save}
            onClick={handleExportToDocuments}
            loading={isExporting}
            title="Publish this note to project Documents repository"
          >
            Save to Documents
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-4xl w-full mx-auto space-y-6">
        {/* Document Header */}
        <div className="space-y-3 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button className="text-3xl p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                {icon}
              </button>
              <div className="absolute top-full left-0 mt-1 hidden group-hover:flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-lg shadow-xl z-20">
                {iconsList.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className="p-1 text-lg hover:scale-125 transition-transform"
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-xs font-mono text-txt-faint uppercase tracking-wider">
              Research Note
            </span>
          </div>

          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            className="w-full text-2xl font-bold bg-transparent border-0 text-txt focus:outline-none placeholder-txt-faint tracking-tight"
            placeholder="Untitled Research Note"
          />
        </div>

        {/* Block List */}
        <div className="space-y-2.5">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              className="group relative flex items-start gap-2 -ml-8 pl-8 pr-2 py-1 rounded-lg hover:bg-surface-2/40 transition-colors"
            >
              {/* Block Actions (Reorder / Delete / Insert) */}
              <div className="absolute left-0 top-2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-txt-faint transition-opacity">
                <button
                  onClick={() => moveBlock(index, -1)}
                  disabled={index === 0}
                  className="p-0.5 hover:text-txt disabled:opacity-20"
                  title="Move up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => moveBlock(index, 1)}
                  disabled={index === blocks.length - 1}
                  className="p-0.5 hover:text-txt disabled:opacity-20"
                  title="Move down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setShowSlashMenu(showSlashMenu === block.id ? null : block.id)}
                  className="p-0.5 hover:text-accent"
                  title="Add block"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteBlock(block.id)}
                  className="p-0.5 hover:text-danger"
                  title="Delete block"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Block Content by Type */}
              <div className="flex-1 min-w-0">
                {/* Heading 1 */}
                {block.type === 'h1' && (
                  <input
                    type="text"
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                    className="w-full text-xl font-bold bg-transparent text-txt focus:outline-none border-b border-transparent focus:border-accent/40 pb-1"
                    placeholder="Heading 1..."
                  />
                )}

                {/* Heading 2 */}
                {block.type === 'h2' && (
                  <input
                    type="text"
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                    className="w-full text-base font-semibold text-txt bg-transparent focus:outline-none border-b border-transparent focus:border-accent/40 pb-0.5"
                    placeholder="Heading 2..."
                  />
                )}

                {/* Heading 3 */}
                {block.type === 'h3' && (
                  <input
                    type="text"
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                    className="w-full text-sm font-semibold text-txt-muted bg-transparent focus:outline-none"
                    placeholder="Heading 3..."
                  />
                )}

                {/* Standard Paragraph */}
                {block.type === 'paragraph' && (
                  <textarea
                    rows={Math.max(1, (block.content.match(/\n/g) || []).length + 1)}
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                    className="w-full text-xs text-txt bg-transparent focus:outline-none resize-none leading-relaxed"
                    placeholder="Type notes or observations... Type '/' for commands"
                  />
                )}

                {/* Todo Checklist */}
                {block.type === 'todo' && (
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={() => updateBlock(block.id, 'checked', !block.checked)}
                      className="mt-0.5 text-accent hover:opacity-80 transition-opacity"
                    >
                      {block.checked ? (
                        <CheckSquare className="w-4 h-4 text-success" />
                      ) : (
                        <Square className="w-4 h-4 text-txt-muted" />
                      )}
                    </button>
                    <input
                      type="text"
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                      className={`flex-1 text-xs bg-transparent focus:outline-none ${
                        block.checked ? 'line-through text-txt-muted' : 'text-txt'
                      }`}
                      placeholder="To-do item..."
                    />
                  </div>
                )}

                {/* Bullet Item */}
                {block.type === 'bullet' && (
                  <div className="flex items-start gap-2">
                    <span className="text-accent font-bold mt-[-2px]">•</span>
                    <input
                      type="text"
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                      className="flex-1 text-xs text-txt bg-transparent focus:outline-none"
                      placeholder="Bullet point..."
                    />
                  </div>
                )}

                {/* Quote */}
                {block.type === 'quote' && (
                  <div className="border-l-2 border-accent pl-3 py-1 bg-surface-2/40 rounded-r">
                    <textarea
                      rows={2}
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                      className="w-full text-xs italic text-txt-muted bg-transparent focus:outline-none resize-none"
                      placeholder="Quote or excerpt..."
                    />
                  </div>
                )}

                {/* Callout Box */}
                {block.type === 'callout' && (
                  <div className="p-3.5 rounded-lg bg-surface-2 border border-border flex items-start gap-3">
                    {block.variant === 'tip' ? (
                      <Lightbulb className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    ) : block.variant === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    )}
                    <textarea
                      rows={2}
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                      className="w-full text-xs text-txt bg-transparent focus:outline-none resize-none leading-relaxed"
                      placeholder="Callout text..."
                    />
                  </div>
                )}

                {/* Code Block */}
                {block.type === 'code' && (
                  <div className="rounded-lg bg-surface-3 border border-border overflow-hidden">
                    <div className="px-3 py-1.5 bg-surface-2 border-b border-border flex items-center justify-between text-[11px] font-mono text-txt-faint">
                      <span>Python Snippet</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(block.content)}
                        className="hover:text-txt flex items-center gap-1"
                        title="Copy code"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                    <textarea
                      rows={Math.max(3, (block.content.match(/\n/g) || []).length + 2)}
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                      className="w-full p-3 font-mono text-xs text-txt bg-transparent focus:outline-none resize-none"
                      placeholder="# Write code snippet here..."
                    />
                  </div>
                )}

                {/* Math Equation */}
                {block.type === 'math' && (
                  <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-accent">
                      <Sigma className="w-3.5 h-3.5" />
                      <span>LaTeX Formula</span>
                    </div>
                    <input
                      type="text"
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                      className="w-full font-mono text-xs text-txt bg-surface-3 p-2 rounded border border-border focus:outline-none"
                      placeholder="e.g. \\sum_{i=1}^n x_i"
                    />
                    <div className="p-2 bg-surface rounded text-center text-sm font-mono text-txt">
                      $$ {block.content || 'E = mc^2'} $$
                    </div>
                  </div>
                )}

                {/* Divider */}
                {block.type === 'divider' && (
                  <hr className="border-border my-2" />
                )}
              </div>

              {/* Slash Quick Insert Menu Popup */}
              {showSlashMenu === block.id && (
                <div className="absolute left-8 top-8 z-30 w-52 p-1.5 bg-surface-2 border border-border-strong rounded-xl shadow-2xl space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-semibold text-txt-faint uppercase">
                    Insert Block
                  </div>
                  <button
                    onClick={() => addBlock(block.id, 'paragraph')}
                    className="w-full px-2 py-1.5 text-xs text-left rounded hover:bg-surface-3 text-txt flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-txt-muted" />
                    Text
                  </button>
                  <button
                    onClick={() => addBlock(block.id, 'h1')}
                    className="w-full px-2 py-1.5 text-xs text-left rounded hover:bg-surface-3 text-txt flex items-center gap-2"
                  >
                    <Heading1 className="w-3.5 h-3.5 text-accent" />
                    Heading 1
                  </button>
                  <button
                    onClick={() => addBlock(block.id, 'h2')}
                    className="w-full px-2 py-1.5 text-xs text-left rounded hover:bg-surface-3 text-txt flex items-center gap-2"
                  >
                    <Heading2 className="w-3.5 h-3.5 text-accent" />
                    Heading 2
                  </button>
                  <button
                    onClick={() => addBlock(block.id, 'todo')}
                    className="w-full px-2 py-1.5 text-xs text-left rounded hover:bg-surface-3 text-txt flex items-center gap-2"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-success" />
                    Checklist
                  </button>
                  <button
                    onClick={() => addBlock(block.id, 'bullet')}
                    className="w-full px-2 py-1.5 text-xs text-left rounded hover:bg-surface-3 text-txt flex items-center gap-2"
                  >
                    <List className="w-3.5 h-3.5 text-txt-muted" />
                    Bullet List
                  </button>
                  <button
                    onClick={() => addBlock(block.id, 'callout')}
                    className="w-full px-2 py-1.5 text-xs text-left rounded hover:bg-surface-3 text-txt flex items-center gap-2"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-warning" />
                    Callout Box
                  </button>
                  <button
                    onClick={() => addBlock(block.id, 'code')}
                    className="w-full px-2 py-1.5 text-xs text-left rounded hover:bg-surface-3 text-txt flex items-center gap-2"
                  >
                    <Code className="w-3.5 h-3.5 text-accent" />
                    Code Block
                  </button>
                  <button
                    onClick={() => addBlock(block.id, 'math')}
                    className="w-full px-2 py-1.5 text-xs text-left rounded hover:bg-surface-3 text-txt flex items-center gap-2"
                  >
                    <Sigma className="w-3.5 h-3.5 text-accent" />
                    LaTeX Equation
                  </button>
                  <button
                    onClick={() => addBlock(block.id, 'quote')}
                    className="w-full px-2 py-1.5 text-xs text-left rounded hover:bg-surface-3 text-txt flex items-center gap-2"
                  >
                    <Quote className="w-3.5 h-3.5 text-txt-muted" />
                    Quote
                  </button>
                  <button
                    onClick={() => addBlock(block.id, 'divider')}
                    className="w-full px-2 py-1.5 text-xs text-left rounded hover:bg-surface-3 text-txt flex items-center gap-2"
                  >
                    <div className="w-3.5 h-0.5 bg-border-strong" />
                    Divider
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Add Block Trigger */}
        <div className="pt-4 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={() => addBlock(blocks[blocks.length - 1]?.id, 'paragraph')}
          >
            Add New Block
          </Button>
        </div>
      </div>
    </div>
  );
};
