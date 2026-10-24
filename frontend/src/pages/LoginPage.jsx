import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Sparkles, AlertCircle, Eye, EyeOff, UserPlus } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError({ message: 'Please enter both your email and password' });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const errData = err.response?.data?.error;
      const isNewUser = errData?.code === 'USER_NOT_FOUND' || 
                        errData?.message?.toLowerCase().includes('register first') ||
                        errData?.message?.toLowerCase().includes('no account found');

      setError({
        message: isNewUser ? 'No account found with this email' : 'Email or password is incorrect',
        isNewUser,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Blueprint Grid Texture */}
      <div className="absolute inset-0 pointer-events-none bg-grid-pattern" />

      <div className="w-full max-w-[400px] flex flex-col items-center relative z-10 space-y-6">
        {/* Logo Mark & Wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-[6px] bg-primary text-primary-fg flex items-center justify-center font-bold text-xs shadow-sm">
            <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <span className="font-semibold text-base tracking-tight text-text">
            ResearchHub
          </span>
        </div>

        {/* 400px Card per Section 4.6 */}
        <div className="w-full bg-surface-1 border border-border rounded-[12px] p-6 sm:p-7 shadow-[inset_0_1px_0_#1A1A1A] space-y-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-text tracking-tight">Welcome back</h1>
            <p className="text-xs text-text-2 mt-1">
              Sign in with your university credentials.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-medium text-text-2">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
                autoComplete="email"
                className="w-full h-9 bg-surface-2 border border-border rounded-[8px] px-3 text-sm text-text placeholder:text-text-3 transition-colors focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED] focus-visible:outline-offset-2"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-medium text-text-2">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-9 bg-surface-2 border border-border rounded-[8px] px-3 pr-10 text-sm text-text placeholder:text-text-3 transition-colors focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED] focus-visible:outline-offset-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 hover:text-text transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 stroke-[1.75]" /> : <Eye className="w-4 h-4 stroke-[1.75]" />}
                </button>
              </div>
            </div>

            {/* Inline Error Message on Failed Login */}
            {error && (
              <div className="p-3 rounded-[8px] bg-danger-bg border border-danger/30 text-xs text-danger flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 stroke-[1.75]" />
                <div className="flex-1 space-y-1">
                  <p>{error.message}</p>
                  {error.isNewUser && (
                    <Link
                      to={`/register?email=${encodeURIComponent(email)}`}
                      className="text-xs font-medium underline flex items-center gap-1 text-text hover:text-white"
                    >
                      <UserPlus className="w-3.5 h-3.5 stroke-[1.75]" />
                      Register this account
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Full-width 44px primary Sign In button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full h-11 text-sm font-medium mt-1"
              isLoading={loading}
            >
              Sign In
            </Button>
          </form>

          <div className="text-center pt-1 border-t border-border">
            <p className="text-xs text-text-3 mt-3">
              Don't have an account?{' '}
              <Link to="/register" className="text-text hover:underline font-medium transition-colors">
                Create an account
              </Link>
            </p>
          </div>
        </div>

        {/* Muted footer line */}
        <p className="text-xs text-text-3">
          ResearchHub OS
        </p>
      </div>
    </div>
  );
};
