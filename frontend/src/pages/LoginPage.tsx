import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already authenticated, redirect straight to their role console
  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'STUDENT' ? '/app' : '/dashboard'} replace />;
  }

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const authenticatedUser = await login(email, password);

      // Route directly according to role, skipping the public hero entirely
      if (from === '/' || from === '/login') {
        if (authenticatedUser.role === 'STUDENT') {
          navigate('/app', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { error?: string }; status?: number };
        code?: string;
        message?: string;
      };
      if (axiosError.response?.data?.error) {
        setError(axiosError.response.data.error);
      } else if (axiosError.code === 'ERR_NETWORK' || !axiosError.response) {
        setError('Cannot connect to backend server. The server may still be deploying or waking up — please wait a moment and try again.');
      } else if (axiosError.response?.status === 502 || axiosError.response?.status === 503) {
        setError('Backend service is currently booting up. Please retry in 30 seconds.');
      } else {
        setError('Authentication failed. Please check credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillCredentials = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 sm:p-8">
          <div className="text-center mb-6">
            <Shield className="w-8 h-8 text-[#26415C] mx-auto mb-2.5" strokeWidth={1.5} />
            <div className="text-xs text-[#5B6472] font-medium mb-1">
              Council of Wardens • MANIT Bhopal
            </div>
            <h1 className="text-2xl font-serif font-medium text-[#1C2430] tracking-tight">
              Sign in to HOSTEL360
            </h1>
            <p className="text-xs text-[#5B6472] mt-1">
              Enter your official institutional email and password
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded bg-[#B3432B]/10 border border-[#B3432B]/30 text-[#B3432B] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B3432B]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#1C2430] mb-1.5">
                College email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="scholar@manit.ac.in"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#5B6472]/60 focus:outline-none focus:border-[#26415C] transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1C2430] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#5B6472]/60 focus:outline-none focus:border-[#26415C] transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-[#26415C] hover:bg-[#1e344a] text-white font-medium rounded text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* New Student Registration Link */}
          <div className="mt-5 p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1DA] flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-[#1C2430]">New Student Admission?</div>
              <div className="text-[11px] text-[#5B6472]">Register & enter hostel room lottery</div>
            </div>
            <Link
              to="/register"
              className="py-1.5 px-3 rounded bg-[#26415C] text-white hover:bg-[#1e344a] transition font-medium text-xs flex items-center gap-1"
            >
              <span>Register</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="mt-6 pt-5 border-t border-[#E4E1DA]">
            <p className="text-xs text-[#5B6472] mb-3 text-center">
              Quick login presets (Password: <code className="text-[#1C2430] font-mono">password123</code>):
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillCredentials('admin@hostel360.com')}
                className="p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] hover:border-[#26415C] transition text-left"
              >
                <div className="font-medium text-[#26415C]">COW / DSW (Admin)</div>
                <div className="text-[10px] text-[#5B6472] truncate">admin@hostel360.com</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('warden.h5@hostel360.com')}
                className="p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] hover:border-[#26415C] transition text-left"
              >
                <div className="font-medium text-[#2E7D5B]">Warden (H5)</div>
                <div className="text-[10px] text-[#5B6472] truncate">warden.h5@...</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('vicewarden.h5@hostel360.com')}
                className="p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] hover:border-[#26415C] transition text-left"
              >
                <div className="font-medium text-[#28666E]">Vice Warden (H5)</div>
                <div className="text-[10px] text-[#5B6472] truncate">vicewarden.h5@...</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('caretaker.h5@hostel360.com')}
                className="p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] hover:border-[#26415C] transition text-left"
              >
                <div className="font-medium text-[#9C5B28]">Caretaker (H5)</div>
                <div className="text-[10px] text-[#5B6472] truncate">caretaker.h5@...</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('messadmin@hostel360.com')}
                className="p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] hover:border-[#26415C] transition text-left"
              >
                <div className="font-medium text-[#6E4369]">Mess Manager</div>
                <div className="text-[10px] text-[#5B6472] truncate">messadmin@...</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('aarav.sharma@student.hostel360.com')}
                className="p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] hover:border-[#26415C] transition text-left"
              >
                <div className="font-medium text-[#3B5278]">Student resident</div>
                <div className="text-[10px] text-[#5B6472] truncate">aarav.sharma@...</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
