import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LogOut } from 'lucide-react';

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Kiosk screens run borderless without the website navbar
  if (location.pathname.startsWith('/display/')) {
    return null;
  }

  // Role metadata: clean title and subtle 3px accent color
  const getRoleMeta = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Council of Wardens office', accent: '#26415C' };
      case 'WARDEN':
        return { label: 'Hostel Warden', accent: '#2E7D5B' };
      case 'VICE_WARDEN':
        return { label: 'Vice Warden', accent: '#28666E' };
      case 'CARETAKER':
        return { label: 'Hostel Caretaker', accent: '#9C5B28' };
      case 'MESS_ADMIN':
        return { label: 'Dining supervisor', accent: '#6E4369' };
      case 'STUDENT':
        return { label: 'Student resident', accent: '#3B5278' };
      default:
        return { label: 'Campus portal', accent: '#E4E1DA' };
    }
  };

  const roleMeta = getRoleMeta(user?.role);

  const homeHref = isAuthenticated ? (user?.role === 'STUDENT' ? '/app' : '/dashboard') : '/';

  return (
    <header className="bg-white border-b border-[#E4E1DA] sticky top-0 z-50">
      {/* Single clean institutional row */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Crest and Institute name */}
        <Link to={homeHref} className="flex items-center gap-2.5 text-[#1C2430] hover:text-[#26415C] transition">
          <Shield className="w-5 h-5 text-[#26415C]" strokeWidth={1.75} />
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-base font-semibold tracking-tight text-[#1C2430]">
              HOSTEL360
            </span>
            <span className="text-xs text-[#5B6472] font-normal">
              MANIT Bhopal
            </span>
          </div>
        </Link>

        {/* Center: Console label if authenticated */}
        {isAuthenticated && user && (
          <div className="hidden md:flex items-center gap-1.5 text-xs text-[#5B6472]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: roleMeta.accent }}
            />
            <span>{roleMeta.label}</span>
          </div>
        )}

        {/* Right: User identification & actions */}
        <div className="flex items-center gap-4 text-xs">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <span className="text-[#1C2430] font-medium">
                {user.name}
              </span>
              <span className="text-[#E4E1DA]">•</span>
              <button
                onClick={handleLogout}
                className="text-[#5B6472] hover:text-[#B3432B] transition flex items-center gap-1 font-normal"
                title="Sign out"
              >
                <span>Sign out</span>
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-[#26415C] hover:underline font-medium"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Subtle 3px role accent rule under the header */}
      <div
        className="h-[3px] w-full"
        style={{ backgroundColor: roleMeta.accent }}
      />
    </header>
  );
};
