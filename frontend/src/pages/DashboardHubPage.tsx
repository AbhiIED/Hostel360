import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import {
  Building2,
  GraduationCap,
  Utensils,
  Laptop,
  History,
  Shield,
  AlertTriangle,
  ArrowRightLeft,
  LogIn,
  LogOut,
  Users,
  CheckCircle2,
  Clock,
  Radio,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

export const DashboardHubPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Super Admin Data
  const [adminData, setAdminData] = useState<any>(null);

  // Warden Data
  const [wardenData, setWardenData] = useState<any>(null);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [liveHostelFeed, setLiveHostelFeed] = useState<any[]>([]);

  // Mess Admin Data
  const [messData, setMessData] = useState<any>(null);
  const [liveMessFeed, setLiveMessFeed] = useState<any[]>([]);

  const socketRef = useRef<Socket | null>(null);

  const fetchDashboardData = async () => {
    try {
      if (user?.role === 'SUPER_ADMIN') {
        const res = await api.get('/dashboard/admin');
        setAdminData(res.data);
      } else if (user?.role === 'WARDEN') {
        const res = await api.get('/dashboard/warden', {
          params: selectedHostelId ? { hostelId: selectedHostelId } : {},
        });
        setWardenData(res.data);
        if (!selectedHostelId && res.data.hostels?.length > 0) {
          setSelectedHostelId(res.data.hostels[0].id);
        }
        setLiveHostelFeed(res.data.recent_events || []);
      } else if (user?.role === 'MESS_ADMIN') {
        const res = await api.get('/dashboard/mess-admin');
        setMessData(res.data);
        setLiveMessFeed(res.data.recent_feed || []);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user?.role, selectedHostelId]);

  // Real-Time Socket.IO Connections (8.1, 8.2, 8.4)
  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (user?.role === 'SUPER_ADMIN') {
        socket.emit('join', 'admin:feed');
      } else if (user?.role === 'WARDEN' && selectedHostelId) {
        socket.emit('join', `hostel:${selectedHostelId}`);
      } else if (user?.role === 'MESS_ADMIN' && messData?.mess?.id) {
        socket.emit('join', `mess:${messData.mess.id}`);
      }
    });

    // Listen for live hostel attendance scans
    socket.on('attendance:new', (event: any) => {
      setLiveHostelFeed((prev) => [event, ...prev.slice(0, 39)]);

      // Increment counters if super admin
      if (user?.role === 'SUPER_ADMIN') {
        setAdminData((prev: any) => {
          if (!prev) return prev;
          const isEntry = event.direction === 'ENTRY';
          return {
            ...prev,
            metrics: {
              ...prev.metrics,
              today_hostel_scans: prev.metrics.today_hostel_scans + 1,
              inside_count: prev.metrics.inside_count + (isEntry ? 1 : -1),
              outside_count: prev.metrics.outside_count + (isEntry ? -1 : 1),
            },
          };
        });
      }
    });

    // Listen for live mess attendance scans
    socket.on('mess:attendance:new', (event: any) => {
      setLiveMessFeed((prev) => [event, ...prev.slice(0, 39)]);

      if (user?.role === 'MESS_ADMIN') {
        setMessData((prev: any) => {
          if (!prev) return prev;
          const mealKey = event.mealType as string;
          return {
            ...prev,
            counts_by_meal: {
              ...prev.counts_by_meal,
              [mealKey]: (prev.counts_by_meal[mealKey] || 0) + 1,
              TOTAL: (prev.counts_by_meal.TOTAL || 0) + 1,
            },
          };
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.role, selectedHostelId, messData?.mess?.id]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500 mb-3" />
        <p className="text-sm font-medium">Loading Real-Time Operations Feed...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* 1. TOP HEADER & GREETING */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 p-0.5 shadow-lg shadow-sky-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Shield className="w-6 h-6 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Operations Command
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  LIVE SYNC
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Logged in as <strong className="text-white">{user?.name}</strong> • Role:{' '}
                <strong className="text-sky-400 font-mono">{user?.role}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/history"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold transition"
          >
            <History className="w-4 h-4 text-sky-400" />
            <span>Audit History</span>
          </Link>

          <button
            onClick={() => {
              setRefreshing(true);
              fetchDashboardData();
            }}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition disabled:opacity-50"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. SUPER ADMIN VIEW (8.6) */}
      {user?.role === 'SUPER_ADMIN' && adminData && (
        <div className="space-y-8">
          {/* High-level KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                <span>MANIT HOSTELS</span>
                <Building2 className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-3xl font-black text-white">
                {adminData.metrics.hostels_count}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {adminData.metrics.rooms_count} rooms • Capacity: {adminData.metrics.total_capacity}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                <span>CAMPUS OCCUPANCY</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-3xl font-black text-emerald-400">
                {adminData.metrics.campus_occupancy_rate}%
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                <strong className="text-white">{adminData.metrics.inside_count}</strong> Inside •{' '}
                <strong className="text-amber-400">{adminData.metrics.outside_count}</strong> Outside
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                <span>TODAY'S GATE SCANS</span>
                <ArrowRightLeft className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black text-white">
                {adminData.metrics.today_hostel_scans}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Registered students: {adminData.metrics.students_count}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                <span>KIOSK TERMINALS</span>
                <Laptop className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-black text-white">
                {adminData.metrics.active_devices_count} / {adminData.metrics.devices_count}
              </div>
              <p className="text-[11px] text-emerald-400 mt-1 font-semibold">
                Online & Synchronized
              </p>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
              Management Modules
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/dashboard/hostels"
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 transition group shadow"
              >
                <Building2 className="w-6 h-6 text-sky-400 mb-2 group-hover:scale-110 transition" />
                <h3 className="font-bold text-white text-base">Hostels & Rooms</h3>
                <p className="text-xs text-slate-400 mt-1">Manage 12 MANIT hostels, rooms, and gates</p>
              </Link>

              <Link
                to="/dashboard/students"
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition group shadow"
              >
                <GraduationCap className="w-6 h-6 text-indigo-400 mb-2 group-hover:scale-110 transition" />
                <h3 className="font-bold text-white text-base">Student Registry</h3>
                <p className="text-xs text-slate-400 mt-1">Search, enroll, and assign student rooms</p>
              </Link>

              <Link
                to="/dashboard/messes"
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition group shadow"
              >
                <Utensils className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-110 transition" />
                <h3 className="font-bold text-white text-base">Messes & Meals</h3>
                <p className="text-xs text-slate-400 mt-1">Configure meal windows and dining halls</p>
              </Link>

              <Link
                to="/dashboard/devices"
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition group shadow"
              >
                <Laptop className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition" />
                <h3 className="font-bold text-white text-base">Hardware Kiosks</h3>
                <p className="text-xs text-slate-400 mt-1">Register displays and generate secrets</p>
              </Link>
            </div>
          </div>

          {/* System Alerts & Global Feed Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* System Alerts Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>Security & Device Alerts</span>
              </h2>

              <div className="space-y-3">
                {adminData.alerts.inactive_devices?.length > 0 ? (
                  adminData.alerts.inactive_devices.map((dev: any) => (
                    <div
                      key={dev.id}
                      className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-white">{dev.device_name}</div>
                        <div className="text-[11px] text-slate-400">Terminal Deactivated</div>
                      </div>
                      <Link
                        to="/dashboard/devices"
                        className="text-sky-400 hover:underline text-[11px]"
                      >
                        Inspect
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>All registered kiosk devices are active & online.</span>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Failed Scans (Last 24h)</span>
                    <span className="font-mono text-amber-400">
                      {adminData.alerts.failed_scans_24h}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Failed attempts due to expired QR, invalid tokens, or device mismatch.
                  </p>
                </div>
              </div>
            </div>

            {/* Global Real-Time Activity Feed */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-sky-400 animate-pulse" />
                  <span>Global Campus Activity Feed</span>
                </h2>
                <Link
                  to="/dashboard/history"
                  className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {liveHostelFeed.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    No movements recorded yet. Live gate events will stream here automatically.
                  </div>
                ) : (
                  liveHostelFeed.slice(0, 15).map((evt: any) => {
                    const isEntry = evt.direction === 'ENTRY';
                    const timeStr = new Date(evt.scanned_at || evt.scannedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                    });

                    return (
                      <div
                        key={evt.id}
                        className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`p-1.5 rounded-xl border ${
                              isEntry
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}
                          >
                            {isEntry ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                          </span>
                          <div>
                            <span className="font-bold text-white">
                              {evt.student?.user?.name || evt.student?.name}
                            </span>
                            <span className="text-slate-400 ml-2 font-mono text-[11px]">
                              [{evt.student?.roll_number || evt.student?.rollNumber}]
                            </span>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {evt.hostel?.name || evt.hostelName} • {evt.gate?.name || evt.gateName}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              isEntry
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {evt.direction}
                          </span>
                          <div className="text-[11px] text-slate-500 font-mono mt-1">{timeStr}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. WARDEN VIEW: OCCUPANCY PANELS & LIVE FEED (8.2 & 8.3) */}
      {(user?.role === 'WARDEN' || (user?.role === 'SUPER_ADMIN' && wardenData)) && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-400" />
                <span>Hostel Occupancy & Live Gate Stream</span>
              </h2>
              <p className="text-xs text-slate-400">
                Real-time occupancy counters and live entrance/exit event stream
              </p>
            </div>

            {/* Hostel Selector if Warden has multiple hostels */}
            {wardenData?.hostels?.length > 1 && (
              <select
                value={selectedHostelId}
                onChange={(e) => setSelectedHostelId(e.target.value)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {wardenData.hostels.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    [{h.code}] {h.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Occupancy Panels (8.3) */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {wardenData?.occupancy_panels?.map((panel: any) => {
              const isHigh = panel.occupancy_rate >= 90;
              return (
                <div
                  key={panel.hostel_id}
                  className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        {panel.code}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          panel.type === 'GIRLS'
                            ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {panel.type} HOSTEL
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white mb-1 truncate">{panel.name}</h3>
                    <p className="text-xs text-slate-400 mb-4">{panel.location}</p>

                    {/* Occupancy Metrics */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-center mb-4">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Inside</div>
                        <div className="text-lg font-black text-emerald-400">{panel.inside_count}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Outside</div>
                        <div className="text-lg font-black text-amber-400">{panel.outside_count}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Vacant</div>
                        <div className="text-lg font-black text-slate-300">{panel.vacant_beds}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-400">Occupancy</span>
                        <span className={isHigh ? 'text-amber-400' : 'text-emerald-400'}>
                          {panel.occupancy_rate}% of {panel.total_capacity} beds
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHigh ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, panel.occupancy_rate)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <span>{panel.gates?.length || 2} Active Gates</span>
                    <Link
                      to={`/dashboard/history?hostel_id=${panel.hostel_id}`}
                      className="text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      Audit Log <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Warden Live Gate Stream (8.2) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Live Gate Movements Stream</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Real-Time Updates via Socket.IO
              </span>
            </div>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {liveHostelFeed.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No gate scans logged yet for this hostel. Gate movements will flash here in real time.
                </div>
              ) : (
                liveHostelFeed.map((evt: any) => {
                  const isEntry = evt.direction === 'ENTRY';
                  const timeStr = new Date(evt.scanned_at || evt.scannedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  });

                  return (
                    <div
                      key={evt.id}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-4 text-xs animate-in fade-in duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`p-2 rounded-xl border ${
                            isEntry
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}
                        >
                          {isEntry ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                        </span>
                        <div>
                          <span className="font-bold text-white text-sm">
                            {evt.student?.user?.name || evt.student?.name}
                          </span>
                          <span className="text-sky-400 ml-2 font-mono">
                            [{evt.student?.roll_number || evt.student?.rollNumber}]
                          </span>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Gate: <strong>{evt.gate?.name || evt.gateName}</strong> • Room:{' '}
                            <strong className="font-mono text-slate-300">
                              {evt.student?.room?.room_number || evt.student?.roomNumber || 'N/A'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`px-3 py-1 rounded-full font-bold text-xs ${
                            isEntry
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {evt.direction}
                        </span>
                        <div className="text-[11px] text-slate-500 font-mono mt-1">{timeStr}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. MESS ADMIN VIEW: DAILY MEAL COUNTS & LIVE MEAL STREAM (8.4 & 8.5) */}
      {(user?.role === 'MESS_ADMIN' || (user?.role === 'SUPER_ADMIN' && messData?.mess)) && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <Utensils className="w-5 h-5 text-amber-400" />
                <span>Mess Dining Hall & Daily Meal Counts</span>
              </h2>
              <p className="text-xs text-slate-400">
                {messData?.mess?.name || 'MANIT Campus Mess'} • Live meal attendance stream
              </p>
            </div>

            {/* Active Meal Window Banner */}
            {messData?.active_window ? (
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-lg shadow-amber-500/10">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span>{messData.active_window.meal_type} SERVING</span>
                <span className="text-slate-400 font-mono">
                  ({messData.active_window.start_time} - {messData.active_window.end_time})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-semibold">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>
                  Next Service:{' '}
                  <strong className="text-white">
                    {messData?.next_window ? `${messData.next_window.meal_type} (${messData.next_window.start_time})` : 'Scheduled Soon'}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Daily Meal Counts Breakdown (8.5) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { type: 'BREAKFAST', label: 'Breakfast', count: messData?.counts_by_meal?.BREAKFAST || 0, time: '07:30 - 09:30', color: 'sky' },
              { type: 'LUNCH', label: 'Lunch', count: messData?.counts_by_meal?.LUNCH || 0, time: '12:30 - 14:30', color: 'indigo' },
              { type: 'SNACKS', label: 'Snacks', count: messData?.counts_by_meal?.SNACKS || 0, time: '17:00 - 18:30', color: 'amber' },
              { type: 'DINNER', label: 'Dinner', count: messData?.counts_by_meal?.DINNER || 0, time: '20:00 - 22:00', color: 'emerald' },
            ].map((m) => (
              <div
                key={m.type}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow relative overflow-hidden"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
                  <span>{m.label}</span>
                  <Utensils className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="text-3xl font-black text-white my-1">{m.count}</div>
                <div className="text-[11px] text-slate-500 font-mono">{m.time}</div>
              </div>
            ))}
          </div>

          {/* Live Mess Stream (8.4) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Live Meal Claims Stream</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Today's Total: <strong className="text-white">{messData?.counts_by_meal?.TOTAL || 0}</strong> meals
              </span>
            </div>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {liveMessFeed.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No meals scanned yet today. Meal claims will appear here live as students scan at the counter.
                </div>
              ) : (
                liveMessFeed.map((evt: any) => {
                  const timeStr = new Date(evt.scanned_at || evt.scannedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  });

                  return (
                    <div
                      key={evt.id}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-4 text-xs animate-in fade-in duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          <Utensils className="w-4 h-4" />
                        </span>
                        <div>
                          <span className="font-bold text-white text-sm">
                            {evt.student?.user?.name || evt.student?.name}
                          </span>
                          <span className="text-sky-400 ml-2 font-mono">
                            [{evt.student?.roll_number || evt.student?.rollNumber}]
                          </span>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Hostel: <strong>{evt.student?.hostel?.name || 'MANIT Campus'}</strong> • Room:{' '}
                            <strong className="font-mono text-slate-300">
                              {evt.student?.room?.room_number || 'N/A'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-3 py-1 rounded-full font-bold text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {evt.meal_type || evt.mealType}
                        </span>
                        <div className="text-[11px] text-slate-500 font-mono mt-1">{timeStr}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHubPage;
