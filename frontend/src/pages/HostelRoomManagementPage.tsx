import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useConfirm } from '../context/ConfirmContext';
import {
  Building2, Plus, RefreshCw, DoorOpen,
  AlertTriangle, ChevronRight, X,
  Calendar, Layers,
  Check, CheckCircle2, ShieldAlert,
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

interface RegWindow {
  id: string;
  academic_year: string;
  semester: number;
  hostel_id?: string | null;
  open_from: string;
  open_to: string;
  status: 'OPEN' | 'CLOSED' | 'UPCOMING';
  hostel?: { name: string; code: string };
  _count?: { applications: number; batches: number };
}

interface FloorMappingItem {
  id?: string;
  floor: number;
  year_of_study: number;
}

interface EscalatedAppItem {
  id: string;
  student_id: string;
  hostel_id: string;
  year_of_study: number;
  flag_reason?: string;
  student: {
    id: string;
    roll_number: string;
    gender: string;
    user: { name: string; email: string };
  };
  hostel: { name: string; code: string };
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
  const { confirm, alert: customAlert } = useConfirm();
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

  // Top Tabs (Phase 14)
  const [activeTopTab, setActiveTopTab] = useState<'hostels' | 'windows' | 'floor_mappings' | 'escalated'>('hostels');

  // Registration Windows State
  const [windows, setWindows] = useState<RegWindow[]>([]);
  const [windowModal, setWindowModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [windowForm, setWindowForm] = useState({
    hostel_id: '',
    academic_year: '2026-2027',
    open_from: '',
    open_to: '',
  });

  const openCreateWindowModal = () => {
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatLocal = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setWindowForm({
      hostel_id: '',
      academic_year: `${now.getFullYear()}-${now.getFullYear() + 1}`,
      open_from: formatLocal(now),
      open_to: formatLocal(nextMonth),
    });
    setModalError(null);
    setWindowModal(true);
  };

  // Floor-Year Mappings State
  const [selectedMappingHostelId, setSelectedMappingHostelId] = useState<string>('');
  const [floorMappings, setFloorMappings] = useState<FloorMappingItem[]>([]);
  const [mappingSaving, setMappingSaving] = useState(false);

  // Escalated Queue State
  const [escalatedApps, setEscalatedApps] = useState<EscalatedAppItem[]>([]);
  const [manualPlaceModal, setManualPlaceModal] = useState<EscalatedAppItem | null>(null);
  const [manualPlaceHostelId, setManualPlaceHostelId] = useState('');
  const [manualPlaceRoomId, setManualPlaceRoomId] = useState('');
  const [manualPlaceNotes, setManualPlaceNotes] = useState('');
  const [manualRooms, setManualRooms] = useState<Room[]>([]);
  const [manualPlacing, setManualPlacing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Registration Windows Methods
  const fetchWindows = async () => {
    try {
      const res = await api.get(`/allocations/windows?_t=${Date.now()}`);
      if (Array.isArray(res.data?.windows)) {
        setWindows(res.data.windows);
      }
    } catch (err: any) {
      console.error('Failed to load windows:', err);
      const msg = err.response?.data?.error || 'Failed to load registration windows.';
      setError(msg);
    }
  };

  const handleCreateWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!windowForm.open_from || !windowForm.open_to) {
      setModalError('Please specify both opening and closing dates.');
      return;
    }

    const fromDate = new Date(windowForm.open_from);
    const toDate = new Date(windowForm.open_to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      setModalError('Invalid date values provided.');
      return;
    }

    if (toDate <= fromDate) {
      setModalError('Registration closing date must be after opening date.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/allocations/windows', {
        hostel_id: windowForm.hostel_id || undefined,
        academic_year: windowForm.academic_year,
        open_from: fromDate.toISOString(),
        open_to: toDate.toISOString(),
      });
      setSuccessMessage(res.data.message || 'Window opened successfully.');
      setWindowModal(false);
      setModalError(null);

      // Optimistically insert newly created window into UI immediately
      if (res.data?.window) {
        setWindows((prev) => {
          const exists = prev.some((w) => w.id === res.data.window.id);
          if (exists) return prev;
          const newWin: RegWindow = {
            ...res.data.window,
            _count: {
              applications: res.data.renewals_created || 0,
              batches: 0,
              allocation_batches: 0,
            },
          };
          return [newWin, ...prev];
        });
      }

      fetchWindows();
    } catch (err: any) {
      console.error('Failed to open window:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to open window.';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseWindow = async (windowId: string, autoRunBatch: boolean = true) => {
    const ok = await confirm({
      title: 'Close Registration Window?',
      message: 'Close this registration window? ' + (autoRunBatch ? 'This will automatically execute batch room allocation.' : ''),
      confirmText: autoRunBatch ? 'Close & Run Batch' : 'Close Window',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await api.patch(`/allocations/windows/${windowId}/close`, {
        auto_run_batch: autoRunBatch,
      });
      setSuccessMessage(res.data.message || 'Window closed successfully.');
      fetchWindows();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to close window.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Floor-Year Mapping Methods
  const fetchFloorMappings = async (hostelId: string) => {
    if (!hostelId) return;
    try {
      const res = await api.get(`/allocations/floor-year-mappings/${hostelId}`);
      const mappings: FloorMappingItem[] = res.data.mappings || [];
      if (mappings.length === 0) {
        const defaults: FloorMappingItem[] = [];
        for (let f = 1; f <= 5; f++) {
          defaults.push({ floor: f, year_of_study: Math.min(f, 4) });
        }
        setFloorMappings(defaults);
      } else {
        setFloorMappings(mappings);
      }
    } catch (err: any) {
      console.error('Failed to load floor mappings:', err);
    }
  };

  const handleSaveFloorMappings = async () => {
    if (!selectedMappingHostelId) return;
    try {
      setMappingSaving(true);
      setError(null);
      await api.put(`/allocations/floor-year-mappings/${selectedMappingHostelId}`, {
        mappings: floorMappings.map((m) => ({ floor: m.floor, year_of_study: m.year_of_study })),
      });
      setSuccessMessage('Floor-year mappings saved successfully.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save floor mappings.');
    } finally {
      setMappingSaving(false);
    }
  };

  // Zero-Vacancy Escalated Methods
  const fetchEscalatedApps = async () => {
    try {
      const res = await api.get('/allocations/applications?status=ESCALATED');
      setEscalatedApps(res.data.applications || []);
    } catch (err: any) {
      console.error('Failed to load escalated applications:', err);
    }
  };

  const fetchRoomsForManualPlacement = async (hostelId: string) => {
    if (!hostelId) return;
    try {
      const res = await api.get(`/hostels/${hostelId}`);
      setManualRooms(res.data.hostel.rooms || []);
    } catch (err: any) {
      console.error('Failed to load rooms for manual placement:', err);
    }
  };

  const handleManualPlaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPlaceModal || !manualPlaceHostelId || !manualPlaceRoomId) return;
    try {
      setManualPlacing(true);
      setError(null);
      const res = await api.patch(`/allocations/applications/${manualPlaceModal.id}/manual-place`, {
        hostel_id: manualPlaceHostelId,
        room_id: manualPlaceRoomId,
        notes: manualPlaceNotes || 'Super Admin manual placement',
      });
      setSuccessMessage(res.data.message || 'Student manually placed.');
      setManualPlaceModal(null);
      fetchEscalatedApps();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to manually place applicant.');
    } finally {
      setManualPlacing(false);
    }
  };

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

  useEffect(() => {
    fetchHostels();
    fetchWindows();
  }, []);

  useEffect(() => {
    if (activeTopTab === 'windows') {
      fetchWindows();
    }
  }, [activeTopTab]);

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
    const ok = await confirm({
      title: 'Delete Hostel?',
      message: `Are you sure you want to delete hostel "${h.name}"? This action cannot be undone.`,
      confirmText: 'Delete Hostel',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/hostels/${h.id}`);
      if (selectedHostel === h.id) setSelectedHostel(null);
      fetchHostels();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      await customAlert({
        title: 'Delete Failed',
        message: msg || 'Failed to delete hostel',
        variant: 'danger',
      });
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
            onClick={() => {
              fetchHostels();
              fetchWindows();
              if (selectedMappingHostelId) fetchFloorMappings(selectedMappingHostelId);
              fetchEscalatedApps();
            }}
            disabled={isLoading}
            className="p-2 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition disabled:opacity-50"
            title="Refresh all"
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
        <div className="mb-4 p-3.5 rounded bg-[#B3432B]/10 border border-[#B3432B]/30 text-[#B3432B] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-semibold underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3.5 rounded bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2E7D5B]" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-semibold underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Super Admin Top Tabs (Phase 14) */}
      <div className="flex border-b border-[#E4E1DA] mb-6 gap-6 text-xs font-medium overflow-x-auto">
        <button
          onClick={() => setActiveTopTab('hostels')}
          className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTopTab === 'hostels'
              ? 'border-[#26415C] text-[#26415C] font-semibold'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Hostels & Rooms</span>
        </button>

        <button
          onClick={() => {
            setActiveTopTab('windows');
            fetchWindows();
          }}
          className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTopTab === 'windows'
              ? 'border-[#26415C] text-[#26415C] font-semibold'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Registration Windows</span>
        </button>

        <button
          onClick={() => {
            setActiveTopTab('floor_mappings');
            if (hostels.length > 0) {
              const hid = selectedMappingHostelId || hostels[0].id;
              setSelectedMappingHostelId(hid);
              fetchFloorMappings(hid);
            }
          }}
          className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTopTab === 'floor_mappings'
              ? 'border-[#26415C] text-[#26415C] font-semibold'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Floor-Year Mapping</span>
        </button>

        <button
          onClick={() => {
            setActiveTopTab('escalated');
            fetchEscalatedApps();
          }}
          className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTopTab === 'escalated'
              ? 'border-[#26415C] text-[#26415C] font-semibold'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Zero-Vacancy Queue ({escalatedApps.length})</span>
        </button>
      </div>

      {/* VIEW 1: Hostels & Rooms Grid */}
      {activeTopTab === 'hostels' && (
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
      )}

      {/* VIEW 2: Registration Windows Screen */}
      {activeTopTab === 'windows' && (
        <div className="bg-white border border-[#E4E1DA] rounded-lg shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
            <div>
              <h2 className="text-base font-semibold text-[#1C2430]">Hostel Registration Windows</h2>
              <p className="text-xs text-[#5B6472] mt-0.5">
                Open registration windows for sessions or individual hostels. Opening a window auto-generates renewals for continuing residents.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchWindows}
                className="p-2 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition"
                title="Refresh windows list"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={openCreateWindowModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium rounded transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Open Registration Window</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1C2430]">
              <thead className="bg-[#F6F5F2] text-[#5B6472] font-semibold border-b border-[#E4E1DA]">
                <tr>
                  <th className="px-4 py-3">Academic Session</th>
                  <th className="px-4 py-3">Scope / Target</th>
                  <th className="px-4 py-3">Open Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Applications</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E1DA]">
                {windows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[#5B6472]">
                      <Calendar className="w-8 h-8 text-[#5B6472]/60 mx-auto mb-2" strokeWidth={1.5} />
                      <p className="font-medium text-sm text-[#1C2430] mb-1">No registration windows opened yet</p>
                      <p className="text-xs text-[#5B6472] mb-3">
                        Open a registration window to allow students to apply and auto-generate renewal applications for current residents.
                      </p>
                      <button
                        onClick={openCreateWindowModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#26415C] hover:bg-[#1e344a] text-white rounded text-xs font-medium transition shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Open First Window</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  windows.map((win) => (
                    <tr key={win.id} className="hover:bg-[#FBFBFA] transition">
                      <td className="px-4 py-3 font-semibold">{win.academic_year}</td>
                      <td className="px-4 py-3">
                        {win.hostel ? (
                          <span>
                            {win.hostel.name} ({win.hostel.code})
                          </span>
                        ) : (
                          <span className="text-[#0E7490] font-medium">Campus-Wide (All Hostels)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#5B6472]">
                        {new Date(win.open_from).toLocaleDateString()} — {new Date(win.open_to).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold ${
                            win.status === 'OPEN'
                              ? 'bg-[#2E7D5B] text-white'
                              : win.status === 'CLOSED'
                              ? 'bg-[#E5E7EB] text-[#374151]'
                              : 'bg-[#FEF08A] text-[#854D0E]'
                          }`}
                        >
                          {win.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {win._count?.applications || 0} applicants • {win._count?.batches || 0} batches
                      </td>
                      <td className="px-4 py-3 text-right">
                        {win.status === 'OPEN' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleCloseWindow(win.id, true)}
                              className="px-2.5 py-1 bg-[#26415C] hover:bg-[#1e344a] text-white rounded text-[11px] font-medium transition"
                            >
                              Close & Run Batch
                            </button>
                            <button
                              onClick={() => handleCloseWindow(win.id, false)}
                              className="px-2.5 py-1 border border-[#D5D2CA] hover:bg-[#F6F5F2] rounded text-[11px] text-[#5B6472] transition"
                            >
                              Close Only
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#5B6472]">Closed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: Floor-Year Mapping Screen */}
      {activeTopTab === 'floor_mappings' && (
        <div className="bg-white border border-[#E4E1DA] rounded-lg shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
            <div>
              <h2 className="text-base font-semibold text-[#1C2430]">Floor-Year Mapping Policy</h2>
              <p className="text-xs text-[#5B6472] mt-0.5">
                Floor assignment is tied to year of study. Floor counts vary across hostels (e.g. H3/H4 have 3 floors vs H8's 5 floors).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-[#5B6472] font-medium">Select Hostel:</label>
              <select
                value={selectedMappingHostelId}
                onChange={(e) => {
                  setSelectedMappingHostelId(e.target.value);
                  fetchFloorMappings(e.target.value);
                }}
                className="text-xs px-3 py-1.5 border border-[#D5D2CA] rounded bg-white font-medium text-[#1C2430] focus:outline-none focus:border-[#26415C]"
              >
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {floorMappings.map((m, idx) => (
                <div key={idx} className="p-4 bg-[#FBFBFA] border border-[#E4E1DA] rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-[#1C2430]">Floor {m.floor}</span>
                    <span className="text-[10px] bg-[#E0F2FE] text-[#0369A1] font-medium px-2 py-0.5 rounded">
                      Tier {m.floor}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                      Assigned Year of Study
                    </label>
                    <select
                      value={m.year_of_study}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setFloorMappings((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, year_of_study: val } : item))
                        );
                      }}
                      className="w-full text-xs p-2 border border-[#D5D2CA] rounded bg-white text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                    >
                      <option value={1}>Year 1 (Freshers)</option>
                      <option value={2}>Year 2 (Sophomores)</option>
                      <option value={3}>Year 3 (Pre-final)</option>
                      <option value={4}>Year 4 (Final year)</option>
                      <option value={5}>Year 5 (Dual/PG)</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-[#E4E1DA]">
              <button
                onClick={handleSaveFloorMappings}
                disabled={mappingSaving}
                className="px-5 py-2 bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium rounded transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{mappingSaving ? 'Saving Policy...' : 'Save Floor-Year Mappings'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: Zero-Vacancy Escalated Placements */}
      {activeTopTab === 'escalated' && (
        <div className="bg-white border border-[#E4E1DA] rounded-lg shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
            <div>
              <h2 className="text-base font-semibold text-[#1C2430]">Campus-Wide Zero-Vacancy Queue</h2>
              <p className="text-xs text-[#5B6472] mt-0.5">
                Applicants who could not be placed due to zero vacancy across all hostels of matching gender. Requires manual placement.
              </p>
            </div>
            <button
              onClick={fetchEscalatedApps}
              className="p-1.5 border border-[#D5D2CA] rounded hover:bg-[#F3F2EE] text-[#5B6472] transition"
              title="Refresh queue"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1C2430]">
              <thead className="bg-[#F6F5F2] text-[#5B6472] font-semibold border-b border-[#E4E1DA]">
                <tr>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Roll Number</th>
                  <th className="px-4 py-3">Gender / Year</th>
                  <th className="px-4 py-3">Applied Hostel</th>
                  <th className="px-4 py-3">Escalation Reason</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E1DA]">
                {escalatedApps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#2E7D5B] font-medium">
                      ✓ No escalated applicants in queue. All students placed successfully!
                    </td>
                  </tr>
                ) : (
                  escalatedApps.map((esc) => (
                    <tr key={esc.id} className="hover:bg-[#FBFBFA] transition">
                      <td className="px-4 py-3 font-semibold">{esc.student?.user?.name}</td>
                      <td className="px-4 py-3 text-[#5B6472]">{esc.student?.roll_number}</td>
                      <td className="px-4 py-3">
                        {esc.student?.gender} • Year {esc.year_of_study}
                      </td>
                      <td className="px-4 py-3">
                        {esc.hostel?.name} ({esc.hostel?.code})
                      </td>
                      <td className="px-4 py-3 text-[#B91C1C] font-medium max-w-[240px] truncate">
                        {esc.flag_reason || 'Zero campus vacancy'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setManualPlaceModal(esc);
                            const hid = esc.hostel_id || (hostels.length > 0 ? hostels[0].id : '');
                            setManualPlaceHostelId(hid);
                            fetchRoomsForManualPlacement(hid);
                          }}
                          className="px-3 py-1 bg-[#26415C] hover:bg-[#1e344a] text-white rounded font-medium transition shadow-sm text-xs"
                        >
                          Manual Place
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Registration Window Modal */}
      {windowModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E1DA]">
              <h2 className="font-serif text-lg font-medium text-[#1C2430]">Open Registration Window</h2>
              <button onClick={() => setWindowModal(false)} className="text-[#5B6472] hover:text-[#1C2430]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-3.5 p-2.5 rounded bg-[#B3432B]/10 border border-[#B3432B]/30 text-[#B3432B] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateWindow} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1C2430] font-medium mb-1">Target Hostel (Optional)</label>
                <select
                  value={windowForm.hostel_id}
                  onChange={(e) => setWindowForm({ ...windowForm, hostel_id: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                >
                  <option value="">Campus-Wide (All Hostels)</option>
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#1C2430] font-medium mb-1">Academic Year / Session</label>
                <input
                  type="text"
                  value={windowForm.academic_year}
                  onChange={(e) => setWindowForm({ ...windowForm, academic_year: e.target.value })}
                  placeholder="2026-2027"
                  required
                  className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1C2430] font-medium mb-1">Open From</label>
                  <input
                    type="datetime-local"
                    value={windowForm.open_from}
                    onChange={(e) => setWindowForm({ ...windowForm, open_from: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#1C2430] font-medium mb-1">Open To</label>
                  <input
                    type="datetime-local"
                    value={windowForm.open_to}
                    onChange={(e) => setWindowForm({ ...windowForm, open_to: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-[11px] text-[#5B6472]">
                Note: Continuing residents will automatically have renewal applications generated for their target floor upon window opening.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => setWindowModal(false)}
                  className="px-3 py-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Opening Window...' : 'Open Window'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Place Modal */}
      {manualPlaceModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E1DA]">
              <h2 className="font-serif text-lg font-medium text-[#1C2430]">Manual Room Placement</h2>
              <button onClick={() => setManualPlaceModal(null)} className="text-[#5B6472] hover:text-[#1C2430]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleManualPlaceSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 bg-[#FBFBFA] border border-[#E4E1DA] rounded space-y-1">
                <div className="font-semibold text-[#1C2430]">{manualPlaceModal.student?.user?.name}</div>
                <div className="text-[#5B6472]">Roll: {manualPlaceModal.student?.roll_number}</div>
                <div className="text-[#5B6472]">Gender: {manualPlaceModal.student?.gender} • Year {manualPlaceModal.year_of_study}</div>
              </div>

              <div>
                <label className="block text-[#1C2430] font-medium mb-1">Select Target Hostel</label>
                <select
                  value={manualPlaceHostelId}
                  onChange={(e) => {
                    setManualPlaceHostelId(e.target.value);
                    fetchRoomsForManualPlacement(e.target.value);
                  }}
                  required
                  className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                >
                  <option value="">-- Choose Hostel --</option>
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#1C2430] font-medium mb-1">Select Room</label>
                <select
                  value={manualPlaceRoomId}
                  onChange={(e) => setManualPlaceRoomId(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                >
                  <option value="">-- Choose Room --</option>
                  {manualRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} (Floor {r.floor}) — {r._count?.students || 0}/{r.capacity} beds
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#1C2430] font-medium mb-1">Placement Notes / Override Reason</label>
                <textarea
                  value={manualPlaceNotes}
                  onChange={(e) => setManualPlaceNotes(e.target.value)}
                  placeholder="e.g. Assigned to emergency reserve seat by Super Admin"
                  className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-[#1C2430] focus:border-[#26415C] outline-none"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => setManualPlaceModal(null)}
                  className="px-3 py-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualPlacing}
                  className="px-4 py-1.5 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium disabled:opacity-50"
                >
                  {manualPlacing ? 'Placing...' : 'Confirm Placement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
