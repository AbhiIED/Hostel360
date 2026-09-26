import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  UserCheck,
  Clock,
  Info,
} from 'lucide-react';
import { io } from 'socket.io-client';

export interface LeaveRequest {
  id: string;
  student_id: string;
  hostel_id: string;
  requested_from: string;
  requested_to: string;
  reason: string;
  risk_tier: 'LOW' | 'HIGH';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  caretaker_verified_by?: string | null;
  caretaker_verified_at?: string | null;
  caretaker_note?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  created_at: string;
  student?: {
    roll_number: string;
    user?: {
      name: string;
      email: string;
    };
    room?: {
      room_number: string;
      floor: number;
      block?: string;
    };
    hostel?: {
      name: string;
      code: string;
    };
  };
  decider?: {
    id: string;
    name: string;
    role: string;
  } | null;
  caretaker_verifier?: {
    id: string;
    name: string;
    role: string;
  } | null;
}

interface LeaveRequestsPanelProps {
  hostelId?: string;
  showAllHostels?: boolean;
}

export const LeaveRequestsPanel: React.FC<LeaveRequestsPanelProps> = ({
  hostelId,
  showAllHostels = false,
}) => {
  const { user } = useAuth();
  const role = user?.role;
  const isCaretaker = role === 'CARETAKER';
  const isWarden = role === 'WARDEN' || role === 'VICE_WARDEN';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  // Default active tab: Warden defaults to HIGH risk queue; Caretaker/Admin default to PENDING
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HIGH_QUEUE' | 'LOW_LOG' | 'ALL'>(
    isWarden ? 'HIGH_QUEUE' : 'PENDING'
  );

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Verification modal state (for Caretaker)
  const [verifyModalTarget, setVerifyModalTarget] = useState<LeaveRequest | null>(null);
  const [verifyCheckId, setVerifyCheckId] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const params: any = {};
      if (hostelId && !showAllHostels) {
        params.hostel_id = hostelId;
      }
      const res = await api.get('/curfew/leave-requests', { params });
      setRequests(res.data.requests || []);
    } catch (err: any) {
      console.error('Failed to load leave requests:', err);
      setError('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  }, [hostelId, showAllHostels]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time socket updates
  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      if (hostelId) {
        socket.emit('join', `hostel:${hostelId}`);
      }
      socket.emit('join', 'admin:feed');
    });

    socket.on('curfew:leave_request:new', (newReq: LeaveRequest) => {
      if (showAllHostels || !hostelId || newReq.hostel_id === hostelId) {
        setRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);
      }
    });

    socket.on('curfew:leave_request:updated', (updated: LeaveRequest) => {
      setRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
      );
    });

    socket.on('curfew:leave_request:verified', (verified: LeaveRequest) => {
      setRequests((prev) =>
        prev.map((r) => (r.id === verified.id ? { ...r, ...verified } : r))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [hostelId, showAllHostels]);

  // Approve or Reject decision
  const handleUpdateStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoadingId(id);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.patch(`/curfew/leave-requests/${id}/status`, { status });
      setSuccessMsg(`Leave request ${status.toLowerCase()} successfully`);
      fetchRequests();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${status.toLowerCase()} leave request`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Submit Caretaker Verification for HIGH-tier request
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyModalTarget) return;

    if (!verifyCheckId) {
      setError('Please check the confirmation box verifying student identity');
      return;
    }

    setVerifySubmitting(true);
    setError(null);

    try {
      await api.patch(`/curfew/leave-requests/${verifyModalTarget.id}/verify`, {
        note: verifyNote.trim(),
      });
      setSuccessMsg(`Caretaker verification recorded for ${verifyModalTarget.student?.user?.name || 'resident'}`);
      setVerifyModalTarget(null);
      setVerifyNote('');
      setVerifyCheckId(false);
      fetchRequests();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit caretaker verification');
    } finally {
      setVerifySubmitting(false);
    }
  };

  // Filter requests based on active tab
  const filteredRequests = requests.filter((req) => {
    if (activeTab === 'HIGH_QUEUE') {
      return req.risk_tier === 'HIGH' && req.status === 'PENDING';
    }
    if (activeTab === 'LOW_LOG') {
      return req.risk_tier === 'LOW';
    }
    if (activeTab === 'PENDING') {
      return req.status === 'PENDING';
    }
    return true; // 'ALL'
  });

  const highQueueCount = requests.filter((r) => r.risk_tier === 'HIGH' && r.status === 'PENDING').length;
  const totalPendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#E4E1DA] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#1D4ED8]">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-medium text-[#1C2430]">
                Leave Requests (Tiered Out-Pass)
              </h2>
              {totalPendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] tabular-nums">
                  {totalPendingCount} PENDING
                </span>
              )}
            </div>
            <p className="text-xs text-[#5B6472] mt-0.5">
              {isCaretaker && 'Low-risk requests are approved directly by Caretaker. High-risk requests require your identity verification before Warden approval.'}
              {isWarden && 'High-risk requests require Warden decision. Low-risk requests are auto-managed by Caretakers and logged here for oversight.'}
              {isSuperAdmin && 'Risk-tiered leave approvals: LOW risk (<8h, daytime) vs HIGH risk (overnight / curfew overlap).'}
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
          {isWarden ? (
            <>
              <button
                onClick={() => setActiveTab('HIGH_QUEUE')}
                className={`px-3 py-1.5 rounded transition whitespace-nowrap ${
                  activeTab === 'HIGH_QUEUE'
                    ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                    : 'text-[#5B6472] hover:text-[#1C2430]'
                }`}
              >
                High-risk queue ({highQueueCount})
              </button>
              <button
                onClick={() => setActiveTab('LOW_LOG')}
                className={`px-3 py-1.5 rounded transition whitespace-nowrap ${
                  activeTab === 'LOW_LOG'
                    ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                    : 'text-[#5B6472] hover:text-[#1C2430]'
                }`}
              >
                Caretaker-handled log (Low risk)
              </button>
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded transition whitespace-nowrap ${
                  activeTab === 'ALL'
                    ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                    : 'text-[#5B6472] hover:text-[#1C2430]'
                }`}
              >
                All requests
              </button>
            </>
          ) : isCaretaker ? (
            <>
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`px-3 py-1.5 rounded transition whitespace-nowrap ${
                  activeTab === 'PENDING'
                    ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                    : 'text-[#5B6472] hover:text-[#1C2430]'
                }`}
              >
                Pending approvals ({totalPendingCount})
              </button>
              <button
                onClick={() => setActiveTab('HIGH_QUEUE')}
                className={`px-3 py-1.5 rounded transition whitespace-nowrap ${
                  activeTab === 'HIGH_QUEUE'
                    ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                    : 'text-[#5B6472] hover:text-[#1C2430]'
                }`}
              >
                High-risk to verify ({highQueueCount})
              </button>
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded transition whitespace-nowrap ${
                  activeTab === 'ALL'
                    ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                    : 'text-[#5B6472] hover:text-[#1C2430]'
                }`}
              >
                All requests
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`px-3 py-1.5 rounded transition whitespace-nowrap ${
                  activeTab === 'PENDING'
                    ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                    : 'text-[#5B6472] hover:text-[#1C2430]'
                }`}
              >
                Pending ({totalPendingCount})
              </button>
              <button
                onClick={() => setActiveTab('HIGH_QUEUE')}
                className={`px-3 py-1.5 rounded transition whitespace-nowrap ${
                  activeTab === 'HIGH_QUEUE'
                    ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                    : 'text-[#5B6472] hover:text-[#1C2430]'
                }`}
              >
                High-risk queue ({highQueueCount})
              </button>
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded transition whitespace-nowrap ${
                  activeTab === 'ALL'
                    ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                    : 'text-[#5B6472] hover:text-[#1C2430]'
                }`}
              >
                All
              </button>
            </>
          )}

          <button
            onClick={fetchRequests}
            className="p-1.5 text-[#5B6472] hover:text-[#1C2430] rounded transition ml-1"
            title="Refresh requests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mb-4 p-2.5 bg-[#DEF7EC] border border-[#84E1BC] text-[#03543F] rounded text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-0.5 hover:opacity-75">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-0.5 hover:opacity-75">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Requests Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#5B6472]">
          Loading leave requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#5B6472]">
          <CheckCircle2 className="w-6 h-6 text-[#2E7D5B] mx-auto mb-2 opacity-70" />
          <span>No leave requests found in this view.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                <th className="py-2.5 font-medium">Resident</th>
                <th className="py-2.5 font-medium">Room</th>
                <th className="py-2.5 font-medium">Tier & Schedule</th>
                <th className="py-2.5 font-medium">Reason</th>
                <th className="py-2.5 font-medium">Verification & Status</th>
                <th className="py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E1DA]">
              {filteredRequests.map((req) => {
                const fromDate = new Date(req.requested_from);
                const toDate = new Date(req.requested_to);
                const fromStr = fromDate.toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const toStr = toDate.toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const isPending = req.status === 'PENDING';
                const isHigh = req.risk_tier === 'HIGH';
                const isVerified = Boolean(req.caretaker_verified_by || req.caretaker_verifier);

                return (
                  <tr key={req.id} className="hover:bg-[#FAF9F6] transition">
                    {/* Resident */}
                    <td className="py-3">
                      <div className="font-medium text-[#1C2430]">
                        {req.student?.user?.name || 'Resident'}
                      </div>
                      <div className="text-[11px] font-mono text-[#5B6472] tabular-nums">
                        {req.student?.roll_number}
                      </div>
                      {req.student?.hostel && (
                        <div className="text-[10px] text-[#5B6472]">
                          {req.student.hostel.code}
                        </div>
                      )}
                    </td>

                    {/* Room */}
                    <td className="py-3 text-[#5B6472]">
                      {req.student?.room?.room_number ? (
                        <span>
                          Room {req.student.room.room_number}{' '}
                          {req.student.room.block ? `(${req.student.room.block})` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Tier & Schedule */}
                    <td className="py-3 font-mono text-[#1C2430] tabular-nums">
                      <div className="mb-1">
                        {isHigh ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                            <ShieldAlert className="w-3 h-3 text-[#B7791F]" />
                            HIGH RISK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                            <ShieldCheck className="w-3 h-3 text-[#1D4ED8]" />
                            LOW RISK
                          </span>
                        )}
                      </div>
                      <div>{fromStr}</div>
                      <div className="text-[11px] text-[#5B6472]">to {toStr}</div>
                    </td>

                    {/* Reason */}
                    <td className="py-3 max-w-xs">
                      <p className="text-xs text-[#1C2430] line-clamp-2" title={req.reason}>
                        {req.reason}
                      </p>
                      {req.caretaker_note && (
                        <div className="mt-1 text-[11px] text-[#26415C] bg-[#F1F5F9] p-1 rounded border border-[#E2E8F0]">
                          <span className="font-medium">Note:</span> {req.caretaker_note}
                        </div>
                      )}
                    </td>

                    {/* Status & Verification */}
                    <td className="py-3">
                      <div className="flex flex-col gap-1 items-start">
                        {/* Status Badge */}
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${
                            req.status === 'PENDING'
                              ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]'
                              : req.status === 'APPROVED'
                              ? 'bg-[#DEF7EC] text-[#03543F] border border-[#84E1BC]'
                              : req.status === 'REJECTED'
                              ? 'bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]'
                              : 'bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]'
                          }`}
                        >
                          {req.status}
                        </span>

                        {/* Caretaker Verification indicator */}
                        {isHigh && (
                          <div className="mt-0.5">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#2E7D5B] font-medium bg-[#DEF7EC] px-1.5 py-0.5 rounded border border-[#84E1BC]">
                                <UserCheck className="w-3 h-3" />
                                Verified: {req.caretaker_verifier?.name || 'Caretaker'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#B7791F] font-medium bg-[#FFFBEB] px-1.5 py-0.5 rounded border border-[#FDE68A]">
                                <Clock className="w-3 h-3" />
                                Pending verification
                              </span>
                            )}
                          </div>
                        )}

                        {/* Decider tag */}
                        {req.decider && (
                          <div className="text-[10px] text-[#5B6472]">
                            Decided: {req.decider.name} ({req.decider.role})
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 text-right">
                      {isPending ? (
                        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1.5">
                          {/* CASE 1: Caretaker on LOW tier -> Direct Approve / Reject */}
                          {isCaretaker && !isHigh && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(req.id, 'APPROVED')}
                                disabled={actionLoadingId === req.id}
                                className="px-2.5 py-1 bg-[#2E7D5B] hover:bg-[#236046] text-white rounded text-xs font-medium transition disabled:opacity-50 inline-flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(req.id, 'REJECTED')}
                                disabled={actionLoadingId === req.id}
                                className="px-2.5 py-1 bg-[#C53030] hover:bg-[#9B2C2C] text-white rounded text-xs font-medium transition disabled:opacity-50 inline-flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {/* CASE 2: Caretaker on HIGH tier -> Verify action only */}
                          {isCaretaker && isHigh && (
                            <div className="flex flex-col items-end gap-1">
                              {!isVerified ? (
                                <button
                                  onClick={() => {
                                    setVerifyModalTarget(req);
                                    setVerifyCheckId(false);
                                    setVerifyNote('');
                                  }}
                                  className="px-2.5 py-1 bg-[#26415C] hover:bg-[#1B2E42] text-white rounded text-xs font-medium transition inline-flex items-center gap-1"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Verify resident</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-[#2E7D5B] font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Verified
                                </span>
                              )}
                              <span className="text-[10px] text-[#B7791F] font-medium bg-[#FFFBEB] px-1.5 py-0.5 rounded border border-[#FDE68A]">
                                Awaiting Warden decision
                              </span>
                            </div>
                          )}

                          {/* CASE 3: Warden on HIGH tier -> Approve / Reject */}
                          {isWarden && isHigh && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(req.id, 'APPROVED')}
                                disabled={actionLoadingId === req.id}
                                className="px-2.5 py-1 bg-[#2E7D5B] hover:bg-[#236046] text-white rounded text-xs font-medium transition disabled:opacity-50 inline-flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(req.id, 'REJECTED')}
                                disabled={actionLoadingId === req.id}
                                className="px-2.5 py-1 bg-[#C53030] hover:bg-[#9B2C2C] text-white rounded text-xs font-medium transition disabled:opacity-50 inline-flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {/* CASE 4: Warden viewing LOW tier (Auto-handled by Caretaker) */}
                          {isWarden && !isHigh && (
                            <span className="text-[11px] text-[#5B6472] italic">
                              Caretaker queue (LOW)
                            </span>
                          )}

                          {/* CASE 5: Super Admin -> Can decide any tier */}
                          {isSuperAdmin && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(req.id, 'APPROVED')}
                                disabled={actionLoadingId === req.id}
                                className="px-2.5 py-1 bg-[#2E7D5B] hover:bg-[#236046] text-white rounded text-xs font-medium transition disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(req.id, 'REJECTED')}
                                disabled={actionLoadingId === req.id}
                                className="px-2.5 py-1 bg-[#C53030] hover:bg-[#9B2C2C] text-white rounded text-xs font-medium transition disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#5B6472]">
                          <span>Processed</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Verification Modal for Caretaker */}
      {verifyModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg border border-[#E4E1DA] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#26415C]" />
                <h3 className="font-serif text-base font-medium text-[#1C2430]">
                  Caretaker Identity Verification
                </h3>
              </div>
              <button
                onClick={() => setVerifyModalTarget(null)}
                className="text-[#5B6472] hover:text-[#1C2430] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resident details card */}
            <div className="bg-[#FAF9F6] p-3 rounded border border-[#E4E1DA] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#5B6472]">Resident:</span>
                <span className="font-medium text-[#1C2430]">
                  {verifyModalTarget.student?.user?.name} ({verifyModalTarget.student?.roll_number})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6472]">Room:</span>
                <span className="text-[#1C2430]">
                  Room {verifyModalTarget.student?.room?.room_number || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6472]">Leave window:</span>
                <span className="font-mono text-[#1C2430]">
                  {new Date(verifyModalTarget.requested_from).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  {' → '}
                  {new Date(verifyModalTarget.requested_to).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6472]">Reason:</span>
                <span className="text-[#1C2430] max-w-[240px] truncate" title={verifyModalTarget.reason}>
                  {verifyModalTarget.reason}
                </span>
              </div>
              <div className="pt-1 border-t border-[#E4E1DA] flex items-center gap-1.5 text-[11px] text-[#B7791F]">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>
                  High-risk tier: This verification records your check for Warden review. Warden makes the final decision.
                </span>
              </div>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded border border-[#E4E1DA] bg-white cursor-pointer hover:bg-[#FAF9F6] transition">
                <input
                  type="checkbox"
                  required
                  checked={verifyCheckId}
                  onChange={(e) => setVerifyCheckId(e.target.checked)}
                  className="mt-0.5 rounded border-[#E4E1DA] text-[#26415C] focus:ring-0"
                />
                <span className="text-[#1C2430] leading-snug">
                  I confirm that I have verified this resident's identity, physical out-pass request, and emergency / parental contact details.
                </span>
              </label>

              <div>
                <label className="block font-medium text-[#1C2430] mb-1">
                  Verification Note / Observation
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Identity card verified, parent contacted on phone, approved train ticket shown"
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  className="w-full p-2 border border-[#E4E1DA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => setVerifyModalTarget(null)}
                  className="px-3 py-1.5 text-xs text-[#5B6472] hover:text-[#1C2430] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifySubmitting || !verifyCheckId}
                  className="px-4 py-1.5 text-xs font-medium bg-[#26415C] text-white rounded hover:bg-[#1B2E42] transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{verifySubmitting ? 'Recording...' : 'Confirm Verification'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveRequestsPanel;
