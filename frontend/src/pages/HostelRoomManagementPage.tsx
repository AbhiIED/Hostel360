import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Building2, Plus, RefreshCw, Edit3, Trash2, DoorOpen,
  AlertTriangle, Users, Layers, ChevronRight, X, Check
} from 'lucide-react';

interface Hostel {
  id: string;
  code: string;
  name: string;
  type: 'BOYS' | 'GIRLS';
  has_blocks: boolean;
  location: string;
  total_capacity: number;
  warden?: { id: string; name: string; email: string } | null;
  _count: { students: number; rooms: number; gates: number };
}

interface Room {
  id: string;
  room_number: string;
  floor: number;
  block?: string | null;
  capacity: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
  _count: { students: number };
}

interface Gate {
  id: string;
  name: string;
  devices: { id: string; device_name: string; device_code?: string; is_active: boolean }[];
}

export const HostelRoomManagementPage: React.FC = () => {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hostel Modal
  const [hostelModal, setHostelModal] = useState<'create' | 'edit' | null>(null);
  const [editHostel, setEditHostel] = useState<Hostel | null>(null);
  const [hostelForm, setHostelForm] = useState({
    code: '', name: '', type: 'BOYS' as 'BOYS' | 'GIRLS',
    location: '', total_capacity: 100, has_blocks: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Room Modal
  const [roomModal, setRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({
    room_number: '', floor: 0, block: '', capacity: 2, status: 'ACTIVE' as 'ACTIVE' | 'MAINTENANCE' | 'CLOSED',
  });

  // Gate Modal
  const [gateModal, setGateModal] = useState(false);
  const [gateName, setGateName] = useState('');

  const fetchHostels = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/hostels');
      setHostels(res.data.hostels || []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to load hostels');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHostelDetails = async (hostelId: string) => {
    try {
      setIsLoadingRooms(true);
      const res = await api.get(`/hostels/${hostelId}`);
      setRooms(res.data.hostel.rooms || []);
      setGates(res.data.hostel.gates || []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to load hostel details');
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => { fetchHostels(); }, []);

  useEffect(() => {
    if (selectedHostel) fetchHostelDetails(selectedHostel);
    else { setRooms([]); setGates([]); }
  }, [selectedHostel]);

  const selectedHostelObj = hostels.find(h => h.id === selectedHostel);

  // Hostel CRUD
  const handleHostelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      if (hostelModal === 'edit' && editHostel) {
        await api.patch(`/hostels/${editHostel.id}`, hostelForm);
      } else {
        await api.post('/hostels', { ...hostelForm, total_capacity: Number(hostelForm.total_capacity) });
      }
      setHostelModal(null);
      setEditHostel(null);
      fetchHostels();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save hostel');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditHostel = (h: Hostel) => {
    setEditHostel(h);
    setHostelForm({
      code: h.code, name: h.name, type: h.type,
      location: h.location, total_capacity: h.total_capacity, has_blocks: h.has_blocks,
    });
    setHostelModal('edit');
  };

  const handleDeleteHostel = async (h: Hostel) => {
    if (!confirm(`Delete hostel "${h.name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/hostels/${h.id}`);
      if (selectedHostel === h.id) setSelectedHostel(null);
      fetchHostels();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Failed to delete hostel');
    }
  };

  // Room CRUD
  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHostel) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await api.post(`/hostels/${selectedHostel}/rooms`, {
        ...roomForm, floor: Number(roomForm.floor), capacity: Number(roomForm.capacity),
        block: roomForm.block || null,
      });
      setRoomModal(false);
      setRoomForm({ room_number: '', floor: 0, block: '', capacity: 2, status: 'ACTIVE' });
      fetchHostelDetails(selectedHostel);
      fetchHostels();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create room');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gate CRUD
  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHostel) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await api.post(`/hostels/${selectedHostel}/gates`, { name: gateName });
      setGateModal(false);
      setGateName('');
      fetchHostelDetails(selectedHostel);
      fetchHostels();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create gate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'ACTIVE') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (s === 'MAINTENANCE') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            Campus Infrastructure
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Hostels & Rooms</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage hostels, room allocations, and entry gates across the campus.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchHostels} disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { setHostelForm({ code: '', name: '', type: 'BOYS', location: '', total_capacity: 100, has_blocks: false }); setHostelModal('create'); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition shadow-lg shadow-sky-600/25">
            <Plus className="w-4 h-4" /><span>Add Hostel</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        {/* Left: Hostel List */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            All Hostels ({hostels.length})
          </h2>
          {isLoading ? (
            <div className="text-center py-16 text-slate-400 text-sm">Loading hostels...</div>
          ) : hostels.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No hostels configured yet.</p>
            </div>
          ) : (
            hostels.map((h) => (
              <button key={h.id} onClick={() => setSelectedHostel(h.id)}
                className={`w-full text-left p-4 rounded-2xl border transition group ${
                  selectedHostel === h.id
                    ? 'bg-sky-600/10 border-sky-500/40 ring-1 ring-sky-500/20'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">{h.code}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${h.type === 'BOYS' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'}`}>
                      {h.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={(e) => { e.stopPropagation(); openEditHostel(h); }}
                      className="p-1 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteHostel(h); }}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-white text-sm leading-tight mb-1">{h.name}</h3>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{h._count.students}/{h.total_capacity}</span>
                  <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{h._count.rooms} rooms</span>
                  <span className="flex items-center gap-1"><DoorOpen className="w-3 h-3" />{h._count.gates} gates</span>
                </div>
                {h.warden && <div className="text-[10px] text-slate-500 mt-1.5">Warden: {h.warden.name}</div>}
                {selectedHostel === h.id && <ChevronRight className="w-4 h-4 text-sky-400 absolute right-4 top-1/2 -translate-y-1/2 hidden lg:block" />}
              </button>
            ))
          )}
        </div>

        {/* Right: Rooms & Gates */}
        <div>
          {!selectedHostel ? (
            <div className="text-center py-20 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl">
              <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-400">Select a Hostel</h3>
              <p className="text-slate-500 text-sm mt-1">Click on a hostel from the left panel to view rooms & gates</p>
            </div>
          ) : isLoadingRooms ? (
            <div className="text-center py-20 text-slate-400 text-sm">Loading rooms & gates...</div>
          ) : (
            <div className="space-y-6">
              {/* Gates Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Gates ({gates.length})
                  </h2>
                  <button onClick={() => { setGateName(''); setGateModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition">
                    <Plus className="w-3.5 h-3.5" /> Add Gate
                  </button>
                </div>
                {gates.length === 0 ? (
                  <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl text-center text-sm text-slate-400">
                    No gates configured for this hostel.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {gates.map(g => (
                      <div key={g.id} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm">
                        <div className="flex items-center gap-2">
                          <DoorOpen className="w-4 h-4 text-indigo-400" />
                          <span className="text-white font-medium">{g.name}</span>
                          <span className="text-[10px] text-slate-500">{g.devices.length} device(s)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rooms Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Rooms ({rooms.length})
                  </h2>
                  <button onClick={() => { setRoomForm({ room_number: '', floor: 0, block: '', capacity: 2, status: 'ACTIVE' }); setRoomModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition">
                    <Plus className="w-3.5 h-3.5" /> Add Room
                  </button>
                </div>
                {rooms.length === 0 ? (
                  <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl text-center text-sm text-slate-400">
                    No rooms configured for {selectedHostelObj?.name}.
                  </div>
                ) : (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Room #</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Floor</th>
                          {selectedHostelObj?.has_blocks && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Block</th>}
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Occupancy</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rooms.map((r) => (
                          <tr key={r.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                            <td className="px-4 py-2.5 font-mono text-sky-400 text-xs">{r.room_number}</td>
                            <td className="px-4 py-2.5 text-slate-300">{r.floor === 0 ? 'G' : r.floor}</td>
                            {selectedHostelObj?.has_blocks && <td className="px-4 py-2.5 text-slate-300">{r.block || '—'}</td>}
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${r._count.students >= r.capacity ? 'bg-red-500' : r._count.students > 0 ? 'bg-sky-500' : 'bg-slate-700'}`}
                                    style={{ width: `${Math.min(100, (r._count.students / r.capacity) * 100)}%` }} />
                                </div>
                                <span className="text-xs text-slate-400">{r._count.students}/{r.capacity}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${statusColor(r.status)}`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hostel Create/Edit Modal */}
      {hostelModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{hostelModal === 'edit' ? 'Edit Hostel' : 'Add New Hostel'}</h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  {hostelModal === 'edit' ? 'Update hostel configuration.' : 'Register a new hostel on campus.'}
                </p>
              </div>
              <button onClick={() => { setHostelModal(null); setEditHostel(null); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleHostelSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Code</label>
                  <input type="text" value={hostelForm.code} onChange={e => setHostelForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="H1" required className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-sky-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setHostelForm(p => ({ ...p, type: 'BOYS' }))}
                      className={`py-2 rounded-xl border text-xs font-semibold transition ${hostelForm.type === 'BOYS' ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                      Boys
                    </button>
                    <button type="button" onClick={() => setHostelForm(p => ({ ...p, type: 'GIRLS' }))}
                      className={`py-2 rounded-xl border text-xs font-semibold transition ${hostelForm.type === 'GIRLS' ? 'bg-pink-600/20 border-pink-500 text-pink-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                      Girls
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Official Name</label>
                <input type="text" value={hostelForm.name} onChange={e => setHostelForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Homi Jehangir Bhabha Bhawan" required className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Location</label>
                <input type="text" value={hostelForm.location} onChange={e => setHostelForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="North Campus, near Library" required className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Total Capacity</label>
                  <input type="number" value={hostelForm.total_capacity} onChange={e => setHostelForm(p => ({ ...p, total_capacity: parseInt(e.target.value) || 0 }))}
                    min={1} required className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hostelForm.has_blocks} onChange={e => setHostelForm(p => ({ ...p, has_blocks: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500" />
                    <span className="text-xs text-slate-300 font-medium">Has Multiple Blocks</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => { setHostelModal(null); setEditHostel(null); }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition">Cancel</button>
                <button type="submit" disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition shadow-lg shadow-sky-600/25 disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : hostelModal === 'edit' ? 'Update Hostel' : 'Create Hostel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Create Modal */}
      {roomModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Add Room</h2>
                <p className="text-slate-400 text-xs mt-0.5">Add a room to {selectedHostelObj?.name}</p>
              </div>
              <button onClick={() => setRoomModal(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRoomSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Room Number</label>
                  <input type="text" value={roomForm.room_number} onChange={e => setRoomForm(p => ({ ...p, room_number: e.target.value }))}
                    placeholder="01101" required className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-sky-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Floor</label>
                  <input type="number" value={roomForm.floor} onChange={e => setRoomForm(p => ({ ...p, floor: parseInt(e.target.value) || 0 }))}
                    min={0} className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {selectedHostelObj?.has_blocks && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Block</label>
                    <input type="text" value={roomForm.block} onChange={e => setRoomForm(p => ({ ...p, block: e.target.value }))}
                      placeholder="A" maxLength={2} className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Capacity</label>
                  <input type="number" value={roomForm.capacity} onChange={e => setRoomForm(p => ({ ...p, capacity: parseInt(e.target.value) || 1 }))}
                    min={1} className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ACTIVE', 'MAINTENANCE', 'CLOSED'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setRoomForm(p => ({ ...p, status: s }))}
                      className={`py-2 rounded-xl border text-xs font-semibold transition ${roomForm.status === s ? statusColor(s) : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setRoomModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition">Cancel</button>
                <button type="submit" disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition shadow-lg shadow-sky-600/25 disabled:opacity-50">
                  {isSubmitting ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gate Create Modal */}
      {gateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Add Gate</h2>
                <p className="text-slate-400 text-xs mt-0.5">Add an entry gate to {selectedHostelObj?.name}</p>
              </div>
              <button onClick={() => setGateModal(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Gate Name</label>
                <input type="text" value={gateName} onChange={e => setGateName(e.target.value)}
                  placeholder="Main Gate" required className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setGateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition">Cancel</button>
                <button type="submit" disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition shadow-lg shadow-sky-600/25 disabled:opacity-50">
                  {isSubmitting ? 'Creating...' : 'Create Gate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
