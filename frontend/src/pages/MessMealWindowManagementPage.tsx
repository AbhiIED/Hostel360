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
  staff_mess_assignments?: { user: { id: string; name: string; email: string; role: string } }[];
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
      case 'BREAKFAST':
        return 'bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/30';
      case 'LUNCH':
        return 'bg-[#C05621]/10 text-[#C05621] border-[#C05621]/30';
      case 'SNACKS':
        return 'bg-[#4C51BF]/10 text-[#4C51BF] border-[#4C51BF]/30';
      case 'DINNER':
        return 'bg-[#26415C]/10 text-[#26415C] border-[#26415C]/30';
      default:
        return 'bg-[#5B6472]/10 text-[#5B6472] border-[#5B6472]/30';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E4E1DA]">
        <div>
          <div className="flex items-center gap-2 text-[#5B6472] text-xs font-medium mb-1">
            <Utensils className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Dining services</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C2430] tracking-tight">
            Messes & meal windows
          </h1>
          <p className="text-xs text-[#5B6472] mt-1">
            Manage mess halls, configure meal schedules, and control active dining windows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMesses}
            disabled={isLoading}
            className="p-2 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setMessForm({ name: '' });
              setMessModal('create');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add mess</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded bg-[#B3432B]/10 border border-[#B3432B]/30 text-[#B3432B] text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Mess List */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-[#5B6472] mb-1">
            All messes ({messes.length})
          </div>
          {isLoading ? (
            <div className="text-center py-16 text-[#5B6472] text-xs">Loading messes...</div>
          ) : messes.length === 0 ? (
            <div className="text-center py-12 bg-white border border-[#E4E1DA] rounded-lg p-6">
              <Utensils className="w-8 h-8 text-[#5B6472] mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-xs text-[#5B6472]">No messes configured yet.</p>
            </div>
          ) : (
            messes.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMess(m.id)}
                className={`w-full text-left p-4 rounded-lg border transition group ${
                  selectedMess === m.id
                    ? 'bg-white border-[#26415C] ring-1 ring-[#26415C]/20 shadow-xs'
                    : 'bg-white border-[#E4E1DA] hover:border-[#8C93A0]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#26415C]">
                      <Utensils className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="font-medium text-[#1C2430] text-xs leading-tight">{m.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditMess(m);
                        setMessForm({ name: m.name });
                        setMessModal('edit');
                      }}
                      className="p-1 rounded text-[#5B6472] hover:text-[#26415C] hover:bg-[#FAF9F6] transition"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMess(m);
                      }}
                      className="p-1 rounded text-[#5B6472] hover:text-[#B3432B] hover:bg-[#B3432B]/10 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-[#5B6472]">
                  {m.hostel && (
                    <span className="font-mono text-[#26415C] bg-[#FAF9F6] px-1.5 py-0.5 rounded border border-[#E4E1DA]">
                      {m.hostel.code}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#5B6472]" />
                    {m._count.meal_windows} windows
                  </span>
                  <span>{m._count.devices} device(s)</span>
                </div>
                {m.staff_mess_assignments && m.staff_mess_assignments.length > 0 ? (
                  <div className="text-[10px] text-[#5B6472] mt-1.5">
                    Staff: {m.staff_mess_assignments.map((a) => a.user.name).join(', ')}
                  </div>
                ) : m.mess_admin ? (
                  <div className="text-[10px] text-[#5B6472] mt-1.5">Admin: {m.mess_admin.name}</div>
                ) : null}
              </button>
            ))
          )}
        </div>

        {/* Right: Meal Windows */}
        <div>
          {!selectedMess ? (
            <div className="text-center py-20 bg-white border border-dashed border-[#E4E1DA] rounded-lg">
              <Clock className="w-10 h-10 text-[#5B6472] mx-auto mb-2" strokeWidth={1.5} />
              <h3 className="text-sm font-medium text-[#1C2430]">Select a mess</h3>
              <p className="text-[#5B6472] text-xs mt-1">
                Click on a mess from the left panel to view and configure its meal windows
              </p>
            </div>
          ) : isLoadingWindows ? (
            <div className="text-center py-20 text-[#5B6472] text-xs">Loading meal windows...</div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-medium text-[#5B6472]">
                  Meal windows — {selectedMessObj?.name} ({mealWindows.length})
                </div>
                <button
                  onClick={() => {
                    setMwForm({
                      meal_type: 'BREAKFAST',
                      start_time: '07:00',
                      end_time: '09:00',
                      is_active: true,
                    });
                    setEditMw(null);
                    setMwModal('create');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] text-xs font-medium transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add window</span>
                </button>
              </div>

              {mealWindows.length === 0 ? (
                <div className="p-8 bg-white border border-[#E4E1DA] rounded-lg text-center text-xs text-[#5B6472]">
                  No meal windows configured for {selectedMessObj?.name}.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {mealWindows.map((mw) => (
                    <div
                      key={mw.id}
                      className={`p-4 rounded-lg border bg-white transition ${
                        mw.is_active ? 'border-[#E4E1DA]' : 'border-[#E4E1DA] opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded border ${mealColor(mw.meal_type)}`}>
                            {mealIcon(mw.meal_type)}
                          </div>
                          <div>
                            <h3 className="font-medium text-[#1C2430] text-xs">
                              {mw.meal_type.charAt(0) + mw.meal_type.slice(1).toLowerCase()}
                            </h3>
                            <div className="text-[11px] text-[#5B6472] font-mono mt-0.5">
                              {mw.start_time.slice(0, 5)} — {mw.end_time.slice(0, 5)}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleMwActive(mw)}
                          title={mw.is_active ? 'Disable' : 'Enable'}
                          className={`transition ${
                            mw.is_active
                              ? 'text-[#2E7D5B] hover:text-[#26415C]'
                              : 'text-[#8C93A0] hover:text-[#1C2430]'
                          }`}
                        >
                          {mw.is_active ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-[#E4E1DA]">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                            mw.is_active
                              ? 'bg-[#2E7D5B]/10 text-[#2E7D5B] border-[#2E7D5B]/30'
                              : 'bg-[#5B6472]/10 text-[#5B6472] border-[#5B6472]/20'
                          }`}
                        >
                          {mw.is_active ? 'Active' : 'Disabled'}
                        </span>
                        <button
                          onClick={() => {
                            setEditMw(mw);
                            setMwForm({
                              meal_type: mw.meal_type,
                              start_time: mw.start_time.slice(0, 5),
                              end_time: mw.end_time.slice(0, 5),
                              is_active: mw.is_active,
                            });
                            setMwModal('edit');
                          }}
                          className="text-[11px] text-[#5B6472] hover:text-[#26415C] font-medium flex items-center gap-1 transition"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E4E1DA]">
              <div>
                <h2 className="text-base font-serif font-medium text-[#1C2430]">
                  {messModal === 'edit' ? 'Edit mess' : 'Add new mess'}
                </h2>
                <p className="text-xs text-[#5B6472] mt-0.5">
                  {messModal === 'edit' ? 'Update mess details.' : 'Register a new dining hall.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setMessModal(null);
                  setEditMess(null);
                }}
                className="p-1.5 rounded hover:bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleMessSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">Mess name</label>
                <input
                  type="text"
                  value={messForm.name}
                  onChange={(e) => setMessForm({ name: e.target.value })}
                  placeholder="Central Dining Hall"
                  required
                  className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => {
                    setMessModal(null);
                    setEditMess(null);
                  }}
                  className="px-3.5 py-2 rounded border border-[#E4E1DA] bg-white text-[#5B6472] hover:text-[#1C2430] text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : messModal === 'edit' ? 'Update mess' : 'Create mess'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meal Window Create/Edit Modal */}
      {mwModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E4E1DA]">
              <div>
                <h2 className="text-base font-serif font-medium text-[#1C2430]">
                  {mwModal === 'edit' ? 'Edit meal window' : 'Add meal window'}
                </h2>
                <p className="text-xs text-[#5B6472] mt-0.5">
                  Configure dining time slot for {selectedMessObj?.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setMwModal(null);
                  setEditMw(null);
                }}
                className="p-1.5 rounded hover:bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleMwSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">Meal type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMwForm((p) => ({ ...p, meal_type: t }))}
                      className={`py-2 rounded border text-[11px] font-medium flex flex-col items-center gap-1 transition ${
                        mwForm.meal_type === t
                          ? 'bg-[#FAF9F6] border-[#26415C] text-[#26415C]'
                          : 'bg-white border-[#E4E1DA] text-[#5B6472] hover:bg-[#FAF9F6]'
                      }`}
                    >
                      {mealIcon(t)}
                      <span>{t.charAt(0) + t.slice(1).toLowerCase()}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">Start time</label>
                  <input
                    type="time"
                    value={mwForm.start_time}
                    onChange={(e) => setMwForm((p) => ({ ...p, start_time: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">End time</label>
                  <input
                    type="time"
                    value={mwForm.end_time}
                    onChange={(e) => setMwForm((p) => ({ ...p, end_time: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mwForm.is_active}
                    onChange={(e) => setMwForm((p) => ({ ...p, is_active: e.target.checked }))}
                    className="rounded border-[#E4E1DA] text-[#26415C] focus:ring-[#26415C]"
                  />
                  <span className="text-xs text-[#1C2430] font-medium">Active immediately</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => {
                    setMwModal(null);
                    setEditMw(null);
                  }}
                  className="px-3.5 py-2 rounded border border-[#E4E1DA] bg-white text-[#5B6472] hover:text-[#1C2430] text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : mwModal === 'edit' ? 'Update window' : 'Create window'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
