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
        if (['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER'].includes(user?.role || '')) {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
        <div>
          <div className="flex items-center gap-2 text-[#5B6472] text-xs font-medium mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Operational intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C2430] tracking-tight">
            Analytics & intelligence hub
          </h1>
          <p className="text-xs text-[#5B6472] mt-1">
            Real-time occupancy flows, peak traffic hours, mess consumption curves, and operational audit reports.
          </p>
        </div>

        {/* Action Bar: Range Picker & Instant Export */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Range Selector */}
          <div className="flex items-center bg-white border border-[#E4E1DA] rounded p-0.5 text-xs">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`px-3 py-1 rounded text-xs transition ${
                  rangeDays === days
                    ? 'bg-[#FAF9F6] text-[#1C2430] font-medium border border-[#E4E1DA]'
                    : 'text-[#5B6472] hover:text-[#1C2430]'
                }`}
              >
                {days} days
              </button>
            ))}
          </div>

          {/* Quick CSV Export */}
          <button
            onClick={() => handleExport(activeTab === 'meals' ? 'mess_attendance' : 'hostel_attendance')}
            disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-[#FAF9F6] border border-[#E4E1DA] text-xs font-medium text-[#1C2430] transition disabled:opacity-50"
            title="Download CSV report for current view"
          >
            {exporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#26415C]" />
            ) : (
              <Download className="w-3.5 h-3.5 text-[#26415C]" />
            )}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E4E1DA]">
        {['SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER'].includes(user?.role || '') && (
          <button
            onClick={() => setActiveTab('occupancy')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'occupancy'
                ? 'border-[#26415C] text-[#26415C] bg-[#FAF9F6]'
                : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Hostel occupancy & traffic</span>
          </button>
        )}

        {['SUPER_ADMIN', 'MESS_ADMIN'].includes(user?.role || '') && (
          <button
            onClick={() => setActiveTab('meals')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'meals'
                ? 'border-[#26415C] text-[#26415C] bg-[#FAF9F6]'
                : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Mess turnout & meals</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('exports')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'exports'
              ? 'border-[#26415C] text-[#26415C] bg-[#FAF9F6]'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Report downloads</span>
        </button>
      </div>

      {/* TAB 1: HOSTEL OCCUPANCY ANALYTICS */}
      {activeTab === 'occupancy' && (
        <div className="space-y-6">
          {/* Hostel Selector */}
          {hostelList.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[#5B6472] flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#26415C]" />
                <span>Select hostel:</span>
              </label>
              <div className="relative">
                <select
                  value={selectedHostelId}
                  onChange={(e) => setSelectedHostelId(e.target.value)}
                  className="bg-white border border-[#E4E1DA] text-[#1C2430] text-xs rounded px-3 py-1.5 pr-8 appearance-none focus:outline-none focus:border-[#26415C] font-medium"
                >
                  {user?.role === 'SUPER_ADMIN' && <option value="">All hostels (campus-wide)</option>}
                  {hostelList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.code} — {h.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#5B6472] absolute right-2.5 top-2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-white border border-[#E4E1DA]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[#5B6472]">
                  Total gate entries
                </span>
                <div className="p-1 rounded bg-[#2E7D5B]/10 text-[#2E7D5B] border border-[#2E7D5B]/30">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-serif font-medium text-[#1C2430]">
                {occupancyData?.summary.totalEntries.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-[#5B6472] mt-0.5">
                Avg. {occupancyData?.summary.avgDailyEntries ?? 0} check-ins per day
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white border border-[#E4E1DA]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[#5B6472]">
                  Total gate exits
                </span>
                <div className="p-1 rounded bg-[#B7791F]/10 text-[#B7791F] border border-[#B7791F]/30">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-serif font-medium text-[#1C2430]">
                {occupancyData?.summary.totalExits.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-[#5B6472] mt-0.5">
                Turnout over past {rangeDays} days
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white border border-[#E4E1DA]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[#5B6472]">
                  Net campus flow
                </span>
                <div className="p-1 rounded bg-[#26415C]/10 text-[#26415C] border border-[#26415C]/30">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-serif font-medium text-[#26415C]">
                {(occupancyData?.summary.totalEntries ?? 0) - (occupancyData?.summary.totalExits ?? 0) > 0 ? '+' : ''}
                {(occupancyData?.summary.totalEntries ?? 0) - (occupancyData?.summary.totalExits ?? 0)}
              </div>
              <p className="text-[11px] text-[#5B6472] mt-0.5">
                Net ingress during observation period
              </p>
            </div>
          </div>

          {/* Interactive SVG Chart: Daily Entry vs Exit Footfall */}
          <div className="p-5 rounded-lg bg-white border border-[#E4E1DA] space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-serif font-medium text-[#1C2430] text-sm">
                  Daily gate ingress & egress footfall
                </h3>
                <p className="text-xs text-[#5B6472]">
                  Interactive timeline of authenticated entries vs exits. Hover columns to inspect figures.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D5B] inline-block" />
                  <span className="text-[#5B6472]">Entries</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#B7791F] inline-block" />
                  <span className="text-[#5B6472]">Exits</span>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-[#5B6472] text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-[#26415C] mb-2" />
                Calculating occupancy curves...
              </div>
            ) : !occupancyData?.timeline || occupancyData.timeline.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#5B6472] text-xs">
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
                      stroke="#E4E1DA"
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
                            fill="#26415C"
                            fillOpacity="0.05"
                            rx="4"
                          />
                        )}

                        {/* Entry Bar */}
                        <rect
                          x={colX}
                          y={170 - entryHeight}
                          width="14"
                          height={Math.max(2, entryHeight)}
                          rx="2"
                          fill="#2E7D5B"
                          className="transition-all duration-300"
                        />

                        {/* Exit Bar */}
                        <rect
                          x={colX + 18}
                          y={170 - exitHeight}
                          width="14"
                          height={Math.max(2, exitHeight)}
                          rx="2"
                          fill="#B7791F"
                          className="transition-all duration-300"
                        />

                        {/* X-axis date label */}
                        <text
                          x={colX + 16}
                          y="190"
                          textAnchor="middle"
                          className="text-[10px] fill-[#5B6472] font-mono"
                        >
                          {pt.displayDate}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Tooltip Overlay */}
                {hoveredOccIndex !== null && occupancyData.timeline[hoveredOccIndex] && (
                  <div className="mt-3 p-2.5 bg-white border border-[#E4E1DA] rounded-lg flex items-center justify-between text-xs max-w-sm mx-auto shadow-sm">
                    <span className="font-medium text-[#1C2430]">
                      {occupancyData.timeline[hoveredOccIndex].displayDate}
                    </span>
                    <span className="text-[#2E7D5B] font-medium">
                      +{occupancyData.timeline[hoveredOccIndex].entries} In
                    </span>
                    <span className="text-[#B7791F] font-medium">
                      -{occupancyData.timeline[hoveredOccIndex].exits} Out
                    </span>
                    <span className="text-[#26415C] font-medium">
                      Net: {occupancyData.timeline[hoveredOccIndex].netFlow}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 24-Hour Peak Ingress / Egress Distribution */}
          {occupancyData?.hourlyPeaks && (
            <div className="p-5 rounded-lg bg-white border border-[#E4E1DA] space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#26415C]" />
                <h3 className="font-serif font-medium text-[#1C2430] text-sm">
                  Peak traffic hours (24-hour gate distribution)
                </h3>
              </div>
              <p className="text-xs text-[#5B6472]">
                Aggregated distribution of entries and exits across 24 hours of the day to identify curfew and rush hours.
              </p>

              <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-2">
                {occupancyData.hourlyPeaks.map((hp) => {
                  const totalHour = hp.entries + hp.exits;
                  return (
                    <div
                      key={hp.hour}
                      className="p-2 rounded border border-[#E4E1DA] bg-[#FAF9F6] text-center flex flex-col justify-between"
                      title={`${hp.hour}: ${hp.entries} In, ${hp.exits} Out`}
                    >
                      <span className="text-[10px] font-mono text-[#5B6472]">{hp.hour}</span>
                      <span className="text-xs font-medium text-[#1C2430] my-1">{totalHour}</span>
                      <span className="text-[9px] text-[#5B6472]">
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

      {/* TAB 2: MESS TURNOUT & CONSUMPTION */}
      {activeTab === 'meals' && (
        <div className="space-y-6">
          {/* Mess Selector */}
          {messList.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[#5B6472] flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-[#26415C]" />
                <span>Select mess:</span>
              </label>
              <div className="relative">
                <select
                  value={selectedMessId}
                  onChange={(e) => setSelectedMessId(e.target.value)}
                  className="bg-white border border-[#E4E1DA] text-[#1C2430] text-xs rounded px-3 py-1.5 pr-8 appearance-none focus:outline-none focus:border-[#26415C] font-medium"
                >
                  {user?.role === 'SUPER_ADMIN' && <option value="">All mess counters</option>}
                  {messList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#5B6472] absolute right-2.5 top-2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-white border border-[#E4E1DA]">
              <span className="text-xs font-medium text-[#B7791F] block mb-1">
                Breakfast
              </span>
              <div className="text-2xl font-serif font-medium text-[#1C2430]">
                {mealData?.summary.mealTypeCounts.BREAKFAST.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-[#5B6472] mt-0.5">Meals served</p>
            </div>

            <div className="p-4 rounded-lg bg-white border border-[#E4E1DA]">
              <span className="text-xs font-medium text-[#2E7D5B] block mb-1">
                Lunch
              </span>
              <div className="text-2xl font-serif font-medium text-[#1C2430]">
                {mealData?.summary.mealTypeCounts.LUNCH.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-[#5B6472] mt-0.5">Meals served</p>
            </div>

            <div className="p-4 rounded-lg bg-white border border-[#E4E1DA]">
              <span className="text-xs font-medium text-[#4C51BF] block mb-1">
                Evening snacks
              </span>
              <div className="text-2xl font-serif font-medium text-[#1C2430]">
                {mealData?.summary.mealTypeCounts.SNACKS.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-[#5B6472] mt-0.5">Meals served</p>
            </div>

            <div className="p-4 rounded-lg bg-white border border-[#E4E1DA]">
              <span className="text-xs font-medium text-[#26415C] block mb-1">
                Dinner
              </span>
              <div className="text-2xl font-serif font-medium text-[#1C2430]">
                {mealData?.summary.mealTypeCounts.DINNER.toLocaleString() ?? '—'}
              </div>
              <p className="text-[11px] text-[#5B6472] mt-0.5">Meals served</p>
            </div>
          </div>

          {/* Interactive Stacked Bar Chart: Meals By Day */}
          <div className="p-5 rounded-lg bg-white border border-[#E4E1DA] space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-serif font-medium text-[#1C2430] text-sm">
                  Daily consumption breakdown by meal window
                </h3>
                <p className="text-xs text-[#5B6472]">
                  Stacked distribution of daily authenticated scans. Total volume: {mealData?.summary.totalMealsServed ?? 0} meals.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#B7791F]" /><span className="text-[#5B6472]">Breakfast</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#2E7D5B]" /><span className="text-[#5B6472]">Lunch</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#4C51BF]" /><span className="text-[#5B6472]">Snacks</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#26415C]" /><span className="text-[#5B6472]">Dinner</span></span>
              </div>
            </div>

            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-[#5B6472] text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-[#26415C] mb-2" />
                Aggregating mess trends...
              </div>
            ) : !mealData?.timeline || mealData.timeline.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#5B6472] text-xs">
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
                      stroke="#E4E1DA"
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
                            fill="#26415C"
                            fillOpacity="0.05"
                            rx="4"
                          />
                        )}

                        {/* Breakfast Segment */}
                        {hB > 0 && (
                          <rect
                            x={colX}
                            y={(currentY -= hB)}
                            width="24"
                            height={hB}
                            fill="#B7791F"
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
                            fill="#2E7D5B"
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
                            fill="#4C51BF"
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
                            fill="#26415C"
                            rx="2"
                          />
                        )}

                        {/* Date Label */}
                        <text
                          x={colX + 12}
                          y="190"
                          textAnchor="middle"
                          className="text-[10px] fill-[#5B6472] font-mono"
                        >
                          {pt.displayDate}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Tooltip */}
                {hoveredMealIndex !== null && mealData.timeline[hoveredMealIndex] && (
                  <div className="mt-3 p-2.5 bg-white border border-[#E4E1DA] rounded-lg flex items-center justify-between text-xs max-w-md mx-auto shadow-sm">
                    <span className="font-medium text-[#1C2430]">
                      {mealData.timeline[hoveredMealIndex].displayDate}
                    </span>
                    <span className="text-[#B7791F] font-medium">
                      B: {mealData.timeline[hoveredMealIndex].BREAKFAST}
                    </span>
                    <span className="text-[#2E7D5B] font-medium">
                      L: {mealData.timeline[hoveredMealIndex].LUNCH}
                    </span>
                    <span className="text-[#4C51BF] font-medium">
                      S: {mealData.timeline[hoveredMealIndex].SNACKS}
                    </span>
                    <span className="text-[#26415C] font-medium">
                      D: {mealData.timeline[hoveredMealIndex].DINNER}
                    </span>
                    <span className="text-[#1C2430] font-semibold pl-2 border-l border-[#E4E1DA]">
                      Total: {mealData.timeline[hoveredMealIndex].total}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EXPORT & AUDIT REPORTS */}
      {activeTab === 'exports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Gate Attendance Audit Report */}
          <div className="p-6 rounded-lg bg-white border border-[#E4E1DA] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#26415C] flex items-center justify-center mb-3">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="text-base font-serif font-medium text-[#1C2430] mb-1">
                Gate entry & exit log report
              </h3>
              <p className="text-xs text-[#5B6472] leading-relaxed mb-4">
                Full chronological audit trail of student movements across hostel gates. Includes student roll numbers, names, rooms, gates, directions (Entry / Exit), and hardware kiosk device codes.
              </p>
              <div className="p-3 bg-[#FAF9F6] rounded border border-[#E4E1DA] text-xs text-[#5B6472] space-y-1 mb-4">
                <div className="flex justify-between">
                  <span>Date coverage:</span>
                  <span className="font-mono text-[#1C2430]">Last {rangeDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span>Export format:</span>
                  <span className="font-mono text-[#2E7D5B]">RFC-4180 CSV</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleExport('hostel_attendance')}
              disabled={exporting === 'hostel_attendance'}
              className="w-full py-2.5 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {exporting === 'hostel_attendance' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download gate attendance CSV</span>
            </button>
          </div>

          {/* Card 2: Mess Attendance & Meal Report */}
          <div className="p-6 rounded-lg bg-white border border-[#E4E1DA] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#26415C] flex items-center justify-center mb-3">
                <Utensils className="w-5 h-5" />
              </div>
              <h3 className="text-base font-serif font-medium text-[#1C2430] mb-1">
                Mess turnout & meal consumption report
              </h3>
              <p className="text-xs text-[#5B6472] leading-relaxed mb-4">
                Detailed record of authenticated meal claims. Contains student IDs, meal windows (Breakfast, Lunch, Snacks, Dinner), timestamp of redemption, and kiosk verification status.
              </p>
              <div className="p-3 bg-[#FAF9F6] rounded border border-[#E4E1DA] text-xs text-[#5B6472] space-y-1 mb-4">
                <div className="flex justify-between">
                  <span>Date coverage:</span>
                  <span className="font-mono text-[#1C2430]">Last {rangeDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span>Export format:</span>
                  <span className="font-mono text-[#2E7D5B]">RFC-4180 CSV</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleExport('mess_attendance')}
              disabled={exporting === 'mess_attendance'}
              className="w-full py-2.5 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {exporting === 'mess_attendance' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download mess consumption CSV</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
