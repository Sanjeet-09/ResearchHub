import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Users, Search, Shield, RefreshCw } from 'lucide-react';

export const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await authApi.getUsers({ q: search, role: roleFilter });
      setUsers(data || []);
    } catch (err) {
      toast.error('Failed to load user directory: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      setUpdatingId(targetUserId);
      const updated = await authApi.updateUserRole(targetUserId, newRole);
      setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: updated.role } : u));
      toast.success(`Updated role to ${newRole}`);
    } catch (err) {
      toast.error('Failed to change role: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusToggle = async (targetUserId, currentStatus) => {
    try {
      setUpdatingId(targetUserId);
      const updated = await authApi.updateUserStatus(targetUserId, !currentStatus);
      setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, is_active: updated.is_active } : u));
      toast.success(`Account ${updated.is_active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error('Failed to change status: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  const getRoleVariant = (role) => {
    switch (role) {
      case 'admin': return 'accent';
      case 'professor': return 'info';
      case 'researcher': return 'warning';
      case 'student': return 'neutral';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Global directory & role management (System Admin privilege strictly enforced)."
      />

      {/* Filter and Search Bar */}
      <Card className="p-4 border-border bg-surface flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto flex-1">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80"
          />
          <Button type="submit" variant="secondary" size="md">
            <Search className="w-4 h-4 mr-1.5" />
            Search
          </Button>
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: '', label: 'All Roles' },
              { value: 'admin', label: 'System Admins' },
              { value: 'professor', label: 'Professors' },
              { value: 'researcher', label: 'Researchers' },
              { value: 'student', label: 'Students' },
            ]}
            className="w-40"
          />
          <Button variant="ghost" size="md" onClick={fetchUsers} disabled={loading} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-txt-muted uppercase font-mono tracking-wider text-[11px]">
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-txt-muted">
                    Loading user directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-txt-muted">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.id === currentUser?.id;

                  return (
                    <tr key={u.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-3 px-4 flex items-center gap-2.5">
                        <Avatar name={u.full_name || u.email} size="sm" />
                        <div>
                          <div className="font-semibold text-txt flex items-center gap-1.5">
                            {u.full_name}
                            {isSelf && (
                              <span className="text-[10px] text-accent font-mono font-normal">(You)</span>
                            )}
                          </div>
                          <div className="text-[10px] text-txt-faint font-mono">{u.id.slice(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-txt-muted">{u.email}</td>
                      <td className="py-3 px-4">
                        <Badge variant={getRoleVariant(u.role)} className="uppercase text-[10px]">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={u.is_active !== false ? 'success' : 'danger'} className="text-[10px]">
                          {u.is_active !== false ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-txt-muted">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={updatingId === u.id || isSelf}
                          className="bg-surface-2 border border-border text-txt text-xs rounded-input px-2.5 py-1 focus:outline-none focus:border-accent capitalize disabled:opacity-50"
                        >
                          <option value="student">Student</option>
                          <option value="researcher">Researcher</option>
                          <option value="professor">Professor</option>
                          <option value="admin">Admin</option>
                        </select>

                        {!isSelf && (
                          <Button
                            variant={u.is_active !== false ? 'danger' : 'secondary'}
                            size="sm"
                            disabled={updatingId === u.id}
                            onClick={() => handleStatusToggle(u.id, u.is_active !== false)}
                          >
                            {u.is_active !== false ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
