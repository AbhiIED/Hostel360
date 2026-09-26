import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeftRight,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

interface SwapRequest {
  id: string;
  sender_student_id: string;
  target_student_id: string;
  sender_room_id: string;
  target_room_id: string;
  status: 'PENDING_PEER_ACCEPTANCE' | 'PEER_ACCEPTED' | 'ESCALATED_TO_WARDEN' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  is_cross_tier: boolean;
  decision_note?: string | null;
  created_at: string;
  sender_student?: {
    id: string;
    roll_number: string;
    user?: { name: string; email: string };
    room?: { room_number: string; floor: number };
    hostel?: { name: string; code: string };
  };
  target_student?: {
    id: string;
    roll_number: string;
    user?: { name: string; email: string };
    room?: { room_number: string; floor: number };
    hostel?: { name: string; code: string };
  };
  decider?: {
    id: string;
    name: string;
    role: string;
  };
}

interface RoomSwapPanelProps {
  hostelId?: string;
}

export const RoomSwapPanel: React.FC<RoomSwapPanelProps> = ({ hostelId }) => {
  const { user } = useAuth();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Decision Modal
  const [selectedSwap, setSelectedSwap] = useState<SwapRequest | null>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [decisionNote, setDecisionNote] = useState<string>('');

  const isWarden = user?.role === 'WARDEN' || user?.role === 'VICE_WARDEN' || user?.role === 'SUPER_ADMIN';

  const fetchSwaps = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (hostelId) params.hostel_id = hostelId;

      const res = await api.get('/allocations/swaps', { params });
      setSwaps(res.data.swaps || []);
    } catch (err: any) {
      console.error('Failed to load swap requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSwaps();
  }, [hostelId]);

  const handleDecision = async () => {
    if (!selectedSwap) return;
    try {
      setIsActionLoading(true);
      setMessage(null);
      const res = await api.patch(`/allocations/swaps/${selectedSwap.id}/decide`, {
        action: decisionAction,
        decision_note: decisionNote || `Decided by ${user?.name} (${user?.role})`,
      });
      setMessage({ type: 'success', text: res.data.message || 'Swap decision recorded.' });
      setSelectedSwap(null);
      setDecisionNote('');
      fetchSwaps();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to record swap decision.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#E4E1DA] rounded-lg shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E4E1DA] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FBFBFA]">
        <div>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-[#26415C]" />
            <h2 className="text-base font-semibold text-[#1C2430]">Mutual Room Swap Requests</h2>
          </div>
          <p className="text-xs text-[#5B6472] mt-0.5">
            Same-floor swaps can be approved directly by Caretaker. Cross-tier swaps require Warden approval.
          </p>
        </div>

        <button
          onClick={fetchSwaps}
          disabled={isLoading}
          className="p-1.5 border border-[#D5D2CA] rounded hover:bg-[#F3F2EE] text-[#5B6472] transition"
          title="Refresh swaps"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Alert Notification */}
      {message && (
        <div
          className={`px-4 py-3 text-xs flex items-center justify-between border-b ${
            message.type === 'success'
              ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]'
              : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-[11px] font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Swaps Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[#1C2430]">
          <thead className="bg-[#F6F5F2] text-[#5B6472] font-semibold border-b border-[#E4E1DA]">
            <tr>
              <th className="px-4 py-3">Student A (Initiator)</th>
              <th className="px-4 py-3">Student B (Peer)</th>
              <th className="px-4 py-3">Tier Mapping</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E1DA]">
            {swaps.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#5B6472]">
                  No room swap requests found.
                </td>
              </tr>
            ) : (
              swaps.map((swap) => {
                const canCaretakerApprove = !swap.is_cross_tier && swap.status === 'PEER_ACCEPTED';
                const canWardenApprove =
                  isWarden && (swap.status === 'PEER_ACCEPTED' || swap.status === 'ESCALATED_TO_WARDEN');

                return (
                  <tr key={swap.id} className="hover:bg-[#FBFBFA] transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1C2430]">
                        {swap.sender_student?.user?.name || 'Student A'}
                      </div>
                      <div className="text-[11px] text-[#5B6472]">
                        Roll: {swap.sender_student?.roll_number}
                      </div>
                      <div className="text-[11px] font-medium text-[#0E7490]">
                        Room {swap.sender_student?.room?.room_number} (Floor {swap.sender_student?.room?.floor})
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1C2430]">
                        {swap.target_student?.user?.name || 'Student B'}
                      </div>
                      <div className="text-[11px] text-[#5B6472]">
                        Roll: {swap.target_student?.roll_number}
                      </div>
                      <div className="text-[11px] font-medium text-[#0E7490]">
                        Room {swap.target_student?.room?.room_number} (Floor {swap.target_student?.room?.floor})
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {swap.is_cross_tier ? (
                        <div className="flex items-center gap-1 text-[11px] text-[#B91C1C] font-semibold">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Cross-Tier Swap</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-[#2E7D5B] font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Same-Tier Floor</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          swap.status === 'APPROVED'
                            ? 'bg-[#2E7D5B] text-white'
                            : swap.status === 'REJECTED'
                            ? 'bg-[#FECACA] text-[#991B1B]'
                            : swap.status === 'ESCALATED_TO_WARDEN'
                            ? 'bg-[#F3E8FF] text-[#6B21A8]'
                            : swap.status === 'PEER_ACCEPTED'
                            ? 'bg-[#E0F2FE] text-[#0369A1]'
                            : 'bg-[#FEF08A] text-[#854D0E]'
                        }`}
                      >
                        {swap.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-[11px] text-[#5B6472]">
                      {new Date(swap.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {canWardenApprove || canCaretakerApprove ? (
                        <button
                          onClick={() => {
                            setSelectedSwap(swap);
                            setDecisionAction('APPROVE');
                            setDecisionNote('');
                          }}
                          className="text-xs px-2.5 py-1 bg-[#26415C] hover:bg-[#1B2F44] text-white rounded font-medium transition shadow-sm"
                        >
                          Decide
                        </button>
                      ) : swap.is_cross_tier && swap.status === 'ESCALATED_TO_WARDEN' && !isWarden ? (
                        <span className="text-[10px] text-[#6B21A8] font-medium bg-[#F3E8FF] px-2 py-0.5 rounded">
                          Escalated to Warden
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#5B6472]">
                          {swap.status === 'PENDING_PEER_ACCEPTANCE' ? 'Awaiting Peer' : 'Closed'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Decision Modal */}
      {selectedSwap && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 border border-[#E4E1DA] shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
              <h3 className="text-sm font-semibold text-[#1C2430]">
                {decisionAction === 'APPROVE' ? 'Approve Room Swap' : 'Reject Room Swap'}
              </h3>
              <button
                onClick={() => setSelectedSwap(null)}
                className="text-[#5B6472] hover:text-[#1C2430] text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="bg-[#FBFBFA] p-3 rounded border border-[#E4E1DA] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#5B6472]">Student A:</span>
                  <span className="font-semibold text-[#1C2430]">
                    {selectedSwap.sender_student?.user?.name} (Room{' '}
                    {selectedSwap.sender_student?.room?.room_number})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5B6472]">Student B:</span>
                  <span className="font-semibold text-[#1C2430]">
                    {selectedSwap.target_student?.user?.name} (Room{' '}
                    {selectedSwap.target_student?.room?.room_number})
                  </span>
                </div>
              </div>

              {selectedSwap.is_cross_tier && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-[#991B1B]">
                  <span className="font-semibold block mb-0.5">Cross-Floor-Year Policy Exemption:</span>
                  <span>
                    This swap moves students across different floors or mapped academic year tiers. Approving this
                    records an official Warden exemption.
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDecisionAction('APPROVE')}
                  className={`flex-1 py-1.5 rounded font-medium border text-xs transition ${
                    decisionAction === 'APPROVE'
                      ? 'bg-[#2E7D5B] text-white border-[#2E7D5B]'
                      : 'bg-white text-[#5B6472] border-[#D5D2CA]'
                  }`}
                >
                  Approve Swap
                </button>
                <button
                  type="button"
                  onClick={() => setDecisionAction('REJECT')}
                  className={`flex-1 py-1.5 rounded font-medium border text-xs transition ${
                    decisionAction === 'REJECT'
                      ? 'bg-[#B91C1C] text-white border-[#B91C1C]'
                      : 'bg-white text-[#5B6472] border-[#D5D2CA]'
                  }`}
                >
                  Reject Swap
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                  Decision Notes / Audit Reason
                </label>
                <textarea
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="e.g. Mutual consent confirmed, floors verified"
                  className="w-full text-xs p-2 border border-[#D5D2CA] rounded focus:outline-none focus:border-[#26415C]"
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#E4E1DA] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedSwap(null)}
                className="text-xs px-3 py-1.5 rounded border border-[#D5D2CA] hover:bg-[#F6F5F2] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecision}
                disabled={isActionLoading}
                className={`text-xs px-4 py-1.5 rounded text-white font-medium transition shadow-sm ${
                  decisionAction === 'APPROVE'
                    ? 'bg-[#2E7D5B] hover:bg-[#25664A]'
                    : 'bg-[#B91C1C] hover:bg-[#991B1B]'
                }`}
              >
                Confirm {decisionAction === 'APPROVE' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomSwapPanel;
