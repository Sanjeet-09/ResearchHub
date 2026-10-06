import React from 'react';
import { PageHeader, Card, CardHeader, CardTitle, CardContent, StatusDot, Badge, Button } from '../components/ui';
import { FolderKanban, TestTube, Bell, Terminal, Plus } from 'lucide-react';

export const DashboardPage = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome back, Prof. Vance. Here is your research overview."
        action={<Button icon={Plus}>New Project</Button>}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-txt-muted uppercase font-semibold">Active Projects</span>
              <div className="text-2xl font-bold text-txt mt-1">4</div>
            </div>
            <div className="p-2.5 rounded-lg bg-accent-soft text-accent border border-accent/20">
              <FolderKanban className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-txt-muted uppercase font-semibold">Running Labs</span>
              <div className="text-2xl font-bold text-txt mt-1">1</div>
            </div>
            <div className="p-2.5 rounded-lg bg-success/10 text-success border border-success/20">
              <Terminal className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-txt-muted uppercase font-semibold">Reservations</span>
              <div className="text-2xl font-bold text-txt mt-1">2</div>
            </div>
            <div className="p-2.5 rounded-lg bg-warning/10 text-warning border border-warning/20">
              <TestTube className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-txt-muted uppercase font-semibold">Notifications</span>
              <div className="text-2xl font-bold text-txt mt-1">3</div>
            </div>
            <div className="p-2.5 rounded-lg bg-info/10 text-info border border-info/20">
              <Bell className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted">My Projects</h2>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle>Quantum Molecular Dynamics Simulation</CardTitle>
                <Badge variant="accent">active</Badge>
              </div>
              <span className="text-xs font-mono text-txt-faint">3 members</span>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-txt-muted">
                Investigating low-temperature quantum state transitions using GPU-accelerated tensor solvers.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted">Recent Activity</h2>
          <Card>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-start gap-2.5">
                <StatusDot status="online" />
                <div>
                  <span className="font-semibold text-txt">Dr. Alan Grant</span>
                  <p className="text-txt-muted">Uploaded new dataset version v2.0</p>
                  <span className="text-[10px] font-mono text-txt-faint">10 mins ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
