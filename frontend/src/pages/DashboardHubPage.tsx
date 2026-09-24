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
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  TrendingUp,
  LayoutDashboard,
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
      } else if (['WARDEN', 'VICE_WARDEN', 'CARETAKER'].includes(user?.role || '')) {
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

  // Real-Time Socket.IO Connections
  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (user?.role === 'SUPER_ADMIN') {
        socket.emit('join', 'admin:feed');
      } else if (['WARDEN', 'VICE_WARDEN', 'CARETAKER'].includes(user?.role || '') && selectedHostelId) {
        socket.emit('join', `hostel:${selectedHostelId}`);
      } else if (user?.role === 'MESS_ADMIN' && messData?.mess?.id) {
        socket.emit('join', `mess:${messData.mess.id}`);
      }
    });

    socket.on('attendance:new', (event: any) => {
      setLiveHostelFeed((prev) => [event, ...prev.slice(0, 39)]);

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
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-[#5B6472]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#26415C] mb-3" />
        <p className="text-xs font-medium">Loading operations data...</p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: CARETAKER CONSOLE (Lean Top Tab Row)
  // -------------------------------------------------------------
  if (user?.role === 'CARETAKER') {
    const assignedHostel = wardenData?.hostels?.find((h: any) => h.id === selectedHostelId) || wardenData?.hostels?.[0];
    const currentPanel = wardenData?.occupancy_panels?.find((p: any) => p.hostel_id === (selectedHostelId || assignedHostel?.id)) || wardenData?.occupancy_panels?.[0];

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 mb-6 border-b border-[#E4E1DA]">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C2430] tracking-tight">
              Hostel operations
            </h1>
            <p className="text-xs text-[#5B6472] mt-1">
              Live occupancy counters and entrance log for {assignedHostel ? `${assignedHostel.name} (${assignedHostel.code})` : 'assigned hostel'}
            </p>
          </div>

          {/* Lean Top Tab Row */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 font-medium text-[#1C2430] border-b-2 border-[#26415C]">
              Occupancy and entrance log
            </span>
            <Link
              to="/dashboard/students"
              className="px-3 py-1.5 text-[#5B6472] hover:text-[#1C2430] transition font-normal"
            >
              Student roster and corrections
            </Link>
            <Link
              to="/dashboard/history"
              className="px-3 py-1.5 text-[#5B6472] hover:text-[#1C2430] transition font-normal"
            >
              Audit history
            </Link>
            <button
              onClick={() => { setRefreshing(true); fetchDashboardData(); }}
              disabled={refreshing}
              className="ml-2 text-[#5B6472] hover:text-[#1C2430] p-1.5 rounded transition disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Hostel Selector if staff has multiple hostels */}
        {wardenData?.hostels?.length > 1 && (
          <div className="mb-6 flex items-center gap-2 text-xs">
            <span className="text-[#5B6472]">Select hostel:</span>
            <select
              value={selectedHostelId}
              onChange={(e) => setSelectedHostelId(e.target.value)}
              className="px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C]"
            >
              {wardenData.hostels.map((h: any) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-6">
          {/* Module 1: Current Occupancy Summary Card */}
          {currentPanel && (
            <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4E1DA]">
                <div>
                  <h2 className="font-serif text-lg font-medium text-[#1C2430]">
                    Current occupancy
                  </h2>
                  <p className="text-xs text-[#5B6472] mt-0.5">
                    {currentPanel.name} • {currentPanel.type === 'GIRLS' ? 'Girls hostel' : 'Boys hostel'} • {currentPanel.location}
                  </p>
                </div>
                <div className="text-right text-xs text-[#5B6472]">
                  <span className="tabular-nums font-medium text-[#1C2430]">
                    {currentPanel.inside_count + currentPanel.outside_count}
                  </span>{' '}
                  residents registered
                </div>
              </div>

              {/* 3 Stats Row with Tabular Figures and Sentence Case */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#5B6472]">
                    <span className="w-2 h-2 rounded-full bg-[#2E7D5B]" />
                    <span>Inside hostel</span>
                  </div>
                  <div className="font-serif text-3xl font-normal text-[#1C2430] tabular-nums">
                    {currentPanel.inside_count}
                  </div>
                  <p className="text-[11px] text-[#5B6472]">
                    Currently present within premises
                  </p>
                </div>

                <div className="space-y-1 sm:border-l sm:border-[#E4E1DA] sm:pl-6">
                  <div className="flex items-center gap-1.5 text-xs text-[#5B6472]">
                    <span className="w-2 h-2 rounded-full bg-[#B7791F]" />
                    <span>Outside hostel</span>
                  </div>
                  <div className="font-serif text-3xl font-normal text-[#1C2430] tabular-nums">
                    {currentPanel.outside_count}
                  </div>
                  <p className="text-[11px] text-[#5B6472]">
                    Signed out through gate scanner
                  </p>
                </div>

                <div className="space-y-1 sm:border-l sm:border-[#E4E1DA] sm:pl-6">
                  <div className="flex items-center gap-1.5 text-xs text-[#5B6472]">
                    <span className="w-2 h-2 rounded-full bg-[#E4E1DA]" />
                    <span>Vacant capacity</span>
                  </div>
                  <div className="font-serif text-3xl font-normal text-[#1C2430] tabular-nums">
                    {currentPanel.vacant_beds}
                  </div>
                  <p className="text-[11px] text-[#5B6472]">
                    Available beds of {currentPanel.total_capacity} total
                  </p>
                </div>
              </div>

              {/* Hairline Progress Bar */}
              <div className="mt-6 pt-4 border-t border-[#E4E1DA]">
                <div className="flex justify-between text-xs text-[#5B6472] mb-1.5">
                  <span>Occupancy rate</span>
                  <span className="tabular-nums font-medium text-[#1C2430]">
                    {currentPanel.occupancy_rate}%
                  </span>
                </div>
                <div className="w-full h-1 bg-[#E4E1DA] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2E7D5B] rounded-full transition-all"
                    style={{ width: `${Math.min(100, currentPanel.occupancy_rate)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Module 2: Recent Movements Table */}
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4E1DA]">
              <div>
                <h2 className="font-serif text-lg font-medium text-[#1C2430]">
                  Recent gate movements
                </h2>
                <p className="text-xs text-[#5B6472] mt-0.5">
                  Scans recorded by wall kiosks in real time
                </p>
              </div>
              <span className="text-xs text-[#5B6472] tabular-nums">
                {liveHostelFeed.length} recent events
              </span>
            </div>

            {liveHostelFeed.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#5B6472]">
                No gate movements recorded today for this hostel.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                      <th className="py-2.5 font-medium">Student</th>
                      <th className="py-2.5 font-medium">Roll number</th>
                      <th className="py-2.5 font-medium">Gate</th>
                      <th className="py-2.5 font-medium">Movement</th>
                      <th className="py-2.5 font-medium text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E1DA]">
                    {liveHostelFeed.map((evt: any) => {
                      const isEntry = evt.direction === 'ENTRY';
                      const timeStr = new Date(evt.scanned_at || evt.scannedAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                      });

                      return (
                        <tr key={evt.id} className="hover:bg-[#FAF9F6] transition">
                          <td className="py-2.5 font-medium text-[#1C2430]">
                            {evt.student?.user?.name || evt.studentName || 'Student resident'}
                          </td>
                          <td className="py-2.5 text-[#5B6472] font-mono tabular-nums">
                            {evt.student?.roll_number || evt.rollNumber || '—'}
                          </td>
                          <td className="py-2.5 text-[#5B6472]">
                            {evt.gate?.name || evt.gateName || 'Main gate'}
                          </td>
                          <td className="py-2.5">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: isEntry ? '#2E7D5B' : '#B7791F' }}
                              />
                              <span style={{ color: isEntry ? '#2E7D5B' : '#B7791F' }}>
                                {isEntry ? 'Inside' : 'Outside'}
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-mono text-[#5B6472] tabular-nums">
                            {timeStr}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: WARDEN / VICE WARDEN CONSOLE (Left Navigation Rail)
  // -------------------------------------------------------------
  if (['WARDEN', 'VICE_WARDEN'].includes(user?.role || '')) {
    const assignedHostel = wardenData?.hostels?.find((h: any) => h.id === selectedHostelId) || wardenData?.hostels?.[0];
    const currentPanel = wardenData?.occupancy_panels?.find((p: any) => p.hostel_id === (selectedHostelId || assignedHostel?.id)) || wardenData?.occupancy_panels?.[0];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Navigation Rail */}
          <aside className="w-full md:w-56 shrink-0 space-y-1">
            <div className="pb-3 mb-2 border-b border-[#E4E1DA]">
              <span className="text-[11px] text-[#5B6472] font-medium">
                {user?.role === 'VICE_WARDEN' ? 'Vice Warden console' : 'Hostel Warden console'}
              </span>
            </div>
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-[#1C2430] bg-white border border-[#E4E1DA]"
            >
              <Building2 className="w-4 h-4 text-[#26415C]" strokeWidth={1.5} />
              <span>Hostel occupancy</span>
            </Link>
            <Link
              to="/dashboard/students"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-[#5B6472] hover:text-[#1C2430] hover:bg-white transition"
            >
              <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
              <span>Student directory</span>
            </Link>
            <Link
              to="/dashboard/hostels"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-[#5B6472] hover:text-[#1C2430] hover:bg-white transition"
            >
              <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />
              <span>Rooms & allocations</span>
            </Link>
            <Link
              to="/dashboard/history"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-[#5B6472] hover:text-[#1C2430] hover:bg-white transition"
            >
              <History className="w-4 h-4" strokeWidth={1.5} />
              <span>Audit history</span>
            </Link>
            <Link
              to="/dashboard/analytics"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-[#5B6472] hover:text-[#1C2430] hover:bg-white transition"
            >
              <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
              <span>Analytics & trends</span>
            </Link>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C2430] tracking-tight">
                  Hostel administration
                </h1>
                <p className="text-xs text-[#5B6472] mt-1">
                  Occupancy management and live entrance events for {assignedHostel ? `${assignedHostel.name} (${assignedHostel.code})` : 'assigned hostel'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {wardenData?.hostels?.length > 1 && (
                  <select
                    value={selectedHostelId}
                    onChange={(e) => setSelectedHostelId(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  >
                    {wardenData.hostels.map((h: any) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.code})
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => { setRefreshing(true); fetchDashboardData(); }}
                  disabled={refreshing}
                  className="p-1.5 text-[#5B6472] hover:text-[#1C2430] rounded transition disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Current Occupancy Module */}
            {currentPanel && (
              <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4E1DA]">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-[#1C2430]">
                      Current occupancy
                    </h2>
                    <p className="text-xs text-[#5B6472] mt-0.5">
                      {currentPanel.name} • {currentPanel.type === 'GIRLS' ? 'Girls hostel' : 'Boys hostel'} • {currentPanel.location}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[#5B6472]">
                    <span className="tabular-nums font-medium text-[#1C2430]">
                      {currentPanel.inside_count + currentPanel.outside_count}
                    </span>{' '}
                    residents registered
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-[#5B6472]">
                      <span className="w-2 h-2 rounded-full bg-[#2E7D5B]" />
                      <span>Inside hostel</span>
                    </div>
                    <div className="font-serif text-3xl font-normal text-[#1C2430] tabular-nums">
                      {currentPanel.inside_count}
                    </div>
                    <p className="text-[11px] text-[#5B6472]">
                      Present within hostel premises
                    </p>
                  </div>

                  <div className="space-y-1 sm:border-l sm:border-[#E4E1DA] sm:pl-6">
                    <div className="flex items-center gap-1.5 text-xs text-[#5B6472]">
                      <span className="w-2 h-2 rounded-full bg-[#B7791F]" />
                      <span>Outside hostel</span>
                    </div>
                    <div className="font-serif text-3xl font-normal text-[#1C2430] tabular-nums">
                      {currentPanel.outside_count}
                    </div>
                    <p className="text-[11px] text-[#5B6472]">
                      Currently signed out through gate
                    </p>
                  </div>

                  <div className="space-y-1 sm:border-l sm:border-[#E4E1DA] sm:pl-6">
                    <div className="flex items-center gap-1.5 text-xs text-[#5B6472]">
                      <span className="w-2 h-2 rounded-full bg-[#E4E1DA]" />
                      <span>Vacant capacity</span>
                    </div>
                    <div className="font-serif text-3xl font-normal text-[#1C2430] tabular-nums">
                      {currentPanel.vacant_beds}
                    </div>
                    <p className="text-[11px] text-[#5B6472]">
                      Available beds of {currentPanel.total_capacity} total
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E4E1DA]">
                  <div className="flex justify-between text-xs text-[#5B6472] mb-1.5">
                    <span>Occupancy rate</span>
                    <span className="tabular-nums font-medium text-[#1C2430]">
                      {currentPanel.occupancy_rate}%
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[#E4E1DA] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2E7D5B] rounded-full transition-all"
                      style={{ width: `${Math.min(100, currentPanel.occupancy_rate)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Live Gate Movements Table */}
            <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4E1DA]">
                <div>
                  <h2 className="font-serif text-lg font-medium text-[#1C2430]">
                    Recent gate movements
                  </h2>
                  <p className="text-xs text-[#5B6472] mt-0.5">
                    Live real-time feed for assigned hostel gates
                  </p>
                </div>
                <span className="text-xs text-[#5B6472] tabular-nums">
                  {liveHostelFeed.length} recent events
                </span>
              </div>

              {liveHostelFeed.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#5B6472]">
                  No gate movements recorded today for this hostel.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                        <th className="py-2.5 font-medium">Student</th>
                        <th className="py-2.5 font-medium">Roll number</th>
                        <th className="py-2.5 font-medium">Gate</th>
                        <th className="py-2.5 font-medium">Movement</th>
                        <th className="py-2.5 font-medium text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E1DA]">
                      {liveHostelFeed.map((evt: any) => {
                        const isEntry = evt.direction === 'ENTRY';
                        const timeStr = new Date(evt.scanned_at || evt.scannedAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true,
                        });

                        return (
                          <tr key={evt.id} className="hover:bg-[#FAF9F6] transition">
                            <td className="py-2.5 font-medium text-[#1C2430]">
                              {evt.student?.user?.name || evt.studentName || 'Student resident'}
                            </td>
                            <td className="py-2.5 text-[#5B6472] font-mono tabular-nums">
                              {evt.student?.roll_number || evt.rollNumber || '—'}
                            </td>
                            <td className="py-2.5 text-[#5B6472]">
                              {evt.gate?.name || evt.gateName || 'Main gate'}
                            </td>
                            <td className="py-2.5">
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: isEntry ? '#2E7D5B' : '#B7791F' }}
                                />
                                <span style={{ color: isEntry ? '#2E7D5B' : '#B7791F' }}>
                                  {isEntry ? 'Inside' : 'Outside'}
                                </span>
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-mono text-[#5B6472] tabular-nums">
                              {timeStr}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: SUPER ADMIN CONSOLE (Left Navigation Rail)
  // -------------------------------------------------------------
  if (user?.role === 'SUPER_ADMIN') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Navigation Rail */}
          <aside className="w-full md:w-56 shrink-0 space-y-1">
            <div className="pb-3 mb-2 border-b border-[#E4E1DA]">
              <span className="text-[11px] text-[#5B6472] font-medium">
                Council of Wardens office
              </span>
            </div>
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-[#1C2430] bg-white border border-[#E4E1DA]"
            >
              <LayoutDashboard className="w-4 h-4 text-[#26415C]" strokeWidth={1.5} />
              <span>Campus overview</span>
            </Link>
            <Link
              to="/dashboard/hostels"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-[#5B6472] hover:text-[#1C2430] hover:bg-white transition"
            >
              <Building2 className="w-4 h-4" strokeWidth={1.5} />
              <span>Hostels & rooms</span>
            </Link>
            <Link
              to="/dashboard/students"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-[#5B6472] hover:text-[#1C2430] hover:bg-white transition"
            >
              <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
              <span>Student registry</span>
            </Link>
            <Link
              to="/dashboard/messes"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-[#5B6472] hover:text-[#1C2430] hover:bg-white transition"
            >
              <Utensils className="w-4 h-4" strokeWidth={1.5} />
              <span>Dining halls</span>
            </Link>
            <Link
              to="/dashboard/devices"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-[#5B6472] hover:text-[#1C2430] hover:bg-white transition"
            >
              <Laptop className="w-4 h-4" strokeWidth={1.5} />
              <span>Hardware kiosks</span>
            </Link>
            <Link
              to="/dashboard/history"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-[#5B6472] hover:text-[#1C2430] hover:bg-white transition"
            >
              <History className="w-4 h-4" strokeWidth={1.5} />
              <span>Audit history</span>
            </Link>
            <Link
              to="/dashboard/analytics"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-[#5B6472] hover:text-[#1C2430] hover:bg-white transition"
            >
              <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
              <span>Analytics & trends</span>
            </Link>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C2430] tracking-tight">
                  Council of Wardens office
                </h1>
                <p className="text-xs text-[#5B6472] mt-1">
                  Campus-wide residential, dining, and terminal operations across 12 MANIT hostels
                </p>
              </div>

              <button
                onClick={() => { setRefreshing(true); fetchDashboardData(); }}
                disabled={refreshing}
                className="p-1.5 text-[#5B6472] hover:text-[#1C2430] rounded transition disabled:opacity-50"
                title="Refresh live data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* High-Level Institutional KPI Cards */}
            {adminData?.metrics && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E4E1DA] rounded-lg p-5">
                  <div className="flex items-center justify-between text-xs text-[#5B6472] mb-1">
                    <span>MANIT hostels</span>
                    <Building2 className="w-4 h-4 text-[#26415C]" strokeWidth={1.5} />
                  </div>
                  <div className="font-serif text-2xl sm:text-3xl font-normal text-[#1C2430] tabular-nums">
                    {adminData.metrics.hostels_count}
                  </div>
                  <p className="text-[11px] text-[#5B6472] mt-1">
                    {adminData.metrics.rooms_count} rooms • {adminData.metrics.total_capacity} beds
                  </p>
                </div>

                <div className="bg-white border border-[#E4E1DA] rounded-lg p-5">
                  <div className="flex items-center justify-between text-xs text-[#5B6472] mb-1">
                    <span>Campus occupancy</span>
                    <span className="w-2 h-2 rounded-full bg-[#2E7D5B]" />
                  </div>
                  <div className="font-serif text-2xl sm:text-3xl font-normal text-[#1C2430] tabular-nums">
                    {adminData.metrics.campus_occupancy_rate}%
                  </div>
                  <p className="text-[11px] text-[#5B6472] mt-1">
                    <span className="tabular-nums font-medium text-[#1C2430]">{adminData.metrics.inside_count}</span> inside •{' '}
                    <span className="tabular-nums font-medium text-[#1C2430]">{adminData.metrics.outside_count}</span> outside
                  </p>
                </div>

                <div className="bg-white border border-[#E4E1DA] rounded-lg p-5">
                  <div className="flex items-center justify-between text-xs text-[#5B6472] mb-1">
                    <span>Today's gate scans</span>
                    <span className="w-2 h-2 rounded-full bg-[#B7791F]" />
                  </div>
                  <div className="font-serif text-2xl sm:text-3xl font-normal text-[#1C2430] tabular-nums">
                    {adminData.metrics.today_hostel_scans}
                  </div>
                  <p className="text-[11px] text-[#5B6472] mt-1">
                    {adminData.metrics.students_count} registered students
                  </p>
                </div>

                <div className="bg-white border border-[#E4E1DA] rounded-lg p-5">
                  <div className="flex items-center justify-between text-xs text-[#5B6472] mb-1">
                    <span>Hardware terminals</span>
                    <Laptop className="w-4 h-4 text-[#26415C]" strokeWidth={1.5} />
                  </div>
                  <div className="font-serif text-2xl sm:text-3xl font-normal text-[#1C2430] tabular-nums">
                    {adminData.metrics.active_devices_count} / {adminData.metrics.devices_count}
                  </div>
                  <p className="text-[11px] text-[#2E7D5B] mt-1">
                    Synchronized and active
                  </p>
                </div>
              </div>
            )}

            {/* System Status and Global Activity Feed */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Terminal & Alert Status */}
              <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
                  <h2 className="font-serif text-base font-medium text-[#1C2430]">
                    System status
                  </h2>
                  <AlertTriangle className="w-4 h-4 text-[#5B6472]" strokeWidth={1.5} />
                </div>

                {adminData?.alerts?.inactive_devices?.length > 0 ? (
                  <div className="space-y-2">
                    {adminData.alerts.inactive_devices.map((dev: any) => (
                      <div
                        key={dev.id}
                        className="p-3 rounded bg-[#B3432B]/5 border border-[#B3432B]/20 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-[#1C2430]">{dev.device_name}</div>
                          <div className="text-[11px] text-[#B3432B]">Terminal offline</div>
                        </div>
                        <Link to="/dashboard/devices" className="text-xs text-[#26415C] hover:underline">
                          View
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded bg-[#2E7D5B]/5 border border-[#2E7D5B]/20 text-[#2E7D5B] text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <span>All registered hardware kiosk terminals are online and rotating tokens.</span>
                  </div>
                )}

                <div className="p-3 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-xs text-[#5B6472]">
                  <div className="flex justify-between text-[#1C2430] font-medium mb-1">
                    <span>Scan anomalies (24h)</span>
                    <span className="tabular-nums font-mono">{adminData?.alerts?.failed_scans_24h || 0}</span>
                  </div>
                  <p className="text-[11px] text-[#5B6472]">
                    Expired tokens or unauthorized hostel boundary scans rejected atomically.
                  </p>
                </div>
              </div>

              {/* Global Real-Time Activity Feed */}
              <div className="lg:col-span-2 bg-white border border-[#E4E1DA] rounded-lg p-6">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4E1DA]">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-[#1C2430]">
                      Global campus activity
                    </h2>
                    <p className="text-xs text-[#5B6472] mt-0.5">
                      Real-time gate movements across all 12 MANIT hostels
                    </p>
                  </div>
                  <Link
                    to="/dashboard/history"
                    className="text-xs text-[#26415C] hover:underline font-medium"
                  >
                    View audit log
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                        <th className="py-2.5 font-medium">Student</th>
                        <th className="py-2.5 font-medium">Roll number</th>
                        <th className="py-2.5 font-medium">Hostel / Gate</th>
                        <th className="py-2.5 font-medium">Movement</th>
                        <th className="py-2.5 font-medium text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E1DA]">
                      {liveHostelFeed.slice(0, 10).map((evt: any) => {
                        const isEntry = evt.direction === 'ENTRY';
                        const timeStr = new Date(evt.scanned_at || evt.scannedAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true,
                        });

                        return (
                          <tr key={evt.id} className="hover:bg-[#FAF9F6] transition">
                            <td className="py-2.5 font-medium text-[#1C2430]">
                              {evt.student?.user?.name || evt.studentName || 'Student resident'}
                            </td>
                            <td className="py-2.5 text-[#5B6472] font-mono tabular-nums">
                              {evt.student?.roll_number || evt.rollNumber || '—'}
                            </td>
                            <td className="py-2.5 text-[#5B6472]">
                              {evt.hostel?.code || evt.hostelCode || 'Campus'} • {evt.gate?.name || evt.gateName || 'Gate'}
                            </td>
                            <td className="py-2.5">
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: isEntry ? '#2E7D5B' : '#B7791F' }}
                                />
                                <span style={{ color: isEntry ? '#2E7D5B' : '#B7791F' }}>
                                  {isEntry ? 'Inside' : 'Outside'}
                                </span>
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-mono text-[#5B6472] tabular-nums">
                              {timeStr}
                            </td>
                          </tr>
                        );
                      })}
                      {liveHostelFeed.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-[#5B6472]">
                            No campus gate movements recorded yet today.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 4: MESS ADMIN CONSOLE (Lean Top Tab Row)
  // -------------------------------------------------------------
  if (user?.role === 'MESS_ADMIN') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 mb-6 border-b border-[#E4E1DA]">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C2430] tracking-tight">
              Dining operations
            </h1>
            <p className="text-xs text-[#5B6472] mt-1">
              {messData?.mess?.name || 'MANIT Campus Mess'} • Live meal attendance stream
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 font-medium text-[#1C2430] border-b-2 border-[#26415C]">
              Meal attendance
            </span>
            <Link
              to="/dashboard/messes"
              className="px-3 py-1.5 text-[#5B6472] hover:text-[#1C2430] transition font-normal"
            >
              Meal schedules
            </Link>
            <Link
              to="/dashboard/history"
              className="px-3 py-1.5 text-[#5B6472] hover:text-[#1C2430] transition font-normal"
            >
              Audit history
            </Link>
            <button
              onClick={() => { setRefreshing(true); fetchDashboardData(); }}
              disabled={refreshing}
              className="ml-2 text-[#5B6472] hover:text-[#1C2430] p-1.5 rounded transition disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Meal Service Window Status */}
        <div className="mb-6 p-4 rounded-lg bg-white border border-[#E4E1DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#1C2430]">
            <Clock className="w-4 h-4 text-[#26415C]" strokeWidth={1.5} />
            {messData?.active_window ? (
              <span>
                Active service:{' '}
                <strong className="font-medium text-[#1C2430]">
                  {messData.active_window.meal_type}
                </strong>{' '}
                ({messData.active_window.start_time} - {messData.active_window.end_time})
              </span>
            ) : (
              <span>
                Next scheduled service:{' '}
                <strong className="font-medium text-[#1C2430]">
                  {messData?.next_window ? `${messData.next_window.meal_type} (${messData.next_window.start_time})` : 'Scheduled soon'}
                </strong>
              </span>
            )}
          </div>
          <span className="text-[#5B6472] tabular-nums">
            Total meals served today:{' '}
            <strong className="font-medium text-[#1C2430]">
              {messData?.counts_by_meal?.TOTAL || 0}
            </strong>
          </span>
        </div>

        {/* Daily Meal Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { type: 'BREAKFAST', label: 'Breakfast', count: messData?.counts_by_meal?.BREAKFAST || 0, time: '07:30 - 09:30' },
            { type: 'LUNCH', label: 'Lunch', count: messData?.counts_by_meal?.LUNCH || 0, time: '12:30 - 14:30' },
            { type: 'SNACKS', label: 'Snacks', count: messData?.counts_by_meal?.SNACKS || 0, time: '17:00 - 18:30' },
            { type: 'DINNER', label: 'Dinner', count: messData?.counts_by_meal?.DINNER || 0, time: '20:00 - 22:00' },
          ].map((m) => (
            <div key={m.type} className="bg-white border border-[#E4E1DA] rounded-lg p-5">
              <div className="text-xs text-[#5B6472] mb-1">{m.label}</div>
              <div className="font-serif text-3xl font-normal text-[#1C2430] tabular-nums mb-1">
                {m.count}
              </div>
              <div className="text-[11px] text-[#5B6472] font-mono">{m.time}</div>
            </div>
          ))}
        </div>

        {/* Live Meal Claims Stream */}
        <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4E1DA]">
            <div>
              <h2 className="font-serif text-lg font-medium text-[#1C2430]">
                Live meal claims
              </h2>
              <p className="text-xs text-[#5B6472] mt-0.5">
                Real-time scans logged at dining counter kiosks
              </p>
            </div>
            <span className="text-xs text-[#5B6472] tabular-nums">
              {liveMessFeed.length} recent claims
            </span>
          </div>

          {liveMessFeed.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#5B6472]">
              No meal scans recorded yet today. Scans will stream here in real time.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                    <th className="py-2.5 font-medium">Student</th>
                    <th className="py-2.5 font-medium">Roll number</th>
                    <th className="py-2.5 font-medium">Hostel / Room</th>
                    <th className="py-2.5 font-medium">Meal</th>
                    <th className="py-2.5 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E1DA]">
                  {liveMessFeed.map((evt: any) => {
                    const timeStr = new Date(evt.scanned_at || evt.scannedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                    });

                    return (
                      <tr key={evt.id} className="hover:bg-[#FAF9F6] transition">
                        <td className="py-2.5 font-medium text-[#1C2430]">
                          {evt.student?.user?.name || evt.student?.name || 'Student resident'}
                        </td>
                        <td className="py-2.5 text-[#5B6472] font-mono tabular-nums">
                          {evt.student?.roll_number || evt.student?.rollNumber || '—'}
                        </td>
                        <td className="py-2.5 text-[#5B6472]">
                          {evt.student?.hostel?.name || 'Hostel'} • Room {evt.student?.room?.room_number || '—'}
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#1C2430] font-medium text-[11px]">
                            {evt.meal_type || evt.mealType}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-[#5B6472] tabular-nums">
                          {timeStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default DashboardHubPage;
