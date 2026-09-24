import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QrCode, Shield, LayoutDashboard, UserCheck, LogOut, LogIn } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DeviceManagementPage } from './pages/DeviceManagementPage';
import { HostelRoomManagementPage } from './pages/HostelRoomManagementPage';
import { StudentManagementPage } from './pages/StudentManagementPage';
import { MessMealWindowManagementPage } from './pages/MessMealWindowManagementPage';
import { KioskDisplayPage } from './pages/KioskDisplayPage';
import { StudentAppPage } from './pages/StudentAppPage';
import { DashboardHubPage } from './pages/DashboardHubPage';
import { AttendanceHistoryPage } from './pages/AttendanceHistoryPage';
import { AnalyticsReportsPage } from './pages/AnalyticsReportsPage';

const Navigation = () => {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  // Kiosk screens run borderless without the website navbar
  if (location.pathname.startsWith('/display/')) {
    return null;
  }

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
            MANIT Bhopal
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {/* 1. Student navigation: ONLY Student Scanner is visible */}
          {isAuthenticated && user?.role === 'STUDENT' && (
            <Link
              to="/app"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                location.pathname.startsWith('/app')
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <UserCheck className="w-4 h-4 text-sky-400" />
              <span>Student Scanner</span>
            </Link>
          )}

          {/* 2. Admin / Warden navigation */}
          {isAuthenticated && user && ['SUPER_ADMIN', 'WARDEN', 'MESS_ADMIN'].includes(user.role) && (
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                location.pathname.startsWith('/dashboard')
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-sky-400" />
              <span>Control Center</span>
            </Link>
          )}

          {/* 3. Unauthenticated public quick links */}
          {!isAuthenticated && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <Link
                to="/app"
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition font-medium"
              >
                Student Scanner
              </Link>
              <Link
                to="/dashboard"
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition font-medium"
              >
                Staff Portal
              </Link>
            </div>
          )}

          <div className="h-5 w-px bg-slate-800 mx-1" />

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-white leading-tight">{user.name}</div>
                <div className="text-[10px] text-sky-400 font-mono font-semibold">{user.role}</div>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition shadow-md shadow-sky-600/20"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

const HomeView = () => (
  <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6">
    <div className="text-center max-w-3xl mx-auto mb-12">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-bold uppercase tracking-wider mb-5">
        MANIT Bhopal • Smart QR Attendance Architecture
      </div>
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-5 leading-tight">
        Hostel & Mess Access Control
      </h1>
      <p className="text-base text-slate-300">
        Physical wall displays at gates & mess counters show rotating 20-second dynamic QR codes.
        Authenticated students scan them with their phone camera to instantly record entry, exit, or meals.
      </p>
    </div>

    {/* THREE DISTINCT PORTALS */}
    <div className="grid md:grid-cols-3 gap-6 mb-12">
      {/* 1. STUDENT PORTAL */}
      <div className="rounded-3xl bg-slate-900 border-2 border-sky-500/30 p-7 shadow-xl shadow-sky-950/40 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
        <div>
          <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center mb-5 shadow-lg">
            <UserCheck className="w-6 h-6" />
          </div>
          <div className="inline-block px-2.5 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[11px] font-bold uppercase tracking-wider mb-2">
            Student Portal
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Camera QR Scanner</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Students open their phone camera to <strong className="text-white">SCAN</strong> the physical gate or mess monitor. Students never generate QR codes.
          </p>
        </div>
        <Link
          to="/app"
          className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs text-center transition shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2"
        >
          <UserCheck className="w-4 h-4" />
          <span>Open Student Scanner</span>
        </Link>
      </div>

      {/* 2. ADMIN & WARDEN DASHBOARD */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-7 shadow-xl flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 shadow-lg">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div className="inline-block px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-bold uppercase tracking-wider mb-2">
            Staff & Admin
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Operations Control Center</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Real-time occupancy tracking across 12 MANIT hostels, live gate feeds, meal schedules, student allocations, and CSV/PDF analytics reports.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs text-center transition border border-slate-700 flex items-center justify-center gap-2"
        >
          <LayoutDashboard className="w-4 h-4 text-amber-400" />
          <span>Open Admin Dashboard</span>
        </Link>
      </div>

      {/* 3. PHYSICAL WALL DISPLAYS (KIOSKS) */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-7 shadow-xl flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 shadow-lg">
            <QrCode className="w-6 h-6" />
          </div>
          <div className="inline-block px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-bold uppercase tracking-wider mb-2">
            Hardware Wall Terminals
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Gate & Mess Displays</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Fixed tablet screens mounted at gates and mess counters that <strong className="text-white">DISPLAY</strong> rotating 20s QR codes for students to scan.
          </p>

          <div className="space-y-2 mb-6">
            <Link
              to="/display/gate/H1_GATE_TEST_7214"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-xs transition"
            >
              <span className="font-semibold text-white">H1 Gate Display (Boys)</span>
              <span className="text-[10px] text-indigo-400 font-mono">Secret: kiosk123</span>
            </Link>
            <Link
              to="/display/mess/MESS_DEV_8859"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 text-xs transition"
            >
              <span className="font-semibold text-white">Central Mess Display</span>
              <span className="text-[10px] text-emerald-400 font-mono">Secret: kiosk123</span>
            </Link>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 text-center">
          Terminal displays flash 5s photo confirmation upon scan
        </p>
      </div>
    </div>
  </div>
);

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
                path="/dashboard/history"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'MESS_ADMIN']}>
                    <AttendanceHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/analytics"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'MESS_ADMIN']}>
                    <AnalyticsReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'MESS_ADMIN']}>
                    <DashboardHubPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/*"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'MESS_ADMIN']}>
                    <DashboardHubPage />
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
