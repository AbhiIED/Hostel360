import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QrCode, Shield, Utensils, LayoutDashboard, UserCheck, LogOut, LogIn, Building2, GraduationCap, Laptop } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DeviceManagementPage } from './pages/DeviceManagementPage';
import { HostelRoomManagementPage } from './pages/HostelRoomManagementPage';
import { StudentManagementPage } from './pages/StudentManagementPage';
import { MessMealWindowManagementPage } from './pages/MessMealWindowManagementPage';
import { KioskDisplayPage } from './pages/KioskDisplayPage';
import { StudentAppPage } from './pages/StudentAppPage';

const Navigation = () => {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  // Kiosk screens run borderless without the website navbar
  if (location.pathname.startsWith('/display/')) {
    return null;
  }

  const navItems = [
    { to: '/app', label: 'Student App', icon: UserCheck, roleRequired: 'STUDENT' },
    { to: '/display/gate/demo-gate-1', label: 'Gate Kiosk (QR)', icon: QrCode, public: true },
    { to: '/display/mess/demo-mess-1', label: 'Mess Kiosk (QR)', icon: Utensils, public: true },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roleRequired: ['SUPER_ADMIN', 'WARDEN', 'MESS_ADMIN'] },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="bg-sky-500/10 p-2 rounded-xl border border-sky-500/20 text-sky-400">
            <Shield className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            HOSTEL360
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ml-1 hidden sm:inline">
            v1.0
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);

            // Filter menu visibility if user doesn't have role
            if (item.roleRequired && user) {
              const roles = Array.isArray(item.roleRequired) ? item.roleRequired : [item.roleRequired];
              if (!roles.includes(user.role)) return null;
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}

          <div className="h-5 w-px bg-slate-800 mx-1" />

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-white leading-tight">{user.name}</div>
                <div className="text-[10px] text-sky-400 font-mono">{user.role}</div>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <LogIn className="w-4 h-4 text-sky-400" />
              <span>Sign In</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

const HomeView = () => (
  <div className="max-w-5xl mx-auto py-16 px-4 text-center">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-sm mb-6">
      🚀 Real-Time QR Gate & Mess Attendance
    </div>
    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-6">
      Smart QR-Based Hostel & Mess Management
    </h1>
    <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
      Fixed gate displays show short-lived dynamic QR codes. Authenticated students scan them, the backend updates attendance atomically, and kiosk displays flash photo confirmations in real time.
    </p>

    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
      <Link to="/app" className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 transition">
        <UserCheck className="w-8 h-8 text-sky-400 mb-3" />
        <h3 className="font-semibold text-white">Student App</h3>
        <p className="text-xs text-slate-400 mt-1">Scan gate/mess QR and view entry & meal history</p>
      </Link>
      <Link to="/display/gate/demo-gate-1" className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 transition">
        <QrCode className="w-8 h-8 text-indigo-400 mb-3" />
        <h3 className="font-semibold text-white">Live Gate Kiosk</h3>
        <p className="text-xs text-slate-400 mt-1">Dynamic 20s QR rotation & 5s student photo confirmation</p>
      </Link>
      <Link to="/display/mess/demo-mess-1" className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 transition">
        <Utensils className="w-8 h-8 text-emerald-400 mb-3" />
        <h3 className="font-semibold text-white">Mess Kiosk</h3>
        <p className="text-xs text-slate-400 mt-1">Meal window bounded dynamic QR and anti-duplicate check</p>
      </Link>
      <Link to="/dashboard" className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 transition">
        <LayoutDashboard className="w-8 h-8 text-amber-400 mb-3" />
        <h3 className="font-semibold text-white">Control Center</h3>
        <p className="text-xs text-slate-400 mt-1">Live occupancy feeds, wardens, mess & super admin CRUD</p>
      </Link>
    </div>
  </div>
);

const StudentAppPlaceholder = () => {
  const { user } = useAuth();
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <UserCheck className="w-12 h-12 text-sky-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Student App Interface</h2>
        <p className="text-slate-400 text-sm mb-4">
          Logged in as: <span className="text-white font-semibold">{user?.name}</span> ({user?.student?.roll_number})
        </p>
        <div className="p-4 bg-slate-800/50 rounded-xl text-xs text-slate-300">
          State: <span className="text-emerald-400 font-bold">{user?.student?.current_state}</span> | Hostel: {user?.student?.hostel?.name} | Room: {user?.student?.room?.room_number}
        </div>
      </div>
    </div>
  );
};

const GateKioskPlaceholder = () => (
  <div className="max-w-2xl mx-auto py-12 px-4">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
      <QrCode className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Gate Kiosk Display</h2>
      <p className="text-slate-400 text-sm mb-6">Route: <code>/display/gate/:deviceId</code></p>
      <div className="p-4 bg-slate-800/50 rounded-xl text-xs text-slate-300">
        Ready for Phase 3 (Device Secret Auth), Phase 5 (Rotating QR), and Phase 6 (5s Photo Confirmation Flash).
      </div>
    </div>
  </div>
);

const MessKioskPlaceholder = () => (
  <div className="max-w-2xl mx-auto py-12 px-4">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
      <Utensils className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Mess Kiosk Display</h2>
      <p className="text-slate-400 text-sm mb-6">Route: <code>/display/mess/:deviceId</code></p>
      <div className="p-4 bg-slate-800/50 rounded-xl text-xs text-slate-300">
        Ready for Phase 7 (Active Meal Window Dynamic QR & Confirmation Flash).
      </div>
    </div>
  </div>
);

const DashboardPlaceholder = () => {
  const { user } = useAuth();
  const adminLinks = [
    { to: '/dashboard/hostels', label: 'Hostels & Rooms', desc: 'Manage hostels, rooms, and gates', icon: Building2, color: 'sky' },
    { to: '/dashboard/students', label: 'Student Registry', desc: 'View, register, and assign students', icon: GraduationCap, color: 'indigo' },
    { to: '/dashboard/messes', label: 'Messes & Meals', desc: 'Configure messes and meal windows', icon: Utensils, color: 'emerald' },
    { to: '/dashboard/devices', label: 'Hardware Devices', desc: 'Manage kiosk display devices', icon: Laptop, color: 'amber' },
  ];
  const colorMap: Record<string, string> = {
    sky: 'bg-sky-500/10 border-sky-500/20 text-sky-400 hover:border-sky-500/50',
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:border-indigo-500/50',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:border-emerald-500/50',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:border-amber-500/50',
  };
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <LayoutDashboard className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Management Dashboard</h2>
        <p className="text-slate-400 text-sm">
          Logged in as: <span className="text-white font-semibold">{user?.name}</span> (<span className="text-amber-400">{user?.role}</span>)
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {adminLinks.map(link => {
          const Icon = link.icon;
          const show = user?.role === 'SUPER_ADMIN' ||
            (user?.role === 'WARDEN' && ['Hostels & Rooms', 'Student Registry'].includes(link.label)) ||
            (user?.role === 'MESS_ADMIN' && link.label === 'Messes & Meals');
          if (!show) return null;
          return (
            <Link key={link.to} to={link.to}
              className={`p-5 rounded-2xl border transition ${colorMap[link.color]}`}>
              <Icon className="w-8 h-8 mb-3" />
              <h3 className="font-semibold text-white text-base">{link.label}</h3>
              <p className="text-xs text-slate-400 mt-1">{link.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
          <Navigation />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomeView />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/app/*"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <StudentAppPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <StudentAppPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/display/gate/:deviceId" element={<KioskDisplayPage />} />
              <Route path="/display/mess/:deviceId" element={<KioskDisplayPage />} />
              <Route
                path="/dashboard/devices"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <DeviceManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/hostels"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN']}>
                    <HostelRoomManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/students"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN']}>
                    <StudentManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/messes"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MESS_ADMIN']}>
                    <MessMealWindowManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/*"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'MESS_ADMIN']}>
                    <DashboardPlaceholder />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
