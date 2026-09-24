import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import {
  QrCode,
  Shield,
  LayoutDashboard,
  UserCheck,
  Building,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Header } from './components/Header';
import { DashboardNav } from './components/DashboardNav';
import { Footer } from './components/Footer';
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

const HomeView = () => {
  const { user, isAuthenticated } = useAuth();

  // Bug 1 Fix: Authenticated visitors must NEVER see the public hero/marketing view
  if (isAuthenticated && user) {
    if (user.role === 'STUDENT') {
      return <Navigate to="/app" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Bug 2 Fix: Logged-out institutional landing page with high contrast and zero dark artifacts
  return (
    <div className="max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      {/* Official Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-[#26415C] border border-[#E4E1DA] text-xs font-medium mb-4">
          <Shield className="w-3.5 h-3.5 text-[#26415C]" strokeWidth={1.75} />
          <span>Council of Wardens (COW) department • MANIT Bhopal</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#1C2430] mb-3 leading-tight font-serif">
          Central Campus Residential & Dining Access System
        </h1>
        <p className="text-xs sm:text-sm text-[#5B6472] leading-relaxed max-w-2xl mx-auto">
          Official attendance and security management across all 12 MANIT hostels. Powered by physical wall kiosk monitors with rotating dynamic 20-second QR codes and instant photo verification.
        </p>

        {/* Action buttons for visitors */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <Link
            to="/login"
            className="px-5 py-2.5 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium text-xs flex items-center gap-2 transition"
          >
            <span>Staff and warden sign in</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/app"
            className="px-5 py-2.5 rounded bg-white hover:bg-[#FAF9F6] text-[#1C2430] font-medium text-xs border border-[#E4E1DA] flex items-center gap-2 transition"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Student mobile scanner</span>
          </Link>
        </div>
      </div>

      {/* Three Institutional Access Portals */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {/* 1. Student Residential Portal */}
        <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="text-[#26415C] mb-4">
              <UserCheck className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="inline-block px-2.5 py-0.5 rounded bg-[#FAF9F6] text-[#5B6472] border border-[#E4E1DA] text-[11px] font-medium mb-2">
              Resident students
            </div>
            <h2 className="text-base font-serif font-medium text-[#1C2430] mb-2">
              Student mobile scanner
            </h2>
            <p className="text-xs text-[#5B6472] leading-relaxed mb-6">
              Students open their smartphone camera to scan the physical monitor at their hostel gate or mess hall. Instant gate state transition (Inside / Outside) and personal audit trail.
            </p>
          </div>
          <Link
            to="/app"
            className="w-full py-2.5 px-4 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium text-xs text-center transition flex items-center justify-center gap-2"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Open student scanner</span>
          </Link>
        </div>

        {/* 2. Staff & Council of Wardens Operations */}
        <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="text-[#26415C] mb-4">
              <LayoutDashboard className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="inline-block px-2.5 py-0.5 rounded bg-[#FAF9F6] text-[#5B6472] border border-[#E4E1DA] text-[11px] font-medium mb-2">
              Wardens and caretakers
            </div>
            <h2 className="text-base font-serif font-medium text-[#1C2430] mb-2">
              Operations control center
            </h2>
            <p className="text-xs text-[#5B6472] leading-relaxed mb-6">
              Real-time occupancy metrics for all 12 MANIT hostels, live entrance/exit event streams, student room allocations, Caretaker state correction workflow with audit reasons, and official CSV exports.
            </p>
          </div>
          <Link
            to="/login"
            className="w-full py-2.5 px-4 rounded bg-white hover:bg-[#FAF9F6] text-[#1C2430] font-medium text-xs text-center transition border border-[#E4E1DA] flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Sign in to operations</span>
          </Link>
        </div>

        {/* 3. Physical Wall Display Kiosks */}
        <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="text-[#26415C] mb-4">
              <QrCode className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="inline-block px-2.5 py-0.5 rounded bg-[#FAF9F6] text-[#5B6472] border border-[#E4E1DA] text-[11px] font-medium mb-2">
              Wall terminal displays
            </div>
            <h2 className="text-base font-serif font-medium text-[#1C2430] mb-2">
              Gate and mess displays
            </h2>
            <p className="text-xs text-[#5B6472] leading-relaxed mb-4">
              Fixed tablets and monitors at campus gates and dining counters that continuously rotate fresh 20-second dynamic QR tokens with a 5-second anti-proxy photo confirmation flash.
            </p>

            <div className="space-y-2 mb-6">
              <Link
                to="/display/gate/H1_GATE_TEST_7214"
                className="flex items-center justify-between p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] hover:border-[#26415C] text-xs transition"
              >
                <span className="font-medium text-[#1C2430]">H1 Gate display (Boys)</span>
                <span className="text-[11px] text-[#5B6472] font-mono">Secret: kiosk123</span>
              </Link>
              <Link
                to="/display/mess/MESS_DEV_8859"
                className="flex items-center justify-between p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] hover:border-[#26415C] text-xs transition"
              >
                <span className="font-medium text-[#1C2430]">Central mess display</span>
                <span className="text-[11px] text-[#5B6472] font-mono">Secret: kiosk123</span>
              </Link>
            </div>
          </div>
          <p className="text-[11px] text-[#5B6472] text-center">
            Hardware authenticated via device secret and HMAC tokens
          </p>
        </div>
      </div>

      {/* Institutional Security Protocol Highlights */}
      <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 sm:p-8 mb-8">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <div className="text-xs font-medium text-[#5B6472] mb-1">
            Security architecture
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-medium text-[#1C2430] tracking-tight">
            Why MANIT uses reverse dynamic QR attendance
          </h2>
          <p className="text-xs text-[#5B6472] mt-1">
            Eliminates photo forwarding, proxy attendance, and outdated paper registers.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          <div className="p-4 rounded bg-[#FAF9F6] border border-[#E4E1DA]">
            <Clock className="w-5 h-5 text-[#26415C] mb-2" strokeWidth={1.5} />
            <h3 className="text-xs font-semibold text-[#1C2430] mb-1">20-second dynamic tokens</h3>
            <p className="text-xs text-[#5B6472] leading-relaxed">
              QR codes change every 20 seconds. Screenshots cannot be forwarded or reused because expired tokens are rejected atomically.
            </p>
          </div>

          <div className="p-4 rounded bg-[#FAF9F6] border border-[#E4E1DA]">
            <CheckCircle2 className="w-5 h-5 text-[#2E7D5B] mb-2" strokeWidth={1.5} />
            <h3 className="text-xs font-semibold text-[#1C2430] mb-1">5-second guard screen flash</h3>
            <p className="text-xs text-[#5B6472] leading-relaxed">
              When a student scans, the wall display flashes their verified identity card photo, name, and room number to on-duty security guards.
            </p>
          </div>

          <div className="p-4 rounded bg-[#FAF9F6] border border-[#E4E1DA]">
            <Building className="w-5 h-5 text-[#B7791F] mb-2" strokeWidth={1.5} />
            <h3 className="text-xs font-semibold text-[#1C2430] mb-1">Strict hostel scoping</h3>
            <p className="text-xs text-[#5B6472] leading-relaxed">
              Students assigned to Hostel H1 cannot scan into Hostel H8. The backend enforces strict hostel and gender boundary isolation in real time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
          <Header />
          <DashboardNav />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomeView />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/caretaker" element={<Navigate to="/dashboard" replace />} />
              <Route path="/warden" element={<Navigate to="/dashboard" replace />} />
              <Route path="/mess" element={<Navigate to="/dashboard" replace />} />
              <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
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
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER']}>
                    <HostelRoomManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/students"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER']}>
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
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN']}>
                    <AttendanceHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/analytics"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN']}>
                    <AnalyticsReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN']}>
                    <DashboardHubPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/*"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN']}>
                    <DashboardHubPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
