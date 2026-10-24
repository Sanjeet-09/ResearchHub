import React, { useState, useEffect } from 'react';
import { activityApi } from '../services/api';
import { PageHeader, Card, Button, Input, Badge, Skeleton, EmptyState, Dialog } from '../components/ui';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Code2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Lock,
  ChevronDown,
} from 'lucide-react';

export const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchAuditLogs = async (targetPage = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = { page: targetPage, limit };
      if (search.trim()) params.search = search.trim();
      if (entityType !== 'all') params.entityType = entityType;

      const data = await activityApi.getAuditLogs(params);
      setLogs(data.auditLogs || []);
      setTotal(data.pagination?.total || 0);
      setPage(targetPage);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(1);
  }, [entityType]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAuditLogs(1);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  const getMethodBadgeVariant = (action = '') => {
    if (action.startsWith('POST')) return 'success';
    if (action.startsWith('PATCH') || action.startsWith('PUT')) return 'warning';
    if (action.startsWith('DELETE')) return 'danger';
    return 'neutral';
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <PageHeader
        title="Audit Log"
        description="Append-only record of all administrative, project, and laboratory mutating requests."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => fetchAuditLogs(page)}
            disabled={loading}
          >
            Refresh log
          </Button>
        }
      />

      {/* Security Guarantee Banner */}
      <Card className="p-4 flex items-center gap-3.5">
        <div className="w-8 h-8 rounded-[8px] bg-surface-2 border border-border flex items-center justify-center text-text shrink-0">
          <ShieldCheck className="w-4 h-4 stroke-[1.75]" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-semibold text-text flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-text-3 stroke-[1.75]" /> Append-only compliance guarantee
          </h4>
          <p className="text-xs text-text-2 leading-relaxed">
            Audit log rows are protected by the database trigger <code className="font-mono text-text text-[11px]">prevent_audit_log_modification</code>.
            Records can never be updated, tampered with, or deleted.
          </p>
        </div>
      </Card>

      {/* Filter / Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-3 stroke-[1.75]" />
            <Input
              type="text"
              placeholder="Search by action, actor name, or entity type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="h-9 bg-surface-2 border border-border rounded-[8px] px-3 text-xs text-text focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED] transition-colors cursor-pointer"
            >
              <option value="all">All Entity Types</option>
              <option value="projects">Projects</option>
              <option value="experiments">Experiments</option>
              <option value="datasets">Datasets</option>
              <option value="documents">Documents</option>
              <option value="publications">Publications</option>
              <option value="equipment">Equipment</option>
              <option value="reservations">Reservations</option>
              <option value="auth">Authentication</option>
            </select>

            <Button type="submit" variant="primary" size="md">
              Search
            </Button>
          </div>
        </form>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="p-4 bg-danger-bg border border-danger/30 text-xs text-danger flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => fetchAuditLogs(1)} className="text-danger hover:bg-danger-bg">
            Retry
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <Card className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="w-full h-9 rounded-[8px]" />
          ))}
        </Card>
      )}

      {/* Empty State */}
      {!loading && logs.length === 0 && !error && (
        <EmptyState
          icon={ShieldAlert}
          title="No audit records found"
          description="Mutating requests will be captured here in real-time."
          actionLabel={search || entityType !== 'all' ? 'Reset filters' : undefined}
          onAction={() => {
            setSearch('');
            setEntityType('all');
          }}
        />
      )}

      {/* Table Content */}
      {!loading && logs.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-text-3 text-xs font-medium">
                  <th className="py-2.5 px-4 font-medium w-8"></th>
                  <th className="py-2.5 px-4 font-medium">Action</th>
                  <th className="py-2.5 px-4 font-medium">Actor</th>
                  <th className="py-2.5 px-4 font-medium">Entity type</th>
                  <th className="py-2.5 px-4 font-medium">IP address</th>
                  <th className="py-2.5 px-4 font-medium">Timestamp</th>
                  <th className="py-2.5 px-4 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {logs.map((log) => {
                  const d = new Date(log.created_at);
                  const isExpanded = selectedLog?.id === log.id;
                  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        className={`hover:bg-surface-2 transition-colors cursor-pointer ${isExpanded ? 'bg-surface-2' : ''}`}
                        onClick={() => setSelectedLog(isExpanded ? null : log)}
                      >
                        <td className="py-2.5 px-4 text-text-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 stroke-[1.75]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 stroke-[1.75]" />
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          <Badge variant={getMethodBadgeVariant(log.action)} size="sm" mono>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-text text-xs">
                              {log.actor_name || 'System / Service'}
                            </span>
                            <span className="text-[11px] font-mono text-text-3">
                              {log.actor_email || log.actor_id || 'anonymous'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="capitalize text-text-2 font-medium">{log.entity_type || '—'}</span>
                        </td>
                        <td className="py-2.5 px-4 text-text-3 font-mono tabular-nums text-[11px]">
                          {log.ip || '127.0.0.1'}
                        </td>
                        <td className="py-2.5 px-4 text-text-3 font-mono tabular-nums text-[11px]">
                          {dateStr} {timeStr}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Code2}
                            className="text-xs h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(isExpanded ? null : log);
                            }}
                          >
                            {isExpanded ? 'Collapse' : 'Inspect'}
                          </Button>
                        </td>
                      </tr>

                      {/* Expandable JSON Detail Row */}
                      {isExpanded && (
                        <tr className="bg-surface-2">
                          <td colSpan={7} className="p-4 border-b border-border">
                            <div className="space-y-4 max-w-4xl">
                              <div className="flex flex-wrap items-center gap-6 text-[11px] text-text-3 font-mono border-b border-border pb-2.5">
                                <span><strong className="text-text">Actor:</strong> {log.actor_name || log.actor_email}</span>
                                <span><strong className="text-text">IP:</strong> {log.ip || '127.0.0.1'}</span>
                                <span><strong className="text-text">Timestamp:</strong> {new Date(log.created_at).toISOString()}</span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <span className="font-medium text-text-2 text-xs block mb-1.5">
                                    Mutating payload (After state)
                                  </span>
                                  <pre className="p-3.5 rounded-[8px] bg-surface-1 border border-border font-mono text-[11px] text-text overflow-x-auto max-h-56">
                                    {log.after ? JSON.stringify(log.after, null, 2) : '// No request body captured'}
                                  </pre>
                                </div>

                                <div>
                                  <span className="font-medium text-danger text-xs block mb-1.5">
                                    Previous state (Before)
                                  </span>
                                  <pre className="p-3.5 rounded-[8px] bg-surface-1 border border-border font-mono text-[11px] text-text-3 overflow-x-auto max-h-56">
                                    {log.before ? JSON.stringify(log.before, null, 2) : '// No prior state'}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3.5 bg-surface-1 border-t border-border flex items-center justify-between text-xs text-text-3">
            <span>
              Page <strong className="text-text tabular-nums">{page}</strong> of <strong className="text-text tabular-nums">{totalPages}</strong> (<span className="tabular-nums">{total}</span> total records)
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                onClick={() => fetchAuditLogs(page - 1)}
                disabled={page <= 1 || loading}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronRight}
                onClick={() => fetchAuditLogs(page + 1)}
                disabled={page >= totalPages || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Payload Inspection Modal */}
      {selectedLog && (
        <Dialog
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Payload: ${selectedLog.action}`}
        >
          <div className="space-y-4 text-xs">
            {/* Meta overview */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-[8px] bg-surface-2 border border-border">
              <div>
                <span className="text-text-3 text-[11px] block">Actor</span>
                <span className="text-text font-medium">{selectedLog.actor_name || selectedLog.actor_email}</span>
              </div>
              <div>
                <span className="text-text-3 text-[11px] block">Client IP</span>
                <span className="text-text font-mono">{selectedLog.ip || '127.0.0.1'}</span>
              </div>
              <div>
                <span className="text-text-3 text-[11px] block">Timestamp</span>
                <span className="text-text font-mono">{new Date(selectedLog.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-text-3 text-[11px] block">User Agent</span>
                <span className="text-text truncate block font-mono text-[11px]" title={selectedLog.user_agent}>
                  {selectedLog.user_agent || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Before / After JSON Payloads */}
            <div className="space-y-3">
              <div>
                <span className="font-medium text-text-2 text-xs block mb-1">
                  Mutating payload (After state)
                </span>
                <pre className="p-3.5 rounded-[8px] bg-surface-2 border border-border font-mono text-[11px] text-text overflow-x-auto max-h-56">
                  {selectedLog.after ? JSON.stringify(selectedLog.after, null, 2) : '// No request body captured'}
                </pre>
              </div>

              {selectedLog.before && (
                <div>
                  <span className="font-medium text-danger text-xs block mb-1">
                    Previous state (Before)
                  </span>
                  <pre className="p-3.5 rounded-[8px] bg-surface-2 border border-border font-mono text-[11px] text-text-3 overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog.before, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <Button variant="ghost" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
