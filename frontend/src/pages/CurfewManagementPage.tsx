import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Play,
  RefreshCw,
  X,
  AlertCircle,
} from 'lucide-react';
import CurfewAlertsPanel from '../components/CurfewAlertsPanel';
import LeaveRequestsPanel from '../components/LeaveRequestsPanel';

interface CurfewWindow {
  id: string;
  hostel_id: string | null;
  day_type: 'EVERYDAY' | 'WEEKDAY' | 'WEEKEND';
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  max_low_risk_hours?: number;
  is_active: boolean;
  hostel?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  updater?: {
    name: string;
    email: string;
  };
}

interface HostelOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

export const CurfewManagementPage: React.FC = () => {
  const [windows, setWindows] = useState<CurfewWindow[]>([]);
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWindow, setEditingWindow] = useState<CurfewWindow | null>(null);
  const [formData, setFormData] = useState({
    hostel_id: '',
    day_type: 'EVERYDAY' as 'EVERYDAY' | 'WEEKDAY' | 'WEEKEND',
    start_time: '21:00',
    end_time: '06:00',
    grace_period_minutes: 30,
    max_low_risk_hours: 8,
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [sweepLoading, setSweepLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [winRes, hostelRes] = await Promise.all([
        api.get('/curfew/windows'),
        api.get('/hostels'),
      ]);
      setWindows(winRes.data.windows || []);
      setHostels(hostelRes.data.hostels || []);
    } catch (err: any) {
      console.error('Failed to load curfew data:', err);
      setError('Failed to load curfew configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreate = () => {
    setEditingWindow(null);
    setFormData({
      hostel_id: '',
      day_type: 'EVERYDAY',
      start_time: '21:00',
      end_time: '06:00',
      grace_period_minutes: 30,
      max_low_risk_hours: 8,
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (win: CurfewWindow) => {
    setEditingWindow(win);
    setFormData({
      hostel_id: win.hostel_id || '',
      day_type: win.day_type,
      start_time: win.start_time.slice(0, 5),
      end_time: win.end_time.slice(0, 5),
      grace_period_minutes: win.grace_period_minutes,
      max_low_risk_hours: win.max_low_risk_hours ?? 8,
      is_active: win.is_active,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this curfew window rule?')) return;
    try {
      await api.delete(`/curfew/windows/${id}`);
      setSuccessMsg('Curfew rule deleted successfully');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete curfew window');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      hostel_id: formData.hostel_id ? formData.hostel_id : null,
      day_type: formData.day_type,
      start_time: formData.start_time,
      end_time: formData.end_time,
      grace_period_minutes: Number(formData.grace_period_minutes),
      max_low_risk_hours: Number(formData.max_low_risk_hours || 8),
      is_active: formData.is_active,
    };

    try {
      if (editingWindow) {
        await api.patch(`/curfew/windows/${editingWindow.id}`, payload);
        setSuccessMsg('Curfew rule updated successfully');
      } else {
        await api.post('/curfew/windows', payload);
        setSuccessMsg('Curfew rule created successfully');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save curfew rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerSweep = async () => {
    setSweepLoading(true);
    setError(null);
    try {
      const res = await api.post('/curfew/sweep', { skip_delay: true });
      setSuccessMsg(res.data.message || 'Curfew sweep executed');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to trigger sweep');
    } finally {
      setSweepLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C2430] tracking-tight">
            Curfew Rule Engine & Windows
          </h1>
          <p className="text-xs text-[#5B6472] mt-1">
            Continuous background rule configuration over 24/7 attendance crossings. Midnight wrap is automatically resolved.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerSweep}
            disabled={sweepLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#E4E1DA] bg-white text-[#1C2430] hover:bg-[#FAF9F6] transition disabled:opacity-50"
            title="Execute immediate curfew sweep evaluation"
          >
            <Play className={`w-3.5 h-3.5 text-[#26415C] ${sweepLoading ? 'animate-pulse' : ''}`} />
            <span>{sweepLoading ? 'Running sweep...' : 'Run sweep check'}</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#26415C] text-white hover:bg-[#1B2E42] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add curfew rule</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-[#DEF7EC] border border-[#84E1BC] text-[#03543F] rounded text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[#03543F] p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#DC2626] p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Curfew Rules Table */}
      <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4E1DA]">
          <div>
            <h2 className="font-serif text-lg font-medium text-[#1C2430]">
              Active & Configured Curfew Windows
            </h2>
            <p className="text-xs text-[#5B6472] mt-0.5">
              Hostel-specific overrides take precedence; unassigned hostels automatically inherit campus defaults.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="p-1.5 text-[#5B6472] hover:text-[#1C2430] rounded transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#5B6472]">
            Loading curfew rules...
          </div>
        ) : windows.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#5B6472]">
            No curfew windows configured. Click "Add curfew rule" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                  <th className="py-2.5 font-medium">Scope / Hostel</th>
                  <th className="py-2.5 font-medium">Applicability</th>
                  <th className="py-2.5 font-medium">Curfew Hours</th>
                  <th className="py-2.5 font-medium">Grace Period</th>
                  <th className="py-2.5 font-medium">Low-Risk Cap</th>
                  <th className="py-2.5 font-medium">Status</th>
                  <th className="py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E1DA]">
                {windows.map((win) => {
                  const isCampusDefault = win.hostel_id === null;
                  const wrapsMidnight = win.start_time > win.end_time;

                  return (
                    <tr key={win.id} className="hover:bg-[#FAF9F6] transition">
                      <td className="py-3">
                        {isCampusDefault ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] rounded text-[11px] font-medium">
                              Campus-Wide Default
                            </span>
                            <span className="text-[11px] text-[#5B6472]">(All unspecified hostels)</span>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-[#1C2430]">
                              {win.hostel?.name} ({win.hostel?.code})
                            </div>
                            <div className="text-[11px] text-[#5B6472]">
                              {win.hostel?.type === 'GIRLS' ? "Girls' Hostel" : "Boys' Hostel"}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3">
                        <span className="font-mono text-[#1C2430]">
                          {win.day_type}
                        </span>
                      </td>

                      <td className="py-3 font-mono text-[#1C2430] tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <span>
                            {win.start_time.slice(0, 5)} → {win.end_time.slice(0, 5)}
                          </span>
                          {wrapsMidnight && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
                              +1 day wrap
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 font-mono text-[#5B6472] tabular-nums">
                        {win.grace_period_minutes} minutes
                      </td>

                      <td className="py-3 font-mono text-[#5B6472] tabular-nums">
                        {win.max_low_risk_hours ?? 8} hours
                      </td>

                      <td className="py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${
                            win.is_active
                              ? 'bg-[#DEF7EC] text-[#03543F] border border-[#84E1BC]'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {win.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>

                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(win)}
                            className="p-1 text-[#5B6472] hover:text-[#26415C] rounded transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(win.id)}
                            className="p-1 text-[#5B6472] hover:text-[#DC2626] rounded transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grid of Alerts and Out-Pass Monitoring */}
      <div className="space-y-6">
        <CurfewAlertsPanel showAllHostels={true} />
        <LeaveRequestsPanel showAllHostels={true} />
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg border border-[#E4E1DA] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
              <h3 className="font-serif text-lg font-medium text-[#1C2430]">
                {editingWindow ? 'Edit Curfew Window Rule' : 'New Curfew Window Rule'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-[#5B6472] hover:text-[#1C2430] p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[#1C2430] mb-1">
                  Scope (Hostel)
                </label>
                <select
                  value={formData.hostel_id}
                  onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
                  className="w-full p-2 border border-[#E4E1DA] rounded bg-white text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                >
                  <option value="">Campus-Wide Default (Fallback for all unspecified hostels)</option>
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code}) — {h.type === 'GIRLS' ? "Girls' Hostel" : "Boys' Hostel"}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#5B6472] mt-1">
                  Assign to a specific hostel (e.g. Girls' hostels needing custom hours) or leave as campus default.
                </p>
              </div>

              <div>
                <label className="block font-medium text-[#1C2430] mb-1">
                  Day Type
                </label>
                <select
                  value={formData.day_type}
                  onChange={(e) => setFormData({ ...formData, day_type: e.target.value as any })}
                  className="w-full p-2 border border-[#E4E1DA] rounded bg-white text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                >
                  <option value="EVERYDAY">Everyday (All 7 days)</option>
                  <option value="WEEKDAY">Weekday (Monday through Friday)</option>
                  <option value="WEEKEND">Weekend (Saturday & Sunday)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1C2430] mb-1">
                    Curfew Start Time (24h)
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full p-2 border border-[#E4E1DA] rounded font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1C2430] mb-1">
                    Curfew End Time (24h)
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full p-2 border border-[#E4E1DA] rounded font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#5B6472]">
                Supports overnight spans across midnight (e.g. 21:00 to 06:00).
              </p>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-medium text-[#1C2430] mb-1">
                    Grace Period (Minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    required
                    value={formData.grace_period_minutes}
                    onChange={(e) => setFormData({ ...formData, grace_period_minutes: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E4E1DA] rounded font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#1C2430] mb-1">
                    Low-Risk Threshold (Hours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={72}
                    required
                    value={formData.max_low_risk_hours}
                    onChange={(e) => setFormData({ ...formData, max_low_risk_hours: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E4E1DA] rounded font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#5B6472]">
                Leave requests exceeding this duration (default 8 hours) or overlapping curfew automatically escalate to HIGH risk tier (requiring Warden approval).
              </p>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-[#E4E1DA] text-[#26415C]"
                  />
                  <span className="font-medium text-[#1C2430]">Rule is Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#5B6472] hover:text-[#1C2430] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-medium bg-[#26415C] text-white rounded hover:bg-[#1B2E42] transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CurfewManagementPage;
