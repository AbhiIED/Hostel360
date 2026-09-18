import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QrCode, Shield, Utensils, LayoutDashboard, UserCheck } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { to: '/app', label: 'Student App', icon: UserCheck },
    { to: '/display/gate/demo-gate-1', label: 'Gate Kiosk (QR)', icon: QrCode },
    { to: '/display/mess/demo-mess-1', label: 'Mess Kiosk (QR)', icon: Utensils },
    { to: '/dashboard', label: 'Admin/Warden Dashboard', icon: LayoutDashboard },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-sky-500/10 p-2 rounded-xl border border-sky-500/20 text-sky-400">
            <Shield className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            HOSTEL360
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ml-2">
            v1.0 Scaffold
          </span>
        </div>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
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
        </nav>
      </div>
    </header>
  );
};

const HomeView = () => (
  <div className="max-w-5xl mx-auto py-16 px-4 text-center">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-sm mb-6">
      🚀 Full-Stack MCA Project
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

const StudentAppPlaceholder = () => (
  <div className="max-w-2xl mx-auto py-12 px-4">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
      <UserCheck className="w-12 h-12 text-sky-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Student App Interface</h2>
      <p className="text-slate-400 text-sm mb-6">Route: <code>/app/*</code></p>
      <div className="p-4 bg-slate-800/50 rounded-xl text-xs text-slate-300">
        Ready for Phase 2 (JWT Auth) and Phase 6 (QR Scanner View).
      </div>
    </div>
  </div>
);

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

const DashboardPlaceholder = () => (
  <div className="max-w-2xl mx-auto py-12 px-4">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
      <LayoutDashboard className="w-12 h-12 text-amber-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Management Dashboard</h2>
      <p className="text-slate-400 text-sm mb-6">Route: <code>/dashboard/*</code></p>
      <div className="p-4 bg-slate-800/50 rounded-xl text-xs text-slate-300">
        Ready for Phase 4 (Entity CRUD) and Phase 8 (Socket.IO Live Occupancy & Feeds).
      </div>
    </div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navigation />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/app/*" element={<StudentAppPlaceholder />} />
            <Route path="/display/gate/:deviceId" element={<GateKioskPlaceholder />} />
            <Route path="/display/mess/:deviceId" element={<MessKioskPlaceholder />} />
            <Route path="/dashboard/*" element={<DashboardPlaceholder />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
