import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  Download,
  Building,
  Utensils,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Users,
  ChevronDown,
} from 'lucide-react';

interface OccupancyTimelinePoint {
  date: string;
  displayDate: string;
  entries: number;
  exits: number;
  netFlow: number;
}

interface HourlyPeakPoint {
  hour: string;
  entries: number;
  exits: number;
}

interface OccupancyAnalyticsResponse {
  hostel: { id: string; name: string; code: string; total_capacity: number } | null;
  rangeDays: number;
  summary: {
    totalEntries: number;
    totalExits: number;
    avgDailyEntries: number;
  };
  timeline: OccupancyTimelinePoint[];
  hourlyPeaks: HourlyPeakPoint[];
}

interface MealTimelinePoint {
  date: string;
  displayDate: string;
  BREAKFAST: number;
  LUNCH: number;
  SNACKS: number;
  DINNER: number;
  total: number;
}

interface MealAnalyticsResponse {
  mess: { id: string; name: string } | null;
  rangeDays: number;
  summary: {
    totalMealsServed: number;
    mealTypeCounts: {
      BREAKFAST: number;
      LUNCH: number;
      SNACKS: number;
      DINNER: number;
    };
    avgMealsPerDay: number;
  };
  timeline: MealTimelinePoint[];
}

export const AnalyticsReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'occupancy' | 'meals' | 'exports'>('occupancy');
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<string | null>(null);

  // Filter selections
  const [hostelList, setHostelList] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [messList, setMessList] = useState<{ id: string; name: string }[]>([]);
  const [selectedMessId, setSelectedMessId] = useState<string>('');

  // Analytics data
  const [occupancyData, setOccupancyData] = useState<OccupancyAnalyticsResponse | null>(null);
  const [mealData, setMealData] = useState<MealAnalyticsResponse | null>(null);

  // Hover states for chart tooltips
  const [hoveredOccIndex, setHoveredOccIndex] = useState<number | null>(null);
  const [hoveredMealIndex, setHoveredMealIndex] = useState<number | null>(null);

  // Initial metadata fetch (hostels and messes)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        if (['SUPER_ADMIN', 'WARDEN'].includes(user?.role || '')) {
          const res = await api.get('/hostels');
          const list = res.data.hostels || [];
          setHostelList(list);
          if (list.length > 0 && !selectedHostelId) {
            setSelectedHostelId(list[0].id);
          }
        }
        if (['SUPER_ADMIN', 'MESS_ADMIN'].includes(user?.role || '')) {
          const res = await api.get('/messes');
          const list = res.data.messes || [];
          setMessList(list);
          if (list.length > 0 && !selectedMessId) {
            setSelectedMessId(list[0].id);
          }
        }
      } catch (err) {
        console.warn('Metadata fetch error in analytics:', err);
      }
    };
    fetchMetadata();
  }, [user?.role, selectedHostelId, selectedMessId]);

  // Fetch occupancy analytics
  const fetchOccupancyAnalytics = useCallback(async () => {
    if (activeTab !== 'occupancy' && activeTab !== 'exports') return;
    try {
      setLoading(true);
      const params: any = { days: rangeDays };
      if (selectedHostelId) params.hostel_id = selectedHostelId;
      const res = await api.get('/analytics/occupancy-history', { params });
      setOccupancyData(res.data);
    } catch (err) {
      console.error('Fetch occupancy analytics failed:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, rangeDays, selectedHostelId]);

  // Fetch meal analytics
  const fetchMealAnalytics = useCallback(async () => {
    if (activeTab !== 'meals' && activeTab !== 'exports') return;
    try {
      setLoading(true);
      const params: any = { days: rangeDays };
      if (selectedMessId) params.mess_id = selectedMessId;
      const res = await api.get('/analytics/meal-trends', { params });
      setMealData(res.data);
    } catch (err) {
      console.error('Fetch meal analytics failed:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, rangeDays, selectedMessId]);

  useEffect(() => {
    if (activeTab === 'occupancy') {
      fetchOccupancyAnalytics();
    } else if (activeTab === 'meals') {
      fetchMealAnalytics();
    }
  }, [activeTab, fetchOccupancyAnalytics, fetchMealAnalytics]);

  // Direct CSV Export trigger
  const handleExport = async (type: 'hostel_attendance' | 'mess_attendance') => {
    try {
      setExporting(type);
      const params: any = { type, days: rangeDays };
      if (type === 'hostel_attendance' && selectedHostelId) params.hostel_id = selectedHostelId;
      if (type === 'mess_attendance' && selectedMessId) params.mess_id = selectedMessId;

      const res = await api.get('/analytics/export', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `hostel360_${type}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export download failed:', err);
      alert('Failed to generate export file. Please check permissions and try again.');
    } finally {
      setExporting(null);
    }
  };

  // Helper for occupancy max value in SVG
  const occMaxVal = occupancyData?.timeline
    ? Math.max(10, ...occupancyData.timeline.map((d) => Math.max(d.entries, d.exits)))
    : 10;

  // Helper for meal max value in SVG
  const mealMaxVal = mealData?.timeline
    ? Math.max(10, ...mealData.timeline.map((d) => d.total))
    : 10;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 text-sky-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Analytics & Intelligence Hub
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Real-time occupancy flows, peak traffic hours, mess consumption curves, and operational audit reports.
          </p>
        </div>

        {/* Action Bar: Range Picker & Instant Export */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Range Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  rangeDays === days
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>

          {/* Quick CSV Export */}
          <button
            onClick={() => handleExport(activeTab === 'meals' ? 'mess_attendance' : 'hostel_attendance')}
            disabled={!!exporting}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white transition disabled:opacity-50"
            title="Download CSV report for current view"
          >
            {exporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        {['SUPER_ADMIN', 'WARDEN'].includes(user?.role || '') && (
          <button
            onClick={() => setActiveTab('occupancy')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
              activeTab === 'occupancy'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Hostel Occupancy & Traffic (10.4)</span>
          </button>
        )}

        {['SUPER_ADMIN', 'MESS_ADMIN'].includes(user?.role || '') && (
          <button
            onClick={() => setActiveTab('meals')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
              activeTab === 'meals'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Mess Turnout & Meals (10.5)</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('exports')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
            activeTab === 'exports'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Report Downloads (10.6)</span>
        </button>
      </div>

      {/* TAB 1: HOSTEL OCCUPANCY ANALYTICS (10.4) */}
      {activeTab === 'occupancy' && (
        <div className="space-y-6">
          {/* Hostel Selector (Super Admin or Warden with multi hostels) */}
          {hostelList.length > 1 && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" />
                Select Hostel:
              </label>
              <div className="relative">
                <select
                  value={selectedHostelId}
                  onChange={(e) => setSelectedHostelId(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-3 py-1.5 pr-8 appearance-none focus:outline-none focus:border-sky-500 font-medium"
                >
                  {user?.role === 'SUPER_ADMIN' && <option value="">All Hostels (Campus-wide)</option>}
                  {hostelList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.code} — {h.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total Gate Entries
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white">
                {occupancyData?.summary.totalEntries.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Avg. {occupancyData?.summary.avgDailyEntries ?? 0} check-ins per day
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total Gate Exits
                </span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white">
                {occupancyData?.summary.totalExits.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Turnout over past {rangeDays} days
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Net Campus Flow
                </span>
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-sky-400">
                {(occupancyData?.summary.totalEntries ?? 0) - (occupancyData?.summary.totalExits ?? 0) > 0 ? '+' : ''}
                {(occupancyData?.summary.totalEntries ?? 0) - (occupancyData?.summary.totalExits ?? 0)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Net ingress during observation period
              </p>
            </div>
          </div>

          {/* Interactive SVG Chart: Daily Entry vs Exit Footfall */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-white text-base">
                  Daily Gate Ingress & Egress Footfall
                </h3>
                <p className="text-xs text-slate-400">
                  Interactive timeline of authenticated entries vs exits. Hover columns to inspect figures.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-slate-300">Entries</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span className="text-slate-300">Exits</span>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-400 mb-2" />
                Calculating occupancy curves...
              </div>
            ) : !occupancyData?.timeline || occupancyData.timeline.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
                No attendance logs found in this date window.
              </div>
            ) : (
              <div className="relative pt-4 pb-2">
                {/* SVG Visualizer */}
                <svg
                  className="w-full h-64 overflow-visible"
                  viewBox={`0 0 ${occupancyData.timeline.length * 70} 200`}
                  preserveAspectRatio="none"
                >
                  {/* Grid Lines */}
                  {[0, 50, 100, 150].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2={occupancyData.timeline.length * 70}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Columns */}
                  {occupancyData.timeline.map((pt, idx) => {
                    const colX = idx * 70 + 20;
                    const entryHeight = (pt.entries / occMaxVal) * 150;
                    const exitHeight = (pt.exits / occMaxVal) * 150;

                    return (
                      <g
                        key={pt.date}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredOccIndex(idx)}
                        onMouseLeave={() => setHoveredOccIndex(null)}
                      >
                        {/* Hover Column highlight */}
                        {hoveredOccIndex === idx && (
                          <rect
                            x={colX - 8}
                            y="0"
                            width="50"
                            height="180"
                            fill="#38bdf8"
                            fillOpacity="0.08"
                            rx="6"
                          />
                        )}

                        {/* Entry Bar */}
                        <rect
                          x={colX}
                          y={170 - entryHeight}
                          width="14"
                          height={Math.max(2, entryHeight)}
                          rx="3"
                          fill="#10b981"
                          className="transition-all duration-300"
                        />

                        {/* Exit Bar */}
                        <rect
                          x={colX + 18}
                          y={170 - exitHeight}
                          width="14"
                          height={Math.max(2, exitHeight)}
                          rx="3"
                          fill="#f59e0b"
                          className="transition-all duration-300"
                        />

                        {/* X-axis date label */}
                        <text
                          x={colX + 16}
                          y="190"
                          textAnchor="middle"
                          className="text-[10px] fill-slate-400 font-mono"
                        >
                          {pt.displayDate}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Tooltip Overlay */}
                {hoveredOccIndex !== null && occupancyData.timeline[hoveredOccIndex] && (
                  <div className="mt-3 p-3 bg-slate-950 border border-slate-700/80 rounded-xl flex items-center justify-between text-xs max-w-sm mx-auto shadow-2xl">
                    <span className="font-bold text-white">
                      {occupancyData.timeline[hoveredOccIndex].displayDate}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      +{occupancyData.timeline[hoveredOccIndex].entries} In
                    </span>
                    <span className="text-amber-400 font-bold">
                      -{occupancyData.timeline[hoveredOccIndex].exits} Out
                    </span>
                    <span className="text-sky-400 font-semibold">
                      Net: {occupancyData.timeline[hoveredOccIndex].netFlow}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 24-Hour Peak Ingress / Egress Distribution */}
          {occupancyData?.hourlyPeaks && (
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">
                  Peak Traffic Hours (24-Hour Gate Heatmap)
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Aggregated distribution of entries & exits across 24 hours of the day to identify curfew and class-rush hours.
              </p>

              <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-2">
                {occupancyData.hourlyPeaks.map((hp) => {
                  const totalHour = hp.entries + hp.exits;
                  const intensity = Math.min(1, totalHour / 20);
                  return (
                    <div
                      key={hp.hour}
                      className="p-2 rounded-xl border border-slate-800 bg-slate-950/60 text-center flex flex-col justify-between"
                      style={{
                        backgroundColor:
                          totalHour > 0
                            ? `rgba(56, 189, 248, ${Math.max(0.08, intensity * 0.35)})`
                            : undefined,
                      }}
                      title={`${hp.hour}: ${hp.entries} In, ${hp.exits} Out`}
                    >
                      <span className="text-[10px] font-mono text-slate-400">{hp.hour}</span>
                      <span className="text-xs font-bold text-white my-1">{totalHour}</span>
                      <span className="text-[9px] text-slate-400">
                        {hp.entries}↑ {hp.exits}↓
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MESS TURNOUT & CONSUMPTION (10.5) */}
      {activeTab === 'meals' && (
        <div className="space-y-6">
          {/* Mess Selector */}
          {messList.length > 1 && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5" />
                Select Mess:
              </label>
              <div className="relative">
                <select
                  value={selectedMessId}
                  onChange={(e) => setSelectedMessId(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-3 py-1.5 pr-8 appearance-none focus:outline-none focus:border-emerald-500 font-medium"
                >
                  {user?.role === 'SUPER_ADMIN' && <option value="">All Mess Counters</option>}
                  {messList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                Breakfast
              </span>
              <div className="text-2xl font-black text-white">
                {mealData?.summary.mealTypeCounts.BREAKFAST.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Meals served</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                Lunch
              </span>
              <div className="text-2xl font-black text-white">
                {mealData?.summary.mealTypeCounts.LUNCH.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Meals served</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider block mb-1">
                Evening Snacks
              </span>
              <div className="text-2xl font-black text-white">
                {mealData?.summary.mealTypeCounts.SNACKS.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Meals served</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
                Dinner
              </span>
              <div className="text-2xl font-black text-white">
                {mealData?.summary.mealTypeCounts.DINNER.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Meals served</p>
            </div>
          </div>

          {/* Interactive Stacked Bar Chart: Meals By Day */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-white text-base">
                  Daily Consumption Breakdown by Meal Window
                </h3>
                <p className="text-xs text-slate-400">
                  Stacked distribution of daily authenticated scans. Total volume: {mealData?.summary.totalMealsServed ?? 0} meals.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-slate-300">Breakfast</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /><span className="text-slate-300">Lunch</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" /><span className="text-slate-300">Snacks</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /><span className="text-slate-300">Dinner</span></span>
              </div>
            </div>

            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
                Aggregating mess trends...
              </div>
            ) : !mealData?.timeline || mealData.timeline.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
                No mess scans recorded in this window.
              </div>
            ) : (
              <div className="relative pt-4 pb-2">
                <svg
                  className="w-full h-64 overflow-visible"
                  viewBox={`0 0 ${mealData.timeline.length * 70} 200`}
                  preserveAspectRatio="none"
                >
                  {/* Grid Lines */}
                  {[0, 50, 100, 150].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2={mealData.timeline.length * 70}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Stacked Bars */}
                  {mealData.timeline.map((pt, idx) => {
                    const colX = idx * 70 + 24;
                    const hB = (pt.BREAKFAST / mealMaxVal) * 150;
                    const hL = (pt.LUNCH / mealMaxVal) * 150;
                    const hS = (pt.SNACKS / mealMaxVal) * 150;
                    const hD = (pt.DINNER / mealMaxVal) * 150;

                    let currentY = 170;

                    return (
                      <g
                        key={pt.date}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredMealIndex(idx)}
                        onMouseLeave={() => setHoveredMealIndex(null)}
                      >
                        {hoveredMealIndex === idx && (
                          <rect
                            x={colX - 10}
                            y="0"
                            width="44"
                            height="180"
                            fill="#10b981"
                            fillOpacity="0.08"
                            rx="6"
                          />
                        )}

                        {/* Breakfast Segment */}
                        {hB > 0 && (
                          <rect
                            x={colX}
                            y={(currentY -= hB)}
                            width="24"
                            height={hB}
                            fill="#f59e0b"
                            rx="2"
                          />
                        )}

                        {/* Lunch Segment */}
                        {hL > 0 && (
                          <rect
                            x={colX}
                            y={(currentY -= hL)}
                            width="24"
                            height={hL}
                            fill="#10b981"
                            rx="2"
                          />
                        )}

                        {/* Snacks Segment */}
                        {hS > 0 && (
                          <rect
                            x={colX}
                            y={(currentY -= hS)}
                            width="24"
                            height={hS}
                            fill="#38bdf8"
                            rx="2"
                          />
                        )}

                        {/* Dinner Segment */}
                        {hD > 0 && (
                          <rect
                            x={colX}
                            y={(currentY -= hD)}
                            width="24"
                            height={hD}
                            fill="#6366f1"
                            rx="2"
                          />
                        )}

                        {/* Date Label */}
                        <text
                          x={colX + 12}
                          y="190"
                          textAnchor="middle"
                          className="text-[10px] fill-slate-400 font-mono"
                        >
                          {pt.displayDate}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Tooltip */}
                {hoveredMealIndex !== null && mealData.timeline[hoveredMealIndex] && (
                  <div className="mt-3 p-3 bg-slate-950 border border-slate-700/80 rounded-xl flex items-center justify-between text-xs max-w-md mx-auto shadow-2xl">
                    <span className="font-bold text-white">
                      {mealData.timeline[hoveredMealIndex].displayDate}
                    </span>
                    <span className="text-amber-400 font-semibold">
                      B: {mealData.timeline[hoveredMealIndex].BREAKFAST}
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      L: {mealData.timeline[hoveredMealIndex].LUNCH}
                    </span>
                    <span className="text-sky-400 font-semibold">
                      S: {mealData.timeline[hoveredMealIndex].SNACKS}
                    </span>
                    <span className="text-indigo-400 font-semibold">
                      D: {mealData.timeline[hoveredMealIndex].DINNER}
                    </span>
                    <span className="text-white font-bold pl-2 border-l border-slate-800">
                      Total: {mealData.timeline[hoveredMealIndex].total}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EXPORT & AUDIT REPORTS (10.6) */}
      {activeTab === 'exports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Gate Attendance Audit Report */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4">
                <Building className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                Gate Entry & Exit Log Report
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Full chronological audit trail of student movements across hostel gates. Includes student roll numbers, names, rooms, gates, directions (ENTRY / EXIT), and hardware kiosk device codes.
              </p>
              <div className="p-3 bg-slate-950 rounded-xl text-xs text-slate-300 space-y-1 mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Date Coverage:</span>
                  <span className="font-mono text-white">Last {rangeDays} Days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Export Format:</span>
                  <span className="font-mono text-emerald-400">RFC-4180 CSV</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleExport('hostel_attendance')}
              disabled={exporting === 'hostel_attendance'}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-sky-500/20 disabled:opacity-50"
            >
              {exporting === 'hostel_attendance' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Gate Attendance CSV</span>
            </button>
          </div>

          {/* Card 2: Mess Attendance & Meal Report */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <Utensils className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                Mess Turnout & Meal Consumption Report
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Detailed record of authenticated meal claims. Contains student IDs, meal windows (Breakfast, Lunch, Snacks, Dinner), timestamp of redemption, and kiosk verification status.
              </p>
              <div className="p-3 bg-slate-950 rounded-xl text-xs text-slate-300 space-y-1 mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Date Coverage:</span>
                  <span className="font-mono text-white">Last {rangeDays} Days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Export Format:</span>
                  <span className="font-mono text-emerald-400">RFC-4180 CSV</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleExport('mess_attendance')}
              disabled={exporting === 'mess_attendance'}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {exporting === 'mess_attendance' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Mess Consumption CSV</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
