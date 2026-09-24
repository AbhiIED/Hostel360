import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { User } from '../context/AuthContext';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<User['role']>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-[#5B6472]">
        <Loader2 className="w-6 h-6 animate-spin text-[#26415C]" />
        <p className="text-xs font-medium">Verifying authentication session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-white border border-[#E4E1DA] rounded-lg text-center">
        <div className="w-12 h-12 rounded-full bg-[#B3432B]/10 text-[#B3432B] flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <h2 className="text-base font-serif font-medium text-[#1C2430] mb-2">Access Restricted</h2>
        <p className="text-xs text-[#5B6472] mb-6">
          Your role (<span className="text-[#1C2430] font-mono font-medium">{user.role}</span>) does not have authorization to view this interface.
        </p>
        <Navigate to="/" replace />
      </div>
    );
  }

  return <>{children}</>;
};
