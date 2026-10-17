import React, { useState, useEffect } from 'react';
import { activityApi } from '../services/api';
import { PageHeader, Card, Button, Input, Badge, Skeleton, EmptyState, Dialog } from '../components/ui';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Globe,
  Code2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Lock,
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
    if (action.startsWith('PATCH') || action.startsWith('PUT')) return 'accent';
    if (action.startsWith('DELETE')) return 'danger';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="System Audit Log"
        description="Immutable append-only record of all administrative, project, and laboratory mutating requests."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => fetchAuditLogs(page)}
            disabled={loading}
          >
            Refresh Log
          </Button>
        }
      />

      {/* Security Guarantee Banner */}
      <Card className="p-3.5 bg-accent/5 border-accent/25 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-semibold text-txt flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-accent" /> Append-Only Compliance Guarantee
          </h4>
          <p className="text-[11px] text-txt-muted leading-relaxed">
            Audit log rows are protected by the database trigger <code className="font-mono text-accent">prevent_audit_log_modification</code>.
            Records can never be updated, tampered with, or deleted by any user or administrator.
          </p>
        </div>
      </Card>

      {/* Filter / Search Bar */}
      <Card className="p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint" />
            <input
              type="text"
              placeholder="Search by action, actor name, or entity type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-input pl-9 pr-3 py-1.5 text-xs text-txt placeholder:text-txt-faint focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="bg-surface-2 border border-border rounded-input px-3 py-1.5 text-xs text-txt focus:outline-none focus:border-accent"
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

            <Button type="submit" variant="primary" size="sm">
              Search
            </Button>
          </div>
        </form>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="p-4 bg-danger/10 border-danger/30 text-xs text-danger flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => fetchAuditLogs(1)} className="text-danger hover:bg-danger/20">
            Retry
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <Card className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="w-full h-10" />
          ))}
        </Card>
      )}

      {/* Empty State */}
      {!loading && logs.length === 0 && !error && (
        <EmptyState
          icon={ShieldAlert}
          title="No audit records found"
          description="Mutating requests will be captured here in real-time."
          actionText={search || entityType !== 'all' ? 'Reset Filters' : undefined}
          onAction={() => {
            setSearch('');
            setEntityType('all');
          }}
        />
      )}

      {/* Table Content */}
      {!loading && logs.length > 0 && (
        <Card className="overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-txt-muted uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4 font-semibold">Action</th>
                  <th className="py-2.5 px-4 font-semibold">Actor</th>
                  <th className="py-2.5 px-4 font-semibold">Entity Type</th>
                  <th className="py-2.5 px-4 font-semibold">IP Address</th>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-txt">
                {logs.map((log) => {
                  const d = new Date(log.created_at);
                  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

                  return (
                    <tr key={log.id} className="hover:bg-surface-2/60 transition-colors">
                      <td className="py-3 px-4">
                        <Badge variant={getMethodBadgeVariant(log.action)} className="text-[10px] py-0.5">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="flex flex-col">
                          <span className="font-semibold text-txt text-xs">
                            {log.actor_name || 'System / Service'}
                          </span>
                          <span className="text-[11px] text-txt-faint">
                            {log.actor_email || log.actor_id || 'anonymous'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize text-accent font-semibold">{log.entity_type || '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-txt-muted font-mono text-[11px]">
                        {log.ip || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-4 text-txt-muted font-mono text-[11px]">
                        {dateStr} {timeStr}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Code2}
                          className="text-xs hover:text-accent"
                          onClick={() => setSelectedLog(log)}
                        >
                          Payload
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 bg-surface border-t border-border flex items-center justify-between text-xs text-txt-muted">
            <span>
              Showing Page <strong className="text-txt">{page}</strong> of <strong className="text-txt">{totalPages}</strong> ({total} total records)
            </span>

            <div className="flex items-center gap-1.5">
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
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-surface-2 border border-border">
              <div>
                <span className="text-txt-faint text-[10px] uppercase font-semibold block">Actor</span>
                <span className="text-txt font-semibold">{selectedLog.actor_name || selectedLog.actor_email}</span>
              </div>
              <div>
                <span className="text-txt-faint text-[10px] uppercase font-semibold block">Client IP</span>
                <span className="text-txt font-mono">{selectedLog.ip || '127.0.0.1'}</span>
              </div>
              <div>
                <span className="text-txt-faint text-[10px] uppercase font-semibold block">Timestamp</span>
                <span className="text-txt font-mono">{new Date(selectedLog.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-txt-faint text-[10px] uppercase font-semibold block">User Agent</span>
                <span className="text-txt truncate block font-mono text-[10px]" title={selectedLog.user_agent}>
                  {selectedLog.user_agent || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Before / After JSON Payloads */}
            <div className="space-y-3">
              <div>
                <span className="font-semibold text-txt uppercase tracking-wider text-[10px] block mb-1">
                  Mutating Payload (After State)
                </span>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-[11px] text-txt overflow-x-auto max-h-56">
                  {selectedLog.after ? JSON.stringify(selectedLog.after, null, 2) : '// No request body captured'}
                </pre>
              </div>

              {selectedLog.before && (
                <div>
                  <span className="font-semibold text-txt uppercase tracking-wider text-[10px] block mb-1 text-danger">
                    Previous State (Before)
                  </span>
                  <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-[11px] text-txt-muted overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog.before, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
