import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Sparkles, AlertCircle, ShieldCheck } from 'lucide-react';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError('Please complete all required fields');
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
    <div className="min-h-screen bg-bg flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background radial accent glow */}
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
          Create your researcher or student profile
        </p>
      </div>

      {/* Centered Auth Card */}
      <Card className="w-full max-w-[420px] p-8 border-border bg-surface relative z-10 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-txt">Register Profile</h2>
          <p className="text-xs text-txt-muted mt-1">Join your university lab project environment</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-input bg-danger/10 border border-danger/20 flex items-start gap-2.5 text-danger text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            placeholder="e.g. Dr. Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />

          <Input
            label="University Email"
            type="email"
            placeholder="e.g. jdoe@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Password (min 8 characters)"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          {/* Role Policy notice per Section 6 */}
          <div className="p-3 rounded-input bg-surface-2/60 border border-border flex items-start gap-2.5 text-[11px] text-txt-muted">
            <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <span>
              New accounts receive <strong className="text-txt">Student</strong> permissions by default. A Professor may elevate roles in User Management.
            </span>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={loading}
          >
            {loading ? 'Creating Profile...' : 'Complete Registration'}
          </Button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center text-xs text-txt-muted">
          Already registered?{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover font-semibold transition-colors">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
};
