import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <div className="h-8 bg-surface-2 animate-pulse rounded-input w-3/4 mx-auto" />
          <div className="h-32 bg-surface-2 animate-pulse rounded-card" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export const RoleRoute = ({ children, requiredRole = 'professor' }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  const roleHierarchy = {
    professor: 3,
    researcher: 2,
    student: 1,
  };

  const userLevel = roleHierarchy[user?.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 99;

  if (userLevel < requiredLevel) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-txt mb-1">Access Restricted</h2>
        <p className="text-xs text-txt-muted mb-6 leading-relaxed">
          This area requires <span className="font-mono text-txt capitalize font-semibold">{requiredRole}</span> privileges.
          Your current account role is <span className="font-mono text-warning capitalize font-semibold">{user?.role || 'Guest'}</span>.
        </p>
        <Link to="/">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return children;
};
