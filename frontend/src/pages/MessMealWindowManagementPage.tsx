import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Utensils, Plus, RefreshCw, Edit3, Trash2, Clock,
  AlertTriangle, X, ToggleLeft, ToggleRight, Coffee, Sun, Cookie, Moon
} from 'lucide-react';

interface MealWindow {
  id: string;
  meal_type: 'BREAKFAST' | 'LUNCH' | 'SNACKS' | 'DINNER';
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface MessItem {
  id: string;
  name: string;
  hostel?: { id: string; name: string; code: string } | null;
  mess_admin?: { id: string; name: string; email: string } | null;
  _count: { meal_windows: number; devices: number };
}

export const MessMealWindowManagementPage: React.FC = () => {
  const [messes, setMesses] = useState<MessItem[]>([]);
  const [selectedMess, setSelectedMess] = useState<string | null>(null);
  const [mealWindows, setMealWindows] = useState<MealWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWindows, setIsLoadingWindows] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mess Modal
  const [messModal, setMessModal] = useState<'create' | 'edit' | null>(null);
  const [editMess, setEditMess] = useState<MessItem | null>(null);
  const [messForm, setMessForm] = useState({ name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Meal Window Modal
  const [mwModal, setMwModal] = useState<'create' | 'edit' | null>(null);
  const [editMw, setEditMw] = useState<MealWindow | null>(null);
  const [mwForm, setMwForm] = useState({
    meal_type: 'BREAKFAST' as MealWindow['meal_type'],
    start_time: '07:00', end_time: '09:00', is_active: true,
  });

  const fetchMesses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/messes');
      setMesses(res.data.messes || []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to load messes');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMealWindows = async (messId: string) => {
    try {
      setIsLoadingWindows(true);
      const res = await api.get(`/messes/${messId}/meal-windows`);
      setMealWindows(res.data.mealWindows || []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to load meal windows');
    } finally {
      setIsLoadingWindows(false);
    }
  };

  useEffect(() => { fetchMesses(); }, []);
  useEffect(() => {
    if (selectedMess) fetchMealWindows(selectedMess);
    else setMealWindows([]);
  }, [selectedMess]);

  const selectedMessObj = messes.find(m => m.id === selectedMess);

  // Mess CRUD
  const handleMessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      if (messModal === 'edit' && editMess) {
        await api.patch(`/messes/${editMess.id}`, messForm);
      } else {
        await api.post('/messes', messForm);
      }
      setMessModal(null);
      setEditMess(null);
      fetchMesses();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save mess');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMess = async (m: MessItem) => {
    if (!confirm(`Delete mess "${m.name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/messes/${m.id}`);
      if (selectedMess === m.id) setSelectedMess(null);
      fetchMesses();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Failed to delete mess');
    }
  };

  // Meal Window CRUD
  const handleMwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMess) return;
    try {
      setIsSubmitting(true);
      setError(null);
      if (mwModal === 'edit' && editMw) {
        await api.patch(`/messes/${selectedMess}/meal-windows/${editMw.id}`, mwForm);
      } else {
        await api.post(`/messes/${selectedMess}/meal-windows`, mwForm);
      }
      setMwModal(null);
      setEditMw(null);
      fetchMealWindows(selectedMess);
      fetchMesses();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save meal window');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMwActive = async (mw: MealWindow) => {
    if (!selectedMess) return;
    try {
      await api.patch(`/messes/${selectedMess}/meal-windows/${mw.id}`, { is_active: !mw.is_active });
      fetchMealWindows(selectedMess);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Failed to toggle meal window');
    }
  };

  const mealIcon = (type: string) => {
    switch (type) {
      case 'BREAKFAST': return <Coffee className="w-4 h-4" />;
      case 'LUNCH': return <Sun className="w-4 h-4" />;
      case 'SNACKS': return <Cookie className="w-4 h-4" />;
      case 'DINNER': return <Moon className="w-4 h-4" />;
      default: return <Utensils className="w-4 h-4" />;
    }
  };

  const mealColor = (type: string) => {
    switch (type) {
      case 'BREAKFAST': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'LUNCH': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'SNACKS': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'DINNER': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Utensils className="w-4 h-4" />
            Dining Services
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Messes & Meal Windows</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage mess halls, configure meal schedules, and control active dining windows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchMesses} disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { setMessForm({ name: '' }); setMessModal('create'); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-600/25">
            <Plus className="w-4 h-4" /><span>Add Mess</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Mess List */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            All Messes ({messes.length})
          </h2>
          {isLoading ? (
            <div className="text-center py-16 text-slate-400 text-sm">Loading messes...</div>
          ) : messes.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <Utensils className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No messes configured yet.</p>
            </div>
          ) : (
            messes.map((m) => (
              <button key={m.id} onClick={() => setSelectedMess(m.id)}
                className={`w-full text-left p-4 rounded-2xl border transition group ${
                  selectedMess === m.id
                    ? 'bg-emerald-600/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <Utensils className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-white text-sm leading-tight">{m.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={(e) => { e.stopPropagation(); setEditMess(m); setMessForm({ name: m.name }); setMessModal('edit'); }}
                      className="p-1 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteMess(m); }}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  {m.hostel && <span className="font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">{m.hostel.code}</span>}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m._count.meal_windows} windows</span>
                  <span>{m._count.devices} device(s)</span>
                </div>
                {m.mess_admin && <div className="text-[10px] text-slate-500 mt-1.5">Admin: {m.mess_admin.name}</div>}
              </button>
            ))
          )}
        </div>

        {/* Right: Meal Windows */}
        <div>
          {!selectedMess ? (
            <div className="text-center py-20 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl">
              <Clock className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-400">Select a Mess</h3>
              <p className="text-slate-500 text-sm mt-1">Click on a mess from the left panel to view its meal windows</p>
            </div>
          ) : isLoadingWindows ? (
            <div className="text-center py-20 text-slate-400 text-sm">Loading meal windows...</div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Meal Windows — {selectedMessObj?.name} ({mealWindows.length})
                </h2>
                <button onClick={() => { setMwForm({ meal_type: 'BREAKFAST', start_time: '07:00', end_time: '09:00', is_active: true }); setEditMw(null); setMwModal('create'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition">
                  <Plus className="w-3.5 h-3.5" /> Add Window
                </button>
              </div>

              {mealWindows.length === 0 ? (
                <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-xl text-center text-sm text-slate-400">
                  No meal windows configured for {selectedMessObj?.name}.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {mealWindows.map(mw => (
                    <div key={mw.id}
                      className={`p-5 rounded-2xl border transition ${
                        mw.is_active
                          ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-950/60 border-slate-800/50 opacity-60'
                      }`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl border ${mealColor(mw.meal_type)}`}>
                            {mealIcon(mw.meal_type)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-sm">{mw.meal_type}</h3>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {mw.start_time.slice(0, 5)} — {mw.end_time.slice(0, 5)}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => toggleMwActive(mw)} title={mw.is_active ? 'Disable' : 'Enable'}
                          className={`transition ${mw.is_active ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600 hover:text-slate-400'}`}>
                          {mw.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                          mw.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                        }`}>
                          {mw.is_active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                        <button onClick={() => {
                          setEditMw(mw);
                          setMwForm({ meal_type: mw.meal_type, start_time: mw.start_time.slice(0, 5), end_time: mw.end_time.slice(0, 5), is_active: mw.is_active });
                          setMwModal('edit');
                        }} className="text-[11px] text-slate-400 hover:text-sky-400 font-medium flex items-center gap-1 transition">
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mess Create/Edit Modal */}
      {messModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{messModal === 'edit' ? 'Edit Mess' : 'Add New Mess'}</h2>
                <p className="text-slate-400 text-xs mt-0.5">{messModal === 'edit' ? 'Update mess details.' : 'Register a new dining hall.'}</p>
              </div>
              <button onClick={() => { setMessModal(null); setEditMess(null); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleMessSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Mess Name</label>
                <input type="text" value={messForm.name} onChange={e => setMessForm({ name: e.target.value })}
                  placeholder="Central Dining Hall" required
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => { setMessModal(null); setEditMess(null); }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition">Cancel</button>
                <button type="submit" disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-lg shadow-emerald-600/25 disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : messModal === 'edit' ? 'Update Mess' : 'Create Mess'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meal Window Create/Edit Modal */}
      {mwModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{mwModal === 'edit' ? 'Edit Meal Window' : 'Add Meal Window'}</h2>
                <p className="text-slate-400 text-xs mt-0.5">Configure a dining time slot for {selectedMessObj?.name}</p>
              </div>
              <button onClick={() => { setMwModal(null); setEditMw(null); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleMwSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Meal Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setMwForm(p => ({ ...p, meal_type: t }))}
                      className={`py-2.5 rounded-xl border text-[10px] font-bold uppercase flex flex-col items-center gap-1 transition ${
                        mwForm.meal_type === t ? mealColor(t) : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}>
                      {mealIcon(t)}
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Start Time</label>
                  <input type="time" value={mwForm.start_time} onChange={e => setMwForm(p => ({ ...p, start_time: e.target.value }))}
                    required className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">End Time</label>
                  <input type="time" value={mwForm.end_time} onChange={e => setMwForm(p => ({ ...p, end_time: e.target.value }))}
                    required className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={mwForm.is_active} onChange={e => setMwForm(p => ({ ...p, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500" />
                  <span className="text-xs text-slate-300 font-medium">Active immediately</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => { setMwModal(null); setEditMw(null); }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition">Cancel</button>
                <button type="submit" disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-lg shadow-emerald-600/25 disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : mwModal === 'edit' ? 'Update Window' : 'Create Window'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
