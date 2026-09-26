import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import {
  FileText,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { io } from 'socket.io-client';

interface LeaveRequest {
  id: string;
  student_id: string;
  hostel_id: string;
  requested_from: string;
  requested_to: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approved_at?: string;
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
  };
  approver?: {
    name: string;
    role: string;
  };
}

interface LeaveRequestsPanelProps {
  hostelId?: string;
  showAllHostels?: boolean;
}

export const LeaveRequestsPanel: React.FC<LeaveRequestsPanelProps> = ({
  hostelId,
  showAllHostels = false,
}) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const params: any = {};
      if (statusFilter === 'PENDING') {
        params.status = 'PENDING';
      }
      if (hostelId && !showAllHostels) {
        params.hostel_id = hostelId;
      }
      const res = await api.get('/curfew/leave-requests', { params });
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error('Failed to load leave requests:', err);
    } finally {
      setLoading(false);
    }
  }, [hostelId, showAllHostels, statusFilter]);

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

    return () => {
      socket.disconnect();
    };
  }, [hostelId, showAllHostels]);

  const handleUpdateStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoadingId(id);
    setError(null);

    try {
      await api.patch(`/curfew/leave-requests/${id}/status`, { status });
      fetchRequests();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${status.toLowerCase()} leave request`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

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
                Leave Requests (Out-Pass)
              </h2>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] tabular-nums">
                  {pendingCount} PENDING
                </span>
              )}
            </div>
            <p className="text-xs text-[#5B6472] mt-0.5">
              Review and approve overnight absence authorizations for residents
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded transition ${
              statusFilter === 'PENDING'
                ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                : 'text-[#5B6472] hover:text-[#1C2430]'
            }`}
          >
            Pending approvals ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded transition ${
              statusFilter === 'ALL'
                ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                : 'text-[#5B6472] hover:text-[#1C2430]'
            }`}
          >
            All requests
          </button>
          <button
            onClick={fetchRequests}
            className="p-1.5 text-[#5B6472] hover:text-[#1C2430] rounded transition"
            title="Refresh requests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded text-xs flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Requests Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#5B6472]">
          Loading leave requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#5B6472]">
          <CheckCircle2 className="w-6 h-6 text-[#2E7D5B] mx-auto mb-2 opacity-70" />
          <span>No {statusFilter === 'PENDING' ? 'pending' : ''} leave requests at this time.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                <th className="py-2.5 font-medium">Resident</th>
                <th className="py-2.5 font-medium">Room</th>
                <th className="py-2.5 font-medium">Date Range</th>
                <th className="py-2.5 font-medium">Reason</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E1DA]">
              {requests.map((req) => {
                const fromStr = new Date(req.requested_from).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const toStr = new Date(req.requested_to).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const isPending = req.status === 'PENDING';

                return (
                  <tr key={req.id} className="hover:bg-[#FAF9F6] transition">
                    <td className="py-3">
                      <div className="font-medium text-[#1C2430]">
                        {req.student?.user?.name || 'Resident'}
                      </div>
                      <div className="text-[11px] font-mono text-[#5B6472] tabular-nums">
                        {req.student?.roll_number}
                      </div>
                    </td>

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

                    <td className="py-3 font-mono text-[#1C2430] tabular-nums">
                      <div>{fromStr}</div>
                      <div className="text-[11px] text-[#5B6472]">to {toStr}</div>
                    </td>

                    <td className="py-3 max-w-xs">
                      <p className="text-xs text-[#1C2430] line-clamp-2" title={req.reason}>
                        {req.reason}
                      </p>
                    </td>

                    <td className="py-3">
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
                      {req.approver && (
                        <div className="text-[10px] text-[#5B6472] mt-0.5">
                          By: {req.approver.name}
                        </div>
                      )}
                    </td>

                    <td className="py-3 text-right">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-1.5">
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
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#5B6472]">Processed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaveRequestsPanel;
