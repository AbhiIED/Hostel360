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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E4E1DA]">
        <div>
          <div className="flex items-center gap-2 text-[#5B6472] text-xs font-medium mb-1">
            <History className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Access logs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C2430] tracking-tight">
            Attendance audit history
          </h1>
          <p className="text-xs text-[#5B6472] mt-1">
            Official institutional logs for campus movements and mess attendance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-white hover:bg-[#FAF9F6] text-[#1C2430] border border-[#E4E1DA] text-xs font-medium transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => fetchHistory()}
            disabled={loading}
            className="p-2 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Type Toggle Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-[#E4E1DA] pb-3">
        <button
          onClick={() => {
            setActiveType('HOSTEL');
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium transition ${
            activeType === 'HOSTEL'
              ? 'bg-[#FAF9F6] text-[#1C2430] border border-[#E4E1DA]'
              : 'text-[#5B6472] hover:text-[#1C2430] hover:bg-[#FAF9F6]'
          }`}
        >
          <Building className="w-3.5 h-3.5 text-[#26415C]" />
          <span>Hostel gate movements</span>
        </button>

        <button
          onClick={() => {
            setActiveType('MESS');
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium transition ${
            activeType === 'MESS'
              ? 'bg-[#FAF9F6] text-[#1C2430] border border-[#E4E1DA]'
              : 'text-[#5B6472] hover:text-[#1C2430] hover:bg-[#FAF9F6]'
          }`}
        >
          <Utensils className="w-3.5 h-3.5 text-[#26415C]" />
          <span>Mess meal attendance</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E4E1DA] rounded-lg p-3.5 mb-6 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full md:max-w-md relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#5B6472]" />
          <input
            type="text"
            placeholder="Search student name or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#8C93A0] focus:outline-none focus:border-[#26415C]"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {activeType === 'HOSTEL' ? (
            <select
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C]"
            >
              <option value="">All directions (Entry & Exit)</option>
              <option value="ENTRY">Entry only</option>
              <option value="EXIT">Exit only</option>
            </select>
          ) : (
            <select
              value={mealTypeFilter}
              onChange={(e) => {
                setMealTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C]"
            >
              <option value="">All meals</option>
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="SNACKS">Snacks</option>
              <option value="DINNER">Dinner</option>
            </select>
          )}

          <div className="text-xs text-[#5B6472]">
            Showing {records.length} of {totalCount} records
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white border border-[#E4E1DA] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-[#5B6472]">
            <RefreshCw className="w-6 h-6 animate-spin text-[#26415C] mx-auto mb-2" />
            <p className="text-xs">Loading attendance records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 text-center text-[#5B6472]">
            <History className="w-10 h-10 text-[#5B6472] mx-auto mb-2" strokeWidth={1.5} />
            <h3 className="text-sm font-medium text-[#1C2430] mb-1">No attendance records found</h3>
            <p className="text-xs text-[#5B6472]">
              Try adjusting your search criteria or date filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6] text-[#5B6472] font-medium">
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Roll number</th>
                  <th className="px-4 py-2.5">Hostel / Room</th>
                  <th className="px-4 py-2.5">{activeType === 'HOSTEL' ? 'Gate' : 'Mess'}</th>
                  <th className="px-4 py-2.5">{activeType === 'HOSTEL' ? 'Direction' : 'Meal'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E1DA]">
                {records.map((r) => {
                  const dateObj = new Date(r.scanned_at);
                  const isEntry = r.direction === 'ENTRY';

                  return (
                    <tr key={r.id} className="hover:bg-[#FAF9F6] transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-xs text-[#1C2430]">
                          {dateObj.toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                          })}
                        </div>
                        <div className="text-[11px] text-[#5B6472]">
                          {dateObj.toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-[#1C2430] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#5B6472]" />
                          <span>{r.student?.user?.name || 'Unknown student'}</span>
                        </div>
                        <div className="text-[11px] text-[#5B6472]">{r.student?.user?.email}</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-[#26415C] bg-[#FAF9F6] px-2 py-0.5 rounded border border-[#E4E1DA]">
                          {r.student?.roll_number}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-[#1C2430] text-xs">
                          {r.hostel?.name || r.student?.hostel?.name || 'Hostel campus'}
                        </div>
                        <div className="text-[11px] text-[#5B6472]">
                          Room: <span className="font-mono text-[#1C2430]">{r.student?.room?.room_number || 'N/A'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[#1C2430] text-xs">
                          {activeType === 'HOSTEL' ? r.gate?.name || 'Main Gate' : r.mess?.name || 'Campus Mess'}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {activeType === 'HOSTEL' ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                              isEntry
                                ? 'bg-[#2E7D5B]/10 text-[#2E7D5B] border-[#2E7D5B]/30'
                                : 'bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/30'
                            }`}
                          >
                            {isEntry ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                            <span>{isEntry ? 'Entry' : 'Exit'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#26415C]/10 text-[#26415C] border border-[#26415C]/30">
                            <Utensils className="w-3 h-3" />
                            <span>
                              {r.meal_type
                                ? r.meal_type.charAt(0) + r.meal_type.slice(1).toLowerCase()
                                : ''}
                            </span>
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
        <div className="px-4 py-3 border-t border-[#E4E1DA] bg-[#FAF9F6] flex items-center justify-between text-xs text-[#5B6472]">
          <div>
            Page <strong className="text-[#1C2430]">{page}</strong> of{' '}
            <strong className="text-[#1C2430]">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] disabled:opacity-40 transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceHistoryPage;

