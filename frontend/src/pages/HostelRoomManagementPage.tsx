import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Building2, Plus, RefreshCw, DoorOpen,
  AlertTriangle, ChevronRight, X
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
  staff_hostel_assignments?: { user: { id: string; name: string; email: string; role: string }; role: string; is_primary: boolean }[];
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
    if (s === 'ACTIVE') return 'text-[#2E7D5B] bg-[#2E7D5B]/10 border-[#2E7D5B]/30';
    if (s === 'MAINTENANCE') return 'text-[#B7791F] bg-[#B7791F]/10 border-[#B7791F]/30';
    return 'text-[#B3432B] bg-[#B3432B]/10 border-[#B3432B]/30';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E4E1DA]">
        <div>
          <div className="flex items-center gap-2 text-[#5B6472] text-xs font-medium mb-1">
            <Building2 className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Campus infrastructure</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C2430] tracking-tight">
            Hostels & rooms
          </h1>
          <p className="text-xs text-[#5B6472] mt-1">
            Manage hostels, room allocations, and entry gates across the campus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHostels}
            disabled={isLoading}
            className="p-2 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setHostelForm({ code: '', name: '', type: 'BOYS', location: '', total_capacity: 100, has_blocks: false });
              setHostelModal('create');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add hostel</span>
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
        {/* Left: Hostel List */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-[#5B6472] mb-1">
            All hostels ({hostels.length})
          </div>
          {isLoading ? (
            <div className="text-center py-16 text-[#5B6472] text-xs">Loading hostels...</div>
          ) : hostels.length === 0 ? (
            <div className="text-center py-12 bg-white border border-[#E4E1DA] rounded-lg p-6">
              <Building2 className="w-8 h-8 text-[#5B6472] mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-xs text-[#5B6472]">No hostels configured yet.</p>
            </div>
          ) : (
            hostels.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHostel(h.id)}
                className={`w-full text-left p-4 rounded-lg border transition relative ${
                  selectedHostel === h.id
                    ? 'bg-white border-[#26415C] ring-1 ring-[#26415C]'
                    : 'bg-white border-[#E4E1DA] hover:border-[#26415C]/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#26415C] bg-[#FAF9F6] px-2 py-0.5 rounded border border-[#E4E1DA]">
                      {h.code}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded border border-[#E4E1DA] bg-[#FAF9F6] text-[#5B6472]">
                      {h.type === 'BOYS' ? 'Boys hostel' : 'Girls hostel'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      onClick={(e) => { e.stopPropagation(); openEditHostel(h); }}
                      className="text-[#5B6472] hover:text-[#26415C] px-1 py-0.5 rounded"
                      title="Edit"
                    >
                      Edit
                    </span>
                    <span
                      onClick={(e) => { e.stopPropagation(); handleDeleteHostel(h); }}
                      className="text-[#5B6472] hover:text-[#B3432B] px-1 py-0.5 rounded"
                      title="Delete"
                    >
                      Delete
                    </span>
                  </div>
                </div>

                <h3 className="font-medium text-[#1C2430] text-sm leading-tight mb-1">{h.name}</h3>
                <p className="text-xs text-[#5B6472] mb-2">{h.location}</p>

                <div className="flex items-center gap-3 text-xs text-[#5B6472] tabular-nums">
                  <span>{h._count.students} / {h.total_capacity} residents</span>
                  <span>•</span>
                  <span>{h._count.rooms} rooms</span>
                  <span>•</span>
                  <span>{h._count.gates} gates</span>
                </div>

                {h.staff_hostel_assignments && h.staff_hostel_assignments.length > 0 && (
                  <div className="text-[11px] text-[#5B6472] mt-2 pt-2 border-t border-[#E4E1DA] space-y-0.5">
                    {h.staff_hostel_assignments.filter(a => a.role === 'WARDEN').length > 0 && (
                      <div className="truncate">
                        Warden: <span className="text-[#1C2430]">{h.staff_hostel_assignments.filter(a => a.role === 'WARDEN').map(a => a.user.name).join(', ')}</span>
                      </div>
                    )}
                    {h.staff_hostel_assignments.filter(a => a.role === 'VICE_WARDEN').length > 0 && (
                      <div className="truncate">
                        Vice Warden: <span className="text-[#1C2430]">{h.staff_hostel_assignments.filter(a => a.role === 'VICE_WARDEN').map(a => a.user.name).join(', ')}</span>
                      </div>
                    )}
                    {h.staff_hostel_assignments.filter(a => a.role === 'CARETAKER').length > 0 && (
                      <div className="truncate">
                        Caretaker: <span className="text-[#1C2430]">{h.staff_hostel_assignments.filter(a => a.role === 'CARETAKER').map(a => a.user.name).join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
                {selectedHostel === h.id && <ChevronRight className="w-4 h-4 text-[#26415C] absolute right-3 top-1/2 -translate-y-1/2 hidden lg:block" />}
              </button>
            ))
          )}
        </div>

        {/* Right: Rooms & Gates */}
        <div>
          {!selectedHostel ? (
            <div className="text-center py-20 bg-white border border-dashed border-[#E4E1DA] rounded-lg">
              <Building2 className="w-10 h-10 text-[#5B6472] mx-auto mb-2" strokeWidth={1.5} />
              <h3 className="font-serif text-base font-medium text-[#1C2430]">Select a hostel</h3>
              <p className="text-xs text-[#5B6472] mt-0.5">Click on a hostel from the left panel to view rooms and gates</p>
            </div>
          ) : isLoadingRooms ? (
            <div className="text-center py-20 text-[#5B6472] text-xs">Loading rooms and gates...</div>
          ) : (
            <div className="space-y-6">
              {/* Gates Section */}
              <div className="bg-white border border-[#E4E1DA] rounded-lg p-5">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E4E1DA]">
                  <h2 className="text-xs font-medium text-[#5B6472]">
                    Gates ({gates.length})
                  </h2>
                  <button
                    onClick={() => { setGateName(''); setGateModal(true); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-[#E4E1DA] text-[#1C2430] hover:bg-[#FAF9F6] text-xs transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add gate</span>
                  </button>
                </div>
                {gates.length === 0 ? (
                  <p className="text-center py-4 text-xs text-[#5B6472]">
                    No gates configured for this hostel.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {gates.map(g => (
                      <div key={g.id} className="px-3 py-1.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs">
                        <div className="flex items-center gap-2">
                          <DoorOpen className="w-3.5 h-3.5 text-[#26415C]" strokeWidth={1.5} />
                          <span className="font-medium text-[#1C2430]">{g.name}</span>
                          <span className="text-[11px] text-[#5B6472]">{g.devices.length} device(s)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rooms Section */}
              <div className="bg-white border border-[#E4E1DA] rounded-lg p-5">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E4E1DA]">
                  <h2 className="text-xs font-medium text-[#5B6472]">
                    Rooms ({rooms.length})
                  </h2>
                  <button
                    onClick={() => { setRoomForm({ room_number: '', floor: 0, block: '', capacity: 2, status: 'ACTIVE' }); setRoomModal(true); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-[#E4E1DA] text-[#1C2430] hover:bg-[#FAF9F6] text-xs transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add room</span>
                  </button>
                </div>

                {rooms.length === 0 ? (
                  <p className="text-center py-6 text-xs text-[#5B6472]">
                    No rooms configured for this hostel.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {rooms.map(r => (
                      <div key={r.id} className="p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-[#1C2430] tabular-nums">{r.room_number}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor(r.status)}`}>
                            {r.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#5B6472] flex items-center justify-between">
                          <span>Floor {r.floor}</span>
                          <span className="tabular-nums">{r._count?.students || 0}/{r.capacity} beds</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hostel Create / Edit Modal */}
      {hostelModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E1DA]">
              <h2 className="font-serif text-lg font-medium text-[#1C2430]">
                {hostelModal === 'edit' ? 'Edit hostel' : 'Add new hostel'}
              </h2>
              <button onClick={() => { setHostelModal(null); setEditHostel(null); }} className="text-[#5B6472] hover:text-[#1C2430]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleHostelSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1C2430] font-medium mb-1">Code</label>
                  <input
                    type="text"
                    value={hostelForm.code}
                    onChange={e => setHostelForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="H1"
                    required
                    className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] font-mono focus:border-[#26415C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#1C2430] font-medium mb-1">Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHostelForm(p => ({ ...p, type: 'BOYS' }))}
                      className={`py-1.5 rounded border text-xs transition ${
                        hostelForm.type === 'BOYS'
                          ? 'bg-[#26415C] text-white border-[#26415C]'
                          : 'bg-white border-[#E4E1DA] text-[#5B6472]'
                      }`}
                    >
                      Boys
                    </button>
                    <button
                      type="button"
                      onClick={() => setHostelForm(p => ({ ...p, type: 'GIRLS' }))}
                      className={`py-1.5 rounded border text-xs transition ${
                        hostelForm.type === 'GIRLS'
                          ? 'bg-[#26415C] text-white border-[#26415C]'
                          : 'bg-white border-[#E4E1DA] text-[#5B6472]'
                      }`}
                    >
                      Girls
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[#1C2430] font-medium mb-1">Official name</label>
                <input
                  type="text"
                  value={hostelForm.name}
                  onChange={e => setHostelForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Homi Jehangir Bhabha Bhawan"
                  required
                  className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#1C2430] font-medium mb-1">Location</label>
                <input
                  type="text"
                  value={hostelForm.location}
                  onChange={e => setHostelForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="North Campus, near Library"
                  required
                  className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1C2430] font-medium mb-1">Total capacity</label>
                  <input
                    type="number"
                    value={hostelForm.total_capacity}
                    onChange={e => setHostelForm(p => ({ ...p, total_capacity: parseInt(e.target.value) || 0 }))}
                    min={1}
                    required
                    className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                  />
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hostelForm.has_blocks}
                      onChange={e => setHostelForm(p => ({ ...p, has_blocks: e.target.checked }))}
                      className="rounded border-[#E4E1DA] text-[#26415C]"
                    />
                    <span className="text-[#5B6472]">Has multiple blocks</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => { setHostelModal(null); setEditHostel(null); }}
                  className="px-3 py-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : hostelModal === 'edit' ? 'Update hostel' : 'Create hostel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Modal */}
      {roomModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E1DA]">
              <h2 className="font-serif text-lg font-medium text-[#1C2430]">Add room</h2>
              <button onClick={() => setRoomModal(false)} className="text-[#5B6472] hover:text-[#1C2430]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRoomSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1C2430] font-medium mb-1">Room number</label>
                  <input
                    type="text"
                    value={roomForm.room_number}
                    onChange={e => setRoomForm(p => ({ ...p, room_number: e.target.value }))}
                    placeholder="01101"
                    required
                    className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] font-mono focus:border-[#26415C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#1C2430] font-medium mb-1">Floor</label>
                  <input
                    type="number"
                    value={roomForm.floor}
                    onChange={e => setRoomForm(p => ({ ...p, floor: parseInt(e.target.value) || 0 }))}
                    min={0}
                    className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1C2430] font-medium mb-1">Capacity</label>
                  <input
                    type="number"
                    value={roomForm.capacity}
                    onChange={e => setRoomForm(p => ({ ...p, capacity: parseInt(e.target.value) || 1 }))}
                    min={1}
                    className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#1C2430] font-medium mb-1">Status</label>
                  <select
                    value={roomForm.status}
                    onChange={e => setRoomForm(p => ({ ...p, status: e.target.value as any }))}
                    className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => setRoomModal(false)}
                  className="px-3 py-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gate Modal */}
      {gateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E1DA]">
              <h2 className="font-serif text-lg font-medium text-[#1C2430]">Add gate</h2>
              <button onClick={() => setGateModal(false)} className="text-[#5B6472] hover:text-[#1C2430]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1C2430] font-medium mb-1">Gate name</label>
                <input
                  type="text"
                  value={gateName}
                  onChange={e => setGateName(e.target.value)}
                  placeholder="Main Gate"
                  required
                  className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => setGateModal(false)}
                  className="px-3 py-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create gate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostelRoomManagementPage;
