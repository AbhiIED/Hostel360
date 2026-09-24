import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  LayoutDashboard,
  Building2,
  GraduationCap,
  Utensils,
  Laptop,
  History,
  TrendingUp,
} from 'lucide-react';

export const DashboardNav: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  // Only render on dashboard management pages
  if (!isAuthenticated || !location.pathname.startsWith('/dashboard')) {
    return null;
  }

  const role = user?.role;
  const currentPath = location.pathname;
  const isSubpage = currentPath !== '/dashboard';

  // Navigation items based on role permissions
  const navItems = [
    {
      label: 'Overview',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN'],
    },
    {
      label: 'Hostels & rooms',
      path: '/dashboard/hostels',
      icon: Building2,
      roles: ['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER'],
    },
    {
      label: 'Student registry',
      path: '/dashboard/students',
      icon: GraduationCap,
      roles: ['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER'],
    },
    {
      label: 'Dining & mess',
      path: '/dashboard/messes',
      icon: Utensils,
      roles: ['SUPER_ADMIN', 'MESS_ADMIN'],
    },
    {
      label: 'Hardware kiosks',
      path: '/dashboard/devices',
      icon: Laptop,
      roles: ['SUPER_ADMIN'],
    },
    {
      label: 'Audit history',
      path: '/dashboard/history',
      icon: History,
      roles: ['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN'],
    },
    {
      label: 'Analytics & trends',
      path: '/dashboard/analytics',
      icon: TrendingUp,
      roles: ['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN'],
    },
  ];

  const filteredItems = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <div className="bg-white border-b border-[#E4E1DA] sticky top-14 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-11 text-xs">
        {/* Left: Back button if on subpage, or label */}
        <div className="flex items-center gap-3">
          {isSubpage ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-[#5B6472] hover:text-[#26415C] font-medium transition py-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Back to overview</span>
            </Link>
          ) : (
            <span className="text-[#5B6472] font-medium">Operations hub</span>
          )}
        </div>

        {/* Right / Center: Horizontal Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1">
          {filteredItems.map((item) => {
            const isActive = currentPath === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded transition whitespace-nowrap ${
                  isActive
                    ? 'text-[#1C2430] font-medium bg-[#FAF9F6] border border-[#E4E1DA]'
                    : 'text-[#5B6472] hover:text-[#1C2430] hover:bg-[#FAF9F6]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#26415C]' : 'text-[#5B6472]'}`} strokeWidth={1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default DashboardNav;
