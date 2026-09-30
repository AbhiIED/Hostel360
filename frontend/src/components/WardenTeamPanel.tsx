import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  UserX,
} from 'lucide-react';

interface WardenTeamPanelProps {
  hostelId?: string;
}

export const WardenTeamPanel: React.FC<WardenTeamPanelProps> = ({ hostelId }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'nominations'>('members');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [nominations, setNominations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Nominate Modal State
  const [showNominateModal, setShowNominateModal] = useState<boolean>(false);
  const [nominateForm, setNominateForm] = useState({
    name: '',
    email: '',
    phone: '',
    employee_id: '',
    role: 'CARETAKER',
    hostel_id: hostelId || '',
  });

  // End Assignment Modal State
  const [endingAssignment, setEndingAssignment] = useState<any | null>(null);
  const [endReason, setEndReason] = useState<string>('');

  const assignedHostels = (user?.staff_hostel_assignments || [])
    .filter((a: any) => !a.end_date)
    .map((a: any) => a.hostel)
    .filter(Boolean);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [membersRes, nomsRes] = await Promise.all([
        api.get('/staff/assignments', {
          params: { type: 'hostel', status: 'active', hostel_id: hostelId || undefined },
        }),
        api.get('/staff/nominations', {
          params: { hostel_id: hostelId || undefined },
        }),
      ]);

      const members = (membersRes.data.hostel_assignments || []).filter(
        (m: any) => m.role === 'VICE_WARDEN' || m.role === 'CARETAKER'
      );

      setTeamMembers(members);
      setNominations(nomsRes.data.nominations || []);
    } catch (err: any) {
      console.error('Error fetching warden team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hostelId]);

  useEffect(() => {
    if (hostelId) {
      setNominateForm((prev) => ({ ...prev, hostel_id: hostelId }));
    } else if (assignedHostels.length > 0 && !nominateForm.hostel_id) {
      setNominateForm((prev) => ({ ...prev, hostel_id: assignedHostels[0].id }));
    }
  }, [hostelId, assignedHostels.length]);

  const handleNominateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setMessage(null);
      await api.post('/staff/nominations', nominateForm);
      setMessage({
        type: 'success',
        text: `Nomination for ${nominateForm.name} as ${nominateForm.role} submitted to Super Admin for approval.`,
      });
      setShowNominateModal(false);
      setNominateForm({
        name: '',
        email: '',
        phone: '',
        employee_id: '',
        role: 'CARETAKER',
        hostel_id: hostelId || (assignedHostels[0]?.id || ''),
      });
      fetchData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to submit staff nomination.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndAssignment = async () => {
    if (!endingAssignment) return;
    try {
      setActionLoading(true);
      setMessage(null);
      await api.post(`/staff/assignments/hostel/${endingAssignment.id}/end`, {
        end_reason: endReason || 'Assignment ended by Warden',
      });

      setMessage({
        type: 'success',
        text: `Assignment for ${endingAssignment.user?.name} (${endingAssignment.role}) ended immediately and active sessions revoked.`,
      });
      setEndingAssignment(null);
      setEndReason('');
      fetchData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to end staff assignment.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 shadow-sm space-y-5">
      {/* Header with Title and Nominate Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E4E1DA]">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#26415C]" />
            <h2 className="font-serif text-lg font-medium text-[#1C2430]">
              My Team Management
            </h2>
          </div>
          <p className="text-xs text-[#5B6472] mt-0.5">
            Operational oversight of Vice Wardens and Caretakers assigned to your hostel(s).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNominateModal(true)}
            className="px-3.5 py-1.5 bg-[#26415C] hover:bg-[#1B2E42] text-white rounded text-xs font-medium transition shadow-sm flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Nominate Staff Member</span>
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 border border-[#E4E1DA] hover:bg-[#FAF9F6] rounded text-[#5B6472] transition"
            title="Refresh team data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alert Messages */}
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

      {/* Tabs */}
      <div className="flex border-b border-[#E4E1DA] text-xs">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-2.5 px-3 font-medium transition border-b-2 ${
            activeTab === 'members'
              ? 'border-[#26415C] text-[#26415C]'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          Active Team Members ({teamMembers.length})
        </button>
        <button
          onClick={() => setActiveTab('nominations')}
          className={`pb-2.5 px-3 font-medium transition border-b-2 ${
            activeTab === 'nominations'
              ? 'border-[#26415C] text-[#26415C]'
              : 'border-transparent text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          Nomination Trackers ({nominations.length})
        </button>
      </div>

      {/* Tab 1: Active Team Members */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {teamMembers.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5B6472]">
              No active Vice Wardens or Caretakers assigned to this hostel.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                    <th className="py-2.5 font-medium">Name & Contact</th>
                    <th className="py-2.5 font-medium">Role</th>
                    <th className="py-2.5 font-medium">Hostel</th>
                    <th className="py-2.5 font-medium">Employee ID</th>
                    <th className="py-2.5 font-medium">Assigned Since</th>
                    <th className="py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E1DA]">
                  {teamMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-[#FAF9F6] transition">
                      <td className="py-3">
                        <div className="font-medium text-[#1C2430]">{member.user?.name}</div>
                        <div className="text-[11px] text-[#5B6472]">{member.user?.email}</div>
                        {member.user?.phone && (
                          <div className="text-[11px] text-[#5B6472]">{member.user?.phone}</div>
                        )}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            member.role === 'VICE_WARDEN'
                              ? 'bg-[#E0F2FE] text-[#0369A1]'
                              : 'bg-[#F3F4F6] text-[#374151]'
                          }`}
                        >
                          {member.role}
                        </span>
                      </td>
                      <td className="py-3 text-[#1C2430]">
                        <span className="font-medium">{member.hostel?.name}</span>{' '}
                        <span className="text-[#5B6472]">({member.hostel?.code})</span>
                      </td>
                      <td className="py-3 font-mono text-[#5B6472]">
                        {member.user?.employee_id || '—'}
                      </td>
                      <td className="py-3 text-[#5B6472]">
                        {new Date(member.assigned_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setEndingAssignment(member)}
                          className="px-2.5 py-1 text-xs border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2] rounded font-medium transition flex items-center gap-1 ml-auto"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>End Assignment</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Nominations Trackers */}
      {activeTab === 'nominations' && (
        <div className="space-y-4">
          {nominations.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5B6472]">
              No past nominations recorded. Click "Nominate Staff Member" to nominate a team member.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                    <th className="py-2.5 font-medium">Nominee Details</th>
                    <th className="py-2.5 font-medium">Role & Hostel</th>
                    <th className="py-2.5 font-medium">Submission Date</th>
                    <th className="py-2.5 font-medium">Status</th>
                    <th className="py-2.5 font-medium">Admin Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E1DA]">
                  {nominations.map((nom) => (
                    <tr key={nom.id} className="hover:bg-[#FAF9F6] transition">
                      <td className="py-3">
                        <div className="font-medium text-[#1C2430]">{nom.name}</div>
                        <div className="text-[11px] text-[#5B6472]">{nom.email}</div>
                        <div className="text-[11px] font-mono text-[#5B6472]">
                          EMP: {nom.employee_id}
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="font-semibold text-[#1C2430] block">{nom.role}</span>
                        <span className="text-[11px] text-[#5B6472]">
                          {nom.hostel?.name} ({nom.hostel?.code})
                        </span>
                      </td>
                      <td className="py-3 text-[#5B6472]">
                        {new Date(nom.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
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
                        {nom.invite && (
                          <span className="block text-[10px] text-[#5B6472] mt-0.5">
                            Invite: {nom.invite.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {nom.review_note ? (
                          <div className="p-2 bg-[#FEF2F2] border border-[#FECACA] rounded text-[11px] text-[#991B1B]">
                            <span className="font-semibold block mb-0.5">Super Admin Note:</span>
                            <span>{nom.review_note}</span>
                          </div>
                        ) : nom.status === 'APPROVED' ? (
                          <span className="text-[11px] text-[#2E7D5B] font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approved by Admin
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#5B6472] italic">
                            Pending Super Admin review
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

      {/* Nominate Staff Modal */}
      {showNominateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-[#E4E1DA] shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
              <h3 className="text-sm font-semibold text-[#1C2430]">
                Nominate Staff Member (Vice Warden / Caretaker)
              </h3>
              <button
                onClick={() => setShowNominateModal(false)}
                className="text-[#5B6472] hover:text-[#1C2430]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleNominateSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                  Target Assigned Hostel
                </label>
                <select
                  value={nominateForm.hostel_id}
                  onChange={(e) => setNominateForm({ ...nominateForm, hostel_id: e.target.value })}
                  required
                  className="w-full p-2 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                >
                  {assignedHostels.map((h: any) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-[#5B6472] mt-0.5 block">
                  Limited to your active assigned hostels.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                  Nomination Role
                </label>
                <select
                  value={nominateForm.role}
                  onChange={(e) => setNominateForm({ ...nominateForm, role: e.target.value })}
                  className="w-full p-2 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                >
                  <option value="CARETAKER">Caretaker (Gate logs, day-to-day operations)</option>
                  <option value="VICE_WARDEN">Vice Warden (Deputy administrative oversight)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                  Nominee Full Name
                </label>
                <input
                  type="text"
                  value={nominateForm.name}
                  onChange={(e) => setNominateForm({ ...nominateForm, name: e.target.value })}
                  required
                  placeholder="e.g. Ramesh Chandra Sharma"
                  className="w-full p-2 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={nominateForm.email}
                    onChange={(e) => setNominateForm({ ...nominateForm, email: e.target.value })}
                    required
                    placeholder="nominee@manit.ac.in"
                    className="w-full p-2 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={nominateForm.employee_id}
                    onChange={(e) => setNominateForm({ ...nominateForm, employee_id: e.target.value })}
                    required
                    placeholder="EMP-8021"
                    className="w-full p-2 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  value={nominateForm.phone}
                  onChange={(e) => setNominateForm({ ...nominateForm, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full p-2 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                />
              </div>

              <div className="mt-5 pt-3 border-t border-[#E4E1DA] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNominateModal(false)}
                  className="px-3 py-1.5 rounded border border-[#D5D2CA] text-[#5B6472] hover:bg-[#FAF9F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded bg-[#26415C] hover:bg-[#1B2E42] text-white font-medium disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Submit Nomination</span>
                </button>
              </div>
            </form>
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
                <span>Confirm End of Assignment</span>
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
                Are you sure you want to end the assignment for{' '}
                <strong>{endingAssignment.user?.name}</strong> as{' '}
                <strong>{endingAssignment.role}</strong> of{' '}
                <strong>{endingAssignment.hostel?.name}</strong>?
              </p>

              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-[11px] text-[#991B1B]">
                <strong>Immediate Revocation Notice:</strong> This action takes effect immediately. All active login sessions and refresh tokens for this user will be revoked immediately without waiting for token expiry.
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                  End Reason / Offboarding Note
                </label>
                <textarea
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  placeholder="e.g. End of tenure, transfer to other duties, resignation"
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
                onClick={handleEndAssignment}
                disabled={actionLoading}
                className="px-4 py-1.5 rounded bg-[#B91C1C] hover:bg-[#991B1B] text-white font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>End Assignment Immediately</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardenTeamPanel;
