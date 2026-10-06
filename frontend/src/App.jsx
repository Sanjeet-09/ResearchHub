import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { DesignSystemPage } from './pages/DesignSystemPage';
import { PageHeader } from './components/ui';

function PlaceholderPage({ title, description }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="p-8 border border-dashed border-border rounded-card text-center text-sm text-txt-muted">
        This module will be fully built in subsequent phases.
      </div>
    </div>
  );
}

export default function App() {
  const user = {
    name: 'Prof. Eleanor Vance',
    role: 'professor',
  };

  return (
    <BrowserRouter>
      <AppShell user={user}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/design" element={<DesignSystemPage />} />
          <Route path="/projects" element={<PlaceholderPage title="Projects" description="Manage research projects, members, and milestones." />} />
          <Route path="/equipment" element={<PlaceholderPage title="Equipment Reservation" description="Book lab instruments and manage hardware schedules." />} />
          <Route path="/lab" element={<PlaceholderPage title="Testing Environment (Lab)" description="Select container profile and launch interactive Jupyter lab sessions." />} />
          <Route path="/notifications" element={<PlaceholderPage title="Notifications" description="View system alerts and project activity updates." />} />
          <Route path="/users" element={<PlaceholderPage title="User Management" description="Manage user roles and permissions (Professor only)." />} />
          <Route path="/audit" element={<PlaceholderPage title="Audit Log" description="Review system security and activity audit records (Professor only)." />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
