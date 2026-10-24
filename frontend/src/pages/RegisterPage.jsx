import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const calculateStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  const strength = calculateStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await register(email, password, fullName);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Registration failed';
      setError(msg);
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
            <h1 className="text-xl sm:text-2xl font-semibold text-text tracking-tight">Create your account</h1>
            <p className="text-xs text-text-2 mt-1">
              Join your university research workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reg-name" className="text-xs font-medium text-text-2">
                Full name
              </label>
              <input
                id="reg-name"
                type="text"
                placeholder="Dr. Alex Rivera"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
                required
                className="w-full h-9 bg-surface-2 border border-border rounded-[8px] px-3 text-sm text-text placeholder:text-text-3 transition-colors focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED] focus-visible:outline-offset-2"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="text-xs font-medium text-text-2">
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full h-9 bg-surface-2 border border-border rounded-[8px] px-3 text-sm text-text placeholder:text-text-3 transition-colors focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED] focus-visible:outline-offset-2"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="text-xs font-medium text-text-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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

              {/* Thin strength bar in text-2 per Section 4.6 */}
              {password.length > 0 && (
                <div className="pt-1">
                  <div className="w-full h-1 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-text-2 transition-all duration-200 rounded-full"
                      style={{ width: `${strength}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-confirm-password" className="text-xs font-medium text-text-2">
                Confirm password
              </label>
              <input
                id="reg-confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full h-9 bg-surface-2 border border-border rounded-[8px] px-3 text-sm text-text placeholder:text-text-3 transition-colors focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED] focus-visible:outline-offset-2"
              />
            </div>

            {error && (
              <div className="p-3 rounded-[8px] bg-danger-bg border border-danger/30 text-xs text-danger flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 stroke-[1.75]" />
                <p className="flex-1">{error}</p>
              </div>
            )}

            {/* Full-width 44px primary Create Account button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full h-11 text-sm font-medium mt-1"
              isLoading={loading}
            >
              Create Account
            </Button>
          </form>

          {/* Muted note: new accounts start as Student per Section 4.6 */}
          <p className="text-[11px] text-text-3 text-center">
            New accounts start with the Student role. Contact a Professor for elevated permissions.
          </p>

          <div className="text-center pt-1 border-t border-border">
            <p className="text-xs text-text-3 mt-3">
              Already have an account?{' '}
              <Link to="/login" className="text-text hover:underline font-medium transition-colors">
                Sign in
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
