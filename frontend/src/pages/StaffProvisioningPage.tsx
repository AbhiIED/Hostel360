import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  Utensils,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  X,
  UserX,
  Clock,
  Layers,
  Search,
} from 'lucide-react';

export const StaffProvisioningPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'provision' | 'nominations' | 'directory' | 'invites'>('provision');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reference Data
  const [hostels, setHostels] = useState<any[]>([]);
  const [messes, setMesses] = useState<any[]>([]);

  // Direct Provision Form State (Warden / Mess Admin)
  const [provisionForm, setProvisionForm] = useState({
    name: '',
    email: '',
    phone: '',
    employee_id: '',
    role: 'WARDEN',
    target_hostel_ids: [] as string[],
    target_mess_ids: [] as string[],
  });
  const [generatedInvite, setGeneratedInvite] = useState<{ invite: any; token: string; accept_url: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Nominations State
  const [nominations, setNominations] = useState<any[]>([]);
  const [selectedNomination, setSelectedNomination] = useState<any | null>(null);
  const [rejectNote, setRejectNote] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);

  // Directory State
  const [assignments, setAssignments] = useState<{
    hostel_assignments: any[];
    mess_assignments: any[];
    total_active_hostel: number;
    total_active_mess: number;
  }>({
    hostel_assignments: [],
    mess_assignments: [],
    total_active_hostel: 0,
    total_active_mess: 0,
  });
  const [directoryStatusFilter, setDirectoryStatusFilter] = useState<'all' | 'active' | 'ended'>('active');
  const [directoryRoleFilter, setDirectoryRoleFilter] = useState<string>('');
  const [directorySearch, setDirectorySearch] = useState<string>('');

  // End Assignment Modal State
  const [endingAssignment, setEndingAssignment] = useState<{
    id: string;
    type: 'hostel' | 'mess';
    userName: string;
    role: string;
    placeName: string;
  } | null>(null);
  const [endReason, setEndReason] = useState<string>('');

  // Invites State
  const [invites, setInvites] = useState<any[]>([]);

  const fetchReferenceData = async () => {
    try {
      const [hostRes, messRes] = await Promise.all([
        api.get('/hostels'),
        api.get('/messes'),
      ]);
      setHostels(hostRes.data.hostels || []);
      setMesses(messRes.data.messes || []);
    } catch (err: any) {
      console.error('Error fetching reference hostels/messes:', err);
    }
  };

  const fetchNominations = async () => {
    try {
      const res = await api.get('/staff/nominations');
      setNominations(res.data.nominations || []);
    } catch (err: any) {
      console.error('Error fetching nominations:', err);
    }
  };

  const fetchDirectory = async () => {
    try {
      const res = await api.get('/staff/assignments', {
        params: {
          status: directoryStatusFilter,
          role: directoryRoleFilter || undefined,
        },
      });
      setAssignments(res.data);
    } catch (err: any) {
      console.error('Error fetching staff directory:', err);
    }
  };

  const fetchInvites = async () => {
    try {
      const res = await api.get('/staff/invites');
      setInvites(res.data.invites || []);
    } catch (err: any) {
      console.error('Error fetching staff invites:', err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchReferenceData(), fetchNominations(), fetchDirectory(), fetchInvites()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (activeTab === 'directory') {
      fetchDirectory();
    } else if (activeTab === 'nominations') {
      fetchNominations();
    } else if (activeTab === 'invites') {
      fetchInvites();
    }
  }, [activeTab, directoryStatusFilter, directoryRoleFilter]);

  // Handle direct provisioning submit
  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setMessage(null);
      setGeneratedInvite(null);

      const res = await api.post('/staff/invites', provisionForm);
      setGeneratedInvite({
        invite: res.data.invite,
        token: res.data.token,
        accept_url: res.data.accept_url,
      });

      setMessage({
        type: 'success',
        text: `Official invitation created for ${provisionForm.name} as ${provisionForm.role}. Send the activation link below.`,
      });

      setProvisionForm({
        name: '',
        email: '',
        phone: '',
        employee_id: '',
        role: 'WARDEN',
        target_hostel_ids: [],
        target_mess_ids: [],
      });

      fetchInvites();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to provision staff invitation.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle nomination approval
  const handleApproveNomination = async (id: string) => {
    try {
      setActionLoading(true);
      setMessage(null);
      const res = await api.post(`/staff/nominations/${id}/approve`);
      setMessage({
        type: 'success',
        text: res.data.message || 'Nomination approved and staff invitation generated.',
      });
      fetchNominations();
      fetchInvites();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to approve nomination.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle nomination rejection
  const handleRejectNomination = async () => {
    if (!selectedNomination || !rejectNote.trim()) return;
    try {
      setActionLoading(true);
      setMessage(null);
      await api.post(`/staff/nominations/${selectedNomination.id}/reject`, {
        review_note: rejectNote.trim(),
      });
      setMessage({
        type: 'success',
        text: `Nomination for ${selectedNomination.name} rejected. Note recorded for nominating Warden.`,
      });
      setShowRejectModal(false);
      setSelectedNomination(null);
      setRejectNote('');
      fetchNominations();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to reject nomination.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle regenerate invite
  const handleRegenerateInvite = async (inviteId: string) => {
    try {
      setActionLoading(true);
      setMessage(null);
      const res = await api.post(`/staff/invites/${inviteId}/regenerate`);
      setMessage({
        type: 'success',
        text: `Fresh activation link generated for ${res.data.invite.name} (${res.data.invite.email}). Link valid for 72 hours.`,
      });
      fetchInvites();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to regenerate invitation.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle end assignment
  const handleConfirmEndAssignment = async () => {
    if (!endingAssignment) return;
    try {
      setActionLoading(true);
      setMessage(null);
      const endpoint =
        endingAssignment.type === 'hostel'
          ? `/staff/assignments/hostel/${endingAssignment.id}/end`
          : `/staff/assignments/mess/${endingAssignment.id}/end`;

      await api.post(endpoint, {
        end_reason: endReason || 'Assignment ended by Super Admin',
      });

      setMessage({
        type: 'success',
        text: `Assignment for ${endingAssignment.userName} ended and active sessions revoked immediately.`,
      });
      setEndingAssignment(null);
      setEndReason('');
      fetchDirectory();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to end staff assignment.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    const fullUrl = `${window.location.origin}${text}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const pendingNominationsCount = nominations.filter((n) => n.status === 'PENDING').length;

  // Filter directory items
  const allHostelAssignments = (assignments.hostel_assignments || []).filter((item) => {
    if (!directorySearch) return true;
    const q = directorySearch.toLowerCase();
    return (
      item.user?.name?.toLowerCase().includes(q) ||
      item.user?.email?.toLowerCase().includes(q) ||
      item.hostel?.name?.toLowerCase().includes(q) ||
      item.hostel?.code?.toLowerCase().includes(q) ||
      item.user?.employee_id?.toLowerCase().includes(q)
    );
  });

  const allMessAssignments = (assignments.mess_assignments || []).filter((item) => {
    if (!directorySearch) return true;
    const q = directorySearch.toLowerCase();
    return (
      item.user?.name?.toLowerCase().includes(q) ||
      item.user?.email?.toLowerCase().includes(q) ||
      item.mess?.name?.toLowerCase().includes(q) ||
      item.user?.employee_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#26415C]" />
            <h1 className="font-serif text-2xl font-normal text-[#1C2430]">
              Staff Provisioning & Governance
            </h1>
          </div>
          <p className="text-xs text-[#5B6472] mt-1">
            Central appointment for Wardens and Mess Admins, approval queue for Warden nominations, and complete staff directory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            disabled={loading}
            className="px-3 py-1.5 border border-[#E4E1DA] hover:bg-[#FAF9F6] rounded text-xs text-[#5B6472] transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Alert Messages */}
      {message && (
        <div
          className={`p-3 rounded border text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-semibold underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#E4E1DA] text-xs">
        <button
          onClick={() => setActiveTab('provision')}
          className={`pb-2.5 px-4 font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'provision'
              ? 'border-[#26415C] text-[#26415C]'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Direct Provisioning (Warden / Mess Admin)</span>
        </button>

        <button
          onClick={() => setActiveTab('nominations')}
          className={`pb-2.5 px-4 font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'nominations'
              ? 'border-[#26415C] text-[#26415C]'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Pending Nominations</span>
          {pendingNominationsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#B91C1C] text-white text-[10px] font-bold">
              {pendingNominationsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`pb-2.5 px-4 font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'directory'
              ? 'border-[#26415C] text-[#26415C]'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Active Staff Directory</span>
        </button>

        <button
          onClick={() => setActiveTab('invites')}
          className={`pb-2.5 px-4 font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === 'invites'
              ? 'border-[#26415C] text-[#26415C]'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Invitations & Tokens ({invites.length})</span>
        </button>
      </div>

      {/* Tab 1: Direct Provisioning */}
      {activeTab === 'provision' && (
        <div className="space-y-6">
          <div className="bg-[#FAF9F6] border border-[#E4E1DA] rounded-lg p-4 text-xs text-[#5B6472] space-y-1">
            <span className="font-semibold text-[#1C2430] block">Institutional Provisioning Rules:</span>
            <p>
              • <strong>Warden</strong> and <strong>Mess Admin</strong> accounts are direct institutional appointments created exclusively by Super Admin.
            </p>
            <p>
              • <strong>Vice Warden</strong> and <strong>Caretaker</strong> accounts must be nominated by the respective Warden via their console, then approved here in the Nominations queue.
            </p>
          </div>

          {/* Generated Invite Card */}
          {generatedInvite && (
            <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#166534]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Invitation Ready for Dispatch</span>
              </div>
              <p className="text-[#166534]">
                Appointee: <strong>{generatedInvite.invite.name}</strong> ({generatedInvite.invite.email}) • Role: <strong>{generatedInvite.invite.role}</strong>
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}${generatedInvite.accept_url}`}
                  className="flex-1 p-2 bg-white border border-[#BBF7D0] rounded font-mono text-[11px] text-[#166534]"
                />
                <button
                  onClick={() => copyToClipboard(generatedInvite.accept_url)}
                  className="px-3 py-2 bg-[#2E7D5B] hover:bg-[#25664A] text-white rounded font-medium transition flex items-center gap-1.5 shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Activation Link'}</span>
                </button>
              </div>
              <span className="text-[10px] text-[#166534] block">
                Link expires in 72 hours. Appointee will set their own secure password upon clicking.
              </span>
            </div>
          )}

          {/* Provisioning Form */}
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 shadow-sm">
            <form onSubmit={handleProvisionSubmit} className="space-y-4 text-xs">
              <h3 className="font-serif text-sm font-semibold text-[#1C2430]">
                Create Appointment & Issue Invitation
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                    Appointment Role
                  </label>
                  <select
                    value={provisionForm.role}
                    onChange={(e) =>
                      setProvisionForm({
                        ...provisionForm,
                        role: e.target.value,
                        target_hostel_ids: [],
                        target_mess_ids: [],
                      })
                    }
                    className="w-full p-2.5 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  >
                    <option value="WARDEN">Hostel Warden (Full Hostel Governance)</option>
                    <option value="MESS_ADMIN">Mess Admin (Dining & Meal Window Operations)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                    Employee ID / Faculty Code
                  </label>
                  <input
                    type="text"
                    value={provisionForm.employee_id}
                    onChange={(e) => setProvisionForm({ ...provisionForm, employee_id: e.target.value })}
                    required
                    placeholder="e.g. FAC-2041 or EMP-901"
                    className="w-full p-2.5 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                    Appointee Full Name
                  </label>
                  <input
                    type="text"
                    value={provisionForm.name}
                    onChange={(e) => setProvisionForm({ ...provisionForm, name: e.target.value })}
                    required
                    placeholder="Dr. Anand Vardhan"
                    className="w-full p-2.5 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                    Official Email Address
                  </label>
                  <input
                    type="email"
                    value={provisionForm.email}
                    onChange={(e) => setProvisionForm({ ...provisionForm, email: e.target.value })}
                    required
                    placeholder="appointee@manit.ac.in"
                    className="w-full p-2.5 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={provisionForm.phone}
                    onChange={(e) => setProvisionForm({ ...provisionForm, phone: e.target.value })}
                    placeholder="+91 9826012345"
                    className="w-full p-2.5 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>

                {/* Target Hostel Selector for Warden */}
                {provisionForm.role === 'WARDEN' && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-[11px] font-medium text-[#5B6472]">
                      Assigned Hostels (Select one or multiple)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded max-h-48 overflow-y-auto">
                      {hostels.map((h) => {
                        const isChecked = provisionForm.target_hostel_ids.includes(h.id);
                        return (
                          <label key={h.id} className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setProvisionForm({
                                    ...provisionForm,
                                    target_hostel_ids: [...provisionForm.target_hostel_ids, h.id],
                                  });
                                } else {
                                  setProvisionForm({
                                    ...provisionForm,
                                    target_hostel_ids: provisionForm.target_hostel_ids.filter((id) => id !== h.id),
                                  });
                                }
                              }}
                              className="rounded text-[#26415C]"
                            />
                            <span className="font-medium text-[#1C2430]">{h.name}</span>
                            <span className="text-[10px] text-[#5B6472]">({h.code})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Target Mess Selector for Mess Admin */}
                {provisionForm.role === 'MESS_ADMIN' && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-[11px] font-medium text-[#5B6472]">
                      Assigned Dining Messes (Select one or multiple)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded max-h-48 overflow-y-auto">
                      {messes.map((m) => {
                        const isChecked = provisionForm.target_mess_ids.includes(m.id);
                        return (
                          <label key={m.id} className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setProvisionForm({
                                    ...provisionForm,
                                    target_mess_ids: [...provisionForm.target_mess_ids, m.id],
                                  });
                                } else {
                                  setProvisionForm({
                                    ...provisionForm,
                                    target_mess_ids: provisionForm.target_mess_ids.filter((id) => id !== m.id),
                                  });
                                }
                              }}
                              className="rounded text-[#26415C]"
                            />
                            <span className="font-medium text-[#1C2430]">{m.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-[#E4E1DA]">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-[#26415C] hover:bg-[#1B2E42] text-white rounded font-medium transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Generate Official Invitation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Nominations Review Queue */}
      {activeTab === 'nominations' && (
        <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
            <div>
              <h3 className="font-serif text-base font-semibold text-[#1C2430]">
                Warden Nominations Queue
              </h3>
              <p className="text-xs text-[#5B6472]">
                Vice Warden and Caretaker candidates nominated by Wardens awaiting Super Admin security review.
              </p>
            </div>
            <span className="text-xs text-[#5B6472]">
              {pendingNominationsCount} pending review
            </span>
          </div>

          {nominations.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5B6472]">
              No nominations submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                    <th className="py-2.5 font-medium">Nominee Details</th>
                    <th className="py-2.5 font-medium">Proposed Role</th>
                    <th className="py-2.5 font-medium">Target Hostel</th>
                    <th className="py-2.5 font-medium">Nominating Warden</th>
                    <th className="py-2.5 font-medium">Status</th>
                    <th className="py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E1DA]">
                  {nominations.map((nom) => (
                    <tr key={nom.id} className="hover:bg-[#FAF9F6] transition">
                      <td className="py-3">
                        <div className="font-medium text-[#1C2430]">{nom.name}</div>
                        <div className="text-[11px] text-[#5B6472]">{nom.email}</div>
                        <div className="text-[11px] font-mono text-[#5B6472]">EMP: {nom.employee_id}</div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            nom.role === 'VICE_WARDEN'
                              ? 'bg-[#E0F2FE] text-[#0369A1]'
                              : 'bg-[#F3F4F6] text-[#374151]'
                          }`}
                        >
                          {nom.role}
                        </span>
                      </td>
                      <td className="py-3 text-[#1C2430]">
                        <span className="font-medium">{nom.hostel?.name}</span>{' '}
                        <span className="text-[#5B6472]">({nom.hostel?.code})</span>
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-[#1C2430]">{nom.nominator?.name}</div>
                        <div className="text-[11px] text-[#5B6472]">{nom.nominator?.email}</div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            nom.status === 'APPROVED'
                              ? 'bg-[#2E7D5B] text-white'
                              : nom.status === 'REJECTED'
                              ? 'bg-[#B91C1C] text-white'
                              : 'bg-[#FEF08A] text-[#854D0E]'
                          }`}
                        >
                          {nom.status}
                        </span>
                        {nom.review_note && (
                          <span className="block text-[10px] text-[#B91C1C] mt-0.5">
                            Note: {nom.review_note}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {nom.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedNomination(nom);
                                setShowRejectModal(true);
                              }}
                              className="px-2.5 py-1 text-xs border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2] rounded font-medium transition"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleApproveNomination(nom.id)}
                              disabled={actionLoading}
                              className="px-3 py-1 text-xs bg-[#2E7D5B] hover:bg-[#25664A] text-white rounded font-medium transition flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#5B6472]">Decided</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Active Staff Directory */}
      {activeTab === 'directory' && (
        <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E1DA]">
            <div>
              <h3 className="font-serif text-base font-semibold text-[#1C2430]">
                Campus Staff Assignments Directory
              </h3>
              <p className="text-xs text-[#5B6472]">
                Active and historical assignments for Wardens, Vice Wardens, Caretakers, and Mess Managers.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <input
                  type="text"
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Search staff, hostel..."
                  className="pl-7 pr-3 py-1.5 border border-[#D5D2CA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                />
                <Search className="w-3.5 h-3.5 text-[#5B6472] absolute left-2 top-2 pointer-events-none" />
              </div>

              <select
                value={directoryStatusFilter}
                onChange={(e: any) => setDirectoryStatusFilter(e.target.value)}
                className="p-1.5 border border-[#D5D2CA] rounded text-[#1C2430]"
              >
                <option value="active">Active Only</option>
                <option value="ended">Ended Only</option>
                <option value="all">All Assignments</option>
              </select>

              <select
                value={directoryRoleFilter}
                onChange={(e) => setDirectoryRoleFilter(e.target.value)}
                className="p-1.5 border border-[#D5D2CA] rounded text-[#1C2430]"
              >
                <option value="">All Roles</option>
                <option value="WARDEN">Warden</option>
                <option value="VICE_WARDEN">Vice Warden</option>
                <option value="CARETAKER">Caretaker</option>
                <option value="MESS_ADMIN">Mess Admin</option>
              </select>
            </div>
          </div>

          {/* Hostel Assignments Table */}
          <div className="space-y-2">
            <span className="font-semibold text-xs text-[#1C2430] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#26415C]" />
              <span>Hostel Staff Assignments ({allHostelAssignments.length})</span>
            </span>

            {allHostelAssignments.length === 0 ? (
              <p className="py-4 text-xs text-[#5B6472] italic">No hostel assignments matching filter.</p>
            ) : (
              <div className="overflow-x-auto border border-[#E4E1DA] rounded">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#FAF9F6] border-b border-[#E4E1DA] text-[#5B6472]">
                      <th className="py-2.5 px-3 font-medium">Staff Member</th>
                      <th className="py-2.5 px-3 font-medium">Role</th>
                      <th className="py-2.5 px-3 font-medium">Hostel</th>
                      <th className="py-2.5 px-3 font-medium">Assigned By</th>
                      <th className="py-2.5 px-3 font-medium">Status / End Date</th>
                      <th className="py-2.5 px-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E1DA]">
                    {allHostelAssignments.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FAF9F6] transition">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-[#1C2430]">{item.user?.name}</div>
                          <div className="text-[11px] text-[#5B6472]">{item.user?.email}</div>
                          {item.user?.employee_id && (
                            <div className="text-[10px] font-mono text-[#5B6472]">EMP: {item.user.employee_id}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.role === 'WARDEN'
                                ? 'bg-[#26415C] text-white'
                                : item.role === 'VICE_WARDEN'
                                ? 'bg-[#E0F2FE] text-[#0369A1]'
                                : 'bg-[#F3F4F6] text-[#374151]'
                            }`}
                          >
                            {item.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#1C2430]">
                          <span className="font-medium">{item.hostel?.name}</span>{' '}
                          <span className="text-[#5B6472]">({item.hostel?.code})</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#5B6472]">
                          {item.assigned_by_user?.name || 'System / Cow'}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.end_date ? (
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF2F2] text-[#991B1B]">
                                Ended on {new Date(item.end_date).toLocaleDateString()}
                              </span>
                              {item.end_reason && (
                                <span className="block text-[10px] text-[#5B6472] mt-0.5">
                                  Reason: {item.end_reason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F0FDF4] text-[#166534]">
                              Currently Active
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!item.end_date && (
                            <button
                              onClick={() =>
                                setEndingAssignment({
                                  id: item.id,
                                  type: 'hostel',
                                  userName: item.user?.name,
                                  role: item.role,
                                  placeName: item.hostel?.name,
                                })
                              }
                              className="px-2.5 py-1 text-xs border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2] rounded font-medium transition inline-flex items-center gap-1"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>End Assignment</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mess Assignments Table */}
          <div className="space-y-2 pt-4">
            <span className="font-semibold text-xs text-[#1C2430] flex items-center gap-1.5">
              <Utensils className="w-4 h-4 text-[#26415C]" />
              <span>Mess Staff Assignments ({allMessAssignments.length})</span>
            </span>

            {allMessAssignments.length === 0 ? (
              <p className="py-4 text-xs text-[#5B6472] italic">No mess assignments matching filter.</p>
            ) : (
              <div className="overflow-x-auto border border-[#E4E1DA] rounded">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#FAF9F6] border-b border-[#E4E1DA] text-[#5B6472]">
                      <th className="py-2.5 px-3 font-medium">Staff Member</th>
                      <th className="py-2.5 px-3 font-medium">Role</th>
                      <th className="py-2.5 px-3 font-medium">Dining Hall</th>
                      <th className="py-2.5 px-3 font-medium">Assigned By</th>
                      <th className="py-2.5 px-3 font-medium">Status / End Date</th>
                      <th className="py-2.5 px-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E1DA]">
                    {allMessAssignments.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FAF9F6] transition">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-[#1C2430]">{item.user?.name}</div>
                          <div className="text-[11px] text-[#5B6472]">{item.user?.email}</div>
                          {item.user?.employee_id && (
                            <div className="text-[10px] font-mono text-[#5B6472]">EMP: {item.user.employee_id}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#26415C] text-white">
                            {item.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#1C2430]">
                          {item.mess?.name}
                        </td>
                        <td className="py-2.5 px-3 text-[#5B6472]">
                          {item.assigned_by_user?.name || 'Super Admin'}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.end_date ? (
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF2F2] text-[#991B1B]">
                                Ended on {new Date(item.end_date).toLocaleDateString()}
                              </span>
                              {item.end_reason && (
                                <span className="block text-[10px] text-[#5B6472] mt-0.5">
                                  Reason: {item.end_reason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F0FDF4] text-[#166534]">
                              Currently Active
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!item.end_date && (
                            <button
                              onClick={() =>
                                setEndingAssignment({
                                  id: item.id,
                                  type: 'mess',
                                  userName: item.user?.name,
                                  role: item.role,
                                  placeName: item.mess?.name,
                                })
                              }
                              className="px-2.5 py-1 text-xs border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2] rounded font-medium transition inline-flex items-center gap-1"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>End Assignment</span>
                            </button>
                          )}
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

      {/* Tab 4: Invitations & Token Management */}
      {activeTab === 'invites' && (
        <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
            <div>
              <h3 className="font-serif text-base font-semibold text-[#1C2430]">
                Staff Invitations & Activation Tokens
              </h3>
              <p className="text-xs text-[#5B6472]">
                Monitor one-time token states (72-hour TTL) and regenerate fresh links for expired or pending invites.
              </p>
            </div>
            <span className="text-xs text-[#5B6472]">{invites.length} total invitations</span>
          </div>

          {invites.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5B6472]">
              No invitations created yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                    <th className="py-2.5 font-medium">Invitee Details</th>
                    <th className="py-2.5 font-medium">Appointed Role</th>
                    <th className="py-2.5 font-medium">Source</th>
                    <th className="py-2.5 font-medium">Expires At</th>
                    <th className="py-2.5 font-medium">Status</th>
                    <th className="py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E1DA]">
                  {invites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#FAF9F6] transition">
                      <td className="py-3">
                        <div className="font-medium text-[#1C2430]">{inv.name}</div>
                        <div className="text-[11px] text-[#5B6472]">{inv.email}</div>
                        <div className="text-[10px] font-mono text-[#5B6472]">EMP: {inv.employee_id}</div>
                      </td>
                      <td className="py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#26415C] text-white">
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-3 text-[#5B6472]">
                        {inv.source_nomination ? (
                          <span>Nominated by {inv.source_nomination.nominator?.name}</span>
                        ) : (
                          <span>Super Admin Direct</span>
                        )}
                      </td>
                      <td className="py-3 text-[#5B6472]">
                        {new Date(inv.expires_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            inv.status === 'ACCEPTED'
                              ? 'bg-[#2E7D5B] text-white'
                              : inv.status === 'EXPIRED'
                              ? 'bg-[#B91C1C] text-white'
                              : 'bg-[#FEF08A] text-[#854D0E]'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {inv.status !== 'ACCEPTED' ? (
                          <button
                            onClick={() => handleRegenerateInvite(inv.id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 text-xs border border-[#D5D2CA] hover:bg-[#FAF9F6] rounded font-medium text-[#1C2430] transition inline-flex items-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Regenerate Link</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#2E7D5B] font-medium flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Activated
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reject Nomination Modal */}
      {showRejectModal && selectedNomination && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-[#E4E1DA] shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
              <h3 className="text-sm font-semibold text-[#B91C1C]">
                Reject Staff Nomination
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-[#5B6472] hover:text-[#1C2430]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-[#374151]">
                You are rejecting the nomination of <strong>{selectedNomination.name}</strong> ({selectedNomination.role}) for{' '}
                <strong>{selectedNomination.hostel?.name}</strong>.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                  Rejection Reason / Review Note <span className="text-[#B91C1C]">*</span>
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  required
                  placeholder="Explain why this nomination was rejected (visible to the nominating Warden)..."
                  rows={3}
                  className="w-full p-2 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#E4E1DA] flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 rounded border border-[#D5D2CA] text-[#5B6472] hover:bg-[#FAF9F6]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectNomination}
                disabled={actionLoading || !rejectNote.trim()}
                className="px-4 py-1.5 rounded bg-[#B91C1C] hover:bg-[#991B1B] text-white font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Reject Nomination</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Assignment Modal */}
      {endingAssignment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-[#E4E1DA] shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
              <h3 className="text-sm font-semibold text-[#B91C1C] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>End Staff Assignment</span>
              </h3>
              <button
                onClick={() => setEndingAssignment(null)}
                className="text-[#5B6472] hover:text-[#1C2430]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-[#374151] leading-relaxed">
                Ending assignment for <strong>{endingAssignment.userName}</strong> as{' '}
                <strong>{endingAssignment.role}</strong> ({endingAssignment.placeName}).
              </p>

              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-[11px] text-[#991B1B]">
                <strong>Immediate Token Revocation:</strong> All active refresh tokens for this user will be revoked immediately. If they have no other active assignments across the campus, their console access will be terminated.
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                  Reason for Ending Assignment
                </label>
                <textarea
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  placeholder="e.g. Tenure completion, transfer to different department, termination"
                  rows={2}
                  className="w-full p-2 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#E4E1DA] flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEndingAssignment(null)}
                className="px-3 py-1.5 rounded border border-[#D5D2CA] text-[#5B6472] hover:bg-[#FAF9F6]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEndAssignment}
                disabled={actionLoading}
                className="px-4 py-1.5 rounded bg-[#B91C1C] hover:bg-[#991B1B] text-white font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>End Assignment & Revoke Sessions</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffProvisioningPage;
