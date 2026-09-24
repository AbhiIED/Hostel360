import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users, Plus, RefreshCw, Edit3, Trash2, Search,
  AlertTriangle, X, ChevronLeft, ChevronRight, GraduationCap, CheckCircle
} from 'lucide-react';

interface StudentItem {
  id: string;
  roll_number: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  department?: string | null;
  year?: number | null;
  current_state: 'INSIDE' | 'OUTSIDE';
  photo_url?: string | null;
  user: { id: string; name: string; email: string; role: string; is_active: boolean };
  hostel: { id: string; name: string; code: string };
  room: { id: string; room_number: string; floor: number; block?: string | null };
}

interface Hostel {
  id: string;
  code: string;
  name: string;
}

interface Room {
  id: string;
  room_number: string;
  floor: number;
  block?: string | null;
  capacity: number;
  _count: { students: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const StudentManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHostel, setFilterHostel] = useState('');

  // Reference data
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);

  // Modal state
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editStudent, setEditStudent] = useState<StudentItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', password: '', roll_number: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    department: '', year: '' as string | number,
    hostel_id: '', room_id: '',
    current_state: 'INSIDE' as 'INSIDE' | 'OUTSIDE',
    reason: '',
  });

  const fetchStudents = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (searchQuery) params.set('search', searchQuery);
      if (filterHostel) params.set('hostel_id', filterHostel);

      const res = await api.get(`/students?${params.toString()}`);
      setStudents(res.data.students || []);
      setPagination(res.data.pagination);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterHostel]);

  const fetchHostels = async () => {
    try {
      const res = await api.get('/hostels');
      setHostels(res.data.hostels || []);
    } catch { /* ignore */ }
  };

  const fetchRoomsForHostel = async (hostelId: string) => {
    if (!hostelId) { setAvailableRooms([]); return; }
    try {
      const res = await api.get(`/hostels/${hostelId}/rooms?status=ACTIVE`);
      setAvailableRooms(res.data.rooms || []);
    } catch { setAvailableRooms([]); }
  };

  useEffect(() => { fetchHostels(); }, []);
  useEffect(() => { fetchStudents(1); }, [fetchStudents]);

  // Watch hostel_id in form to load rooms
  useEffect(() => {
    if (form.hostel_id) fetchRoomsForHostel(form.hostel_id);
    else setAvailableRooms([]);
  }, [form.hostel_id]);

  const openCreateModal = () => {
    setForm({ name: '', email: '', password: '', roll_number: '', gender: 'MALE', department: '', year: '', hostel_id: '', room_id: '', current_state: 'INSIDE', reason: '' });
    setEditStudent(null);
    setModal('create');
  };

  const openEditModal = (s: StudentItem) => {
    setEditStudent(s);
    setForm({
      name: s.user.name, email: s.user.email, password: '', roll_number: s.roll_number,
      gender: s.gender, department: s.department || '', year: s.year ?? '',
      hostel_id: s.hostel.id, room_id: s.room.id,
      current_state: s.current_state,
      reason: '',
    });
    setModal('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      if (modal === 'edit' && editStudent) {
        const payload: Record<string, unknown> = {};
        if (form.name !== editStudent.user.name) payload.name = form.name;
        if (form.email !== editStudent.user.email) payload.email = form.email;
        if (form.roll_number !== editStudent.roll_number) payload.roll_number = form.roll_number;
        if (form.gender !== editStudent.gender) payload.gender = form.gender;
        if ((form.department || null) !== (editStudent.department || null)) payload.department = form.department || null;
        const yearVal = form.year ? Number(form.year) : null;
        if (yearVal !== (editStudent.year ?? null)) payload.year = yearVal;
        if (form.hostel_id !== editStudent.hostel.id) payload.hostel_id = form.hostel_id;
        if (form.room_id !== editStudent.room.id) payload.room_id = form.room_id;
        if (form.current_state !== editStudent.current_state) {
          payload.current_state = form.current_state;
        }
        if (form.reason.trim()) payload.reason = form.reason.trim();

        await api.patch(`/students/${editStudent.id}`, payload);
      } else {
        await api.post('/students', {
          ...form,
          year: form.year ? Number(form.year) : null,
          department: form.department || null,
        });
      }
      setModal(null);
      setEditStudent(null);
      fetchStudents(pagination.page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save student');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (s: StudentItem) => {
    if (!confirm(`Delete student "${s.user.name}" (${s.roll_number})? This will also delete their user account.`)) return;
    try {
      await api.delete(`/students/${s.id}`);
      fetchStudents(pagination.page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Failed to delete student');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E4E1DA]">
        <div>
          <div className="flex items-center gap-2 text-[#5B6472] text-xs font-medium mb-1">
            <GraduationCap className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Student registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C2430] tracking-tight">
            Student management
          </h1>
          <p className="text-xs text-[#5B6472] mt-1">
            View, register, and manage student accounts, hostel assignments, and room allocations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStudents(1)}
            disabled={isLoading}
            className="p-2 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {user?.role === 'SUPER_ADMIN' && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add student</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded bg-[#B3432B]/10 border border-[#B3432B]/30 text-[#B3432B] text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5B6472]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or roll number..."
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#8C93A0] focus:outline-none focus:border-[#26415C] transition"
          />
        </div>
        <select
          value={filterHostel}
          onChange={(e) => setFilterHostel(e.target.value)}
          className="px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition min-w-[200px]"
        >
          <option value="">All hostels</option>
          {hostels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.code} — {h.name}
            </option>
          ))}
        </select>
      </div>

      {/* Students Table */}
      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center text-[#5B6472] text-xs">
          Loading students...
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E4E1DA] rounded-lg p-8">
          <Users className="w-10 h-10 text-[#5B6472] mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="text-sm font-medium text-[#1C2430] mb-1">No students found</h3>
          <p className="text-xs text-[#5B6472] max-w-sm mx-auto mb-5">
            {searchQuery || filterHostel
              ? 'Try adjusting your search or filter criteria.'
              : 'Register your first student to get started.'}
          </p>
          {!searchQuery && !filterHostel && user?.role === 'SUPER_ADMIN' && (
            <button
              onClick={openCreateModal}
              className="px-3.5 py-2 bg-[#26415C] hover:bg-[#1e344a] text-white rounded text-xs font-medium transition"
            >
              Add student
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white border border-[#E4E1DA] rounded-lg overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6]">
                    <th className="text-left px-4 py-2.5 font-medium text-[#5B6472]">Student</th>
                    <th className="text-left px-4 py-2.5 font-medium text-[#5B6472]">Roll number</th>
                    <th className="text-left px-4 py-2.5 font-medium text-[#5B6472]">Hostel</th>
                    <th className="text-left px-4 py-2.5 font-medium text-[#5B6472]">Room</th>
                    <th className="text-left px-4 py-2.5 font-medium text-[#5B6472]">Department / Year</th>
                    <th className="text-left px-4 py-2.5 font-medium text-[#5B6472]">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium text-[#5B6472]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E1DA]">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-[#FAF9F6] transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-[#FAF9F6] border border-[#E4E1DA] flex items-center justify-center text-xs font-medium text-[#26415C]">
                            {s.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-[#1C2430] leading-tight">{s.user.name}</div>
                            <div className="text-[11px] text-[#5B6472]">{s.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#26415C]">{s.roll_number}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[#1C2430]">{s.hostel.code}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#1C2430]">{s.room.room_number}</td>
                      <td className="px-4 py-3 text-xs text-[#5B6472]">
                        {s.department || '—'}
                        {s.year ? ` / Y${s.year}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                            s.current_state === 'INSIDE'
                              ? 'bg-[#2E7D5B]/10 text-[#2E7D5B] border-[#2E7D5B]/30'
                              : 'bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.current_state === 'INSIDE' ? 'bg-[#2E7D5B]' : 'bg-[#B7791F]'
                            }`}
                          />
                          {s.current_state === 'INSIDE' ? 'Inside' : 'Outside'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(s)}
                            title="Edit / Update state"
                            className="p-1 rounded text-[#5B6472] hover:text-[#26415C] hover:bg-[#FAF9F6] transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {user?.role === 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleDelete(s)}
                              title="Delete"
                              className="p-1 rounded text-[#5B6472] hover:text-[#B3432B] hover:bg-[#B3432B]/10 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#5B6472]">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} students
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fetchStudents(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-[#5B6472] px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchStudents(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Student Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 max-w-xl w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E4E1DA]">
              <div>
                <h2 className="text-base font-serif font-medium text-[#1C2430]">
                  {modal === 'edit' ? 'Edit student record' : 'Register new student'}
                </h2>
                <p className="text-xs text-[#5B6472] mt-0.5">
                  {modal === 'edit'
                    ? 'Update student details and hostel assignment.'
                    : 'Create a student user account and assign room.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setModal(null);
                  setEditStudent(null);
                }}
                className="p-1.5 rounded hover:bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">Full name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Rahul Sharma"
                    required
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">Email address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="rahul@manit.ac.in"
                    required
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  />
                </div>
              </div>

              {/* Password (create only) & Roll Number */}
              <div className="grid grid-cols-2 gap-3">
                {modal === 'create' && (
                  <div>
                    <label className="block text-xs font-medium text-[#1C2430] mb-1">Password</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Min 6 characters"
                      required
                      minLength={6}
                      className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">Scholar / Roll number</label>
                  <input
                    type="text"
                    value={form.roll_number}
                    onChange={(e) => setForm((p) => ({ ...p, roll_number: e.target.value }))}
                    placeholder="2021CS001"
                    required
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">Gender</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, gender: g }))}
                      className={`py-1.5 rounded border text-xs font-medium transition ${
                        form.gender === g
                          ? 'bg-[#FAF9F6] border-[#26415C] text-[#26415C]'
                          : 'bg-white border-[#E4E1DA] text-[#5B6472] hover:bg-[#FAF9F6]'
                      }`}
                    >
                      {g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Other'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department & Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">Department</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                    placeholder="Computer Science"
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">Academic year</label>
                  <select
                    value={form.year}
                    onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  >
                    <option value="">Select year</option>
                    {[1, 2, 3, 4, 5, 6].map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Hostel & Room */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">Hostel</label>
                  <select
                    value={form.hostel_id}
                    onChange={(e) => setForm((p) => ({ ...p, hostel_id: e.target.value, room_id: '' }))}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  >
                    <option value="">Select hostel</option>
                    {hostels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.code} — {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">Room</label>
                  <select
                    value={form.room_id}
                    onChange={(e) => setForm((p) => ({ ...p, room_id: e.target.value }))}
                    required
                    disabled={!form.hostel_id}
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition disabled:opacity-50"
                  >
                    <option value="">Select room</option>
                    {availableRooms.map((r) => (
                      <option key={r.id} value={r.id} disabled={r._count.students >= r.capacity}>
                        {r.room_number} (Floor {r.floor}
                        {r.block ? `, Block ${r.block}` : ''}) — {r._count.students}/{r.capacity}
                        {r._count.students >= r.capacity ? ' [FULL]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Operational State Correction & Override Reason */}
              {modal === 'edit' && (
                <div className="p-3.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded-lg space-y-3">
                  <div className="text-xs font-medium text-[#26415C] flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Operational state correction (gate status override)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#5B6472] mb-1">Student status</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['INSIDE', 'OUTSIDE'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, current_state: st }))}
                            className={`py-1.5 px-2.5 rounded text-xs font-medium border transition ${
                              form.current_state === st
                                ? st === 'INSIDE'
                                  ? 'bg-[#2E7D5B]/10 border-[#2E7D5B] text-[#2E7D5B]'
                                  : 'bg-[#B7791F]/10 border-[#B7791F] text-[#B7791F]'
                                : 'bg-white border-[#E4E1DA] text-[#5B6472]'
                            }`}
                          >
                            {st === 'INSIDE' ? 'Inside hostel' : 'Outside'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5B6472] mb-1">
                        Correction reason (audit log)
                      </label>
                      <input
                        type="text"
                        value={form.reason}
                        onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                        placeholder="e.g. Scanner missed checkout / authorized leave"
                        className="w-full px-3 py-1.5 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => {
                    setModal(null);
                    setEditStudent(null);
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
                  {isSubmitting ? 'Saving...' : modal === 'edit' ? 'Update student' : 'Register student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

