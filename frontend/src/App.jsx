import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, RoleRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { DesignSystemPage } from './pages/DesignSystemPage';
import { LabPage } from './pages/LabPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes inside AppShell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DashboardPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/design"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DesignSystemPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DesignSystemPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ProjectsListPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ProjectDetailPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/equipment"
            element={
              <ProtectedRoute>
                <AppShell>
                  <EquipmentPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/lab"
            element={
              <ProtectedRoute>
                <AppShell>
                  <LabPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <AppShell>
                  <NotificationsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* System Admin & Professor Protected Routes */}
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <RoleRoute requiredRole="admin">
                  <AppShell>
                    <UsersPage />
                  </AppShell>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/audit"
            element={
              <ProtectedRoute>
                <RoleRoute requiredRole="professor">
                  <AppShell>
                    <AuditLogPage />
                  </AppShell>
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
