import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import {
  History,
  Search,
  Download,
  Building,
  Utensils,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  scanned_at: string;
  direction?: 'ENTRY' | 'EXIT';
  meal_type?: string;
  gate?: {
    id: string;
    name: string;
  };
  hostel?: {
    id: string;
    code: string;
    name: string;
  };
  mess?: {
    id: string;
    name: string;
  };
  student: {
    id: string;
    roll_number: string;
    user: {
      name: string;
      email: string;
    };
    room?: {
      room_number: string;
    };
    hostel?: {
      code: string;
      name: string;
    };
  };
}

export const AttendanceHistoryPage: React.FC = () => {
  const [activeType, setActiveType] = useState<'HOSTEL' | 'MESS'>('HOSTEL');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [directionFilter, setDirectionFilter] = useState<string>('');
  const [mealTypeFilter, setMealTypeFilter] = useState<string>('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        type: activeType,
        page,
        limit: 15,
      };

      if (search.trim()) params.search = search.trim();
      if (activeType === 'HOSTEL' && directionFilter) params.direction = directionFilter;
      if (activeType === 'MESS' && mealTypeFilter) params.meal_type = mealTypeFilter;

      const res = await api.get('/dashboard/history', { params });
      setRecords(res.data.records || []);
      setTotalPages(res.data.total_pages || 1);
      setTotalCount(res.data.total || 0);
    } catch (err: any) {
      console.error('Error fetching attendance history:', err);
    } finally {
      setLoading(false);
    }
  }, [activeType, page, search, directionFilter, mealTypeFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchHistory();
  };

  const handleExportCSV = () => {
    if (records.length === 0) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (activeType === 'HOSTEL') {
      headers = ['Timestamp', 'Student Name', 'Roll Number', 'Hostel', 'Room', 'Gate', 'Direction'];
      rows = records.map((r) => [
        new Date(r.scanned_at).toISOString(),
        r.student?.user?.name || '',
        r.student?.roll_number || '',
        r.hostel?.name || '',
        r.student?.room?.room_number || '',
        r.gate?.name || '',
        r.direction || '',
      ]);
    } else {
      headers = ['Timestamp', 'Student Name', 'Roll Number', 'Hostel', 'Room', 'Mess', 'Meal Type'];
      rows = records.map((r) => [
        new Date(r.scanned_at).toISOString(),
        r.student?.user?.name || '',
        r.student?.roll_number || '',
        r.student?.hostel?.name || '',
        r.student?.room?.room_number || '',
        r.mess?.name || '',
        r.meal_type || '',
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hostel360_${activeType.toLowerCase()}_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Attendance Audit History
              </h1>
              <p className="text-xs text-slate-400">
                Official institutional logs for campus movements and mess attendance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => fetchHistory()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Type Toggle Tabs */}
      <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-3">
        <button
          onClick={() => {
            setActiveType('HOSTEL');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
            activeType === 'HOSTEL'
              ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Hostel Gate Movements</span>
        </button>

        <button
          onClick={() => {
            setActiveType('MESS');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
            activeType === 'MESS'
              ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Mess Meal Attendance</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full md:max-w-md relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search student name or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {activeType === 'HOSTEL' ? (
            <select
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="">All Directions (ENTRY & EXIT)</option>
              <option value="ENTRY">ENTRY Only</option>
              <option value="EXIT">EXIT Only</option>
            </select>
          ) : (
            <select
              value={mealTypeFilter}
              onChange={(e) => {
                setMealTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="">All Meals</option>
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="SNACKS">Snacks</option>
              <option value="DINNER">Dinner</option>
            </select>
          )}

          <div className="text-xs text-slate-400 font-mono">
            Showing {records.length} of {totalCount} records
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-500 mx-auto mb-3" />
            <p className="text-sm">Loading attendance records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Attendance Records Found</h3>
            <p className="text-xs text-slate-500">
              Try adjusting your search criteria or date filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Roll Number</th>
                  <th className="px-6 py-4">Hostel / Room</th>
                  <th className="px-6 py-4">{activeType === 'HOSTEL' ? 'Gate' : 'Mess'}</th>
                  <th className="px-6 py-4">{activeType === 'HOSTEL' ? 'Direction' : 'Meal'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {records.map((r) => {
                  const dateObj = new Date(r.scanned_at);
                  const isEntry = r.direction === 'ENTRY';

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-mono text-xs text-slate-200">
                          {dateObj.toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                          })}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {dateObj.toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-white flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{r.student?.user?.name || 'Unknown Student'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{r.student?.user?.email}</div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-md border border-sky-500/20">
                          {r.student?.roll_number}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-slate-300 font-medium text-xs">
                          {r.hostel?.name || r.student?.hostel?.name || 'Hostel Campus'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Room: <strong className="font-mono text-slate-300">{r.student?.room?.room_number || 'N/A'}</strong>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-slate-300 text-xs">
                          {activeType === 'HOSTEL' ? r.gate?.name || 'Main Gate' : r.mess?.name || 'Campus Mess'}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {activeType === 'HOSTEL' ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              isEntry
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {isEntry ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                            <span>{r.direction}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Utensils className="w-3.5 h-3.5" />
                            <span>{r.meal_type}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <div>
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceHistoryPage;
