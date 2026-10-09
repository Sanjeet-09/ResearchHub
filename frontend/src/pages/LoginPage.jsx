import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Sparkles, AlertCircle, UserPlus } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError({ message: 'Please fill in both email and password' });
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
        message: errData?.message || err.message || 'Failed to sign in',
        isNewUser,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background radial accent glow per Section 3.1 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-accent-soft blur-[100px] pointer-events-none rounded-full" />

      {/* Wordmark Header */}
      <div className="flex flex-col items-center mb-8 relative z-10 text-center">
        <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent mb-3 shadow-accent">
          <Sparkles className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-txt">
          ResearchHub <span className="text-accent font-extrabold">OS</span>
        </h1>
        <p className="text-xs text-txt-muted mt-1 tracking-wide">
          Cloud-native University Research Operating System
        </p>
      </div>

      {/* Centered Auth Card */}
      <Card className="w-full max-w-[400px] p-8 border-border bg-surface relative z-10 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-txt">Sign in to your account</h2>
          <p className="text-xs text-txt-muted mt-1">Enter your credentials to access research workspaces</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-input bg-danger/10 border border-danger/20 text-danger text-xs animate-in fade-in space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="leading-relaxed">{error.message}</p>
                {error.isNewUser && (
                  <div className="pt-2 border-t border-danger/20 flex items-center justify-between">
                    <span className="text-[11px] text-txt-muted">First time here?</span>
                    <Link
                      to={`/register?email=${encodeURIComponent(email)}`}
                      className="text-xs font-semibold text-accent hover:text-accent-hover underline flex items-center gap-1 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Register your account
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email address"
            type="email"
            placeholder="e.g. user@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>

        {/* Register Link */}
        <div className="mt-6 text-center text-xs text-txt-muted">
          Don't have an account yet?{' '}
          <Link to="/register" className="text-accent hover:text-accent-hover font-semibold transition-colors">
            Register here
          </Link>
        </div>
      </Card>
    </div>
  );
};
