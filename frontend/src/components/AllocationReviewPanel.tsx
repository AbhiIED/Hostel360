import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Shuffle,
  Check,
  Flag,
  Sparkles,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface RoomAllocationItem {
  id: string;
  batch_id: string;
  application_id: string;
  student_id: string;
  room_id: string;
  hostel_id: string;
  assigned_floor: number;
  cascade_step: 'TARGET_FLOOR' | 'ADJACENT_FLOOR' | 'ANY_FLOOR' | 'REDIRECTED_HOSTEL' | 'ACCESSIBILITY_PREPASS';
  status: 'PROPOSED' | 'CONFIRMED' | 'FLAGGED' | 'REJECTED' | 'CANCELLED';
  is_clean: boolean;
  flag_reasons?: string[] | null;
  review_notes?: string | null;
  student?: {
    id: string;
    roll_number: string;
    gender: string;
    year?: number;
    user?: {
      id: string;
      name: string;
      email: string;
    };
  };
  room?: {
    id: string;
    room_number: string;
    floor: number;
    capacity: number;
  };
  hostel?: {
    id: string;
    name: string;
    code: string;
  };
  application?: {
    id: string;
    year_of_study: number;
    is_renewal: boolean;
    accessibility_needs: boolean;
    redirect_reason?: string | null;
  };
}

interface BatchDetails {
  id: string;
  window_id: string;
  hostel_id: string;
  lottery_seed: string;
  total_applicants: number;
  allocated_count: number;
  overflow_count: number;
  redirect_count: number;
  escalated_count: number;
  status: string;
  created_at: string;
  hostel?: { name: string; code: string };
  allocations: RoomAllocationItem[];
}

interface AllocationReviewPanelProps {
  hostelId?: string;
}

export const AllocationReviewPanel: React.FC<AllocationReviewPanelProps> = ({ hostelId }) => {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchDetails, setBatchDetails] = useState<BatchDetails | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [filter, setFilter] = useState<'ALL' | 'CLEAN_PROPOSED' | 'FLAGGED' | 'CONFIRMED'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Review single modal
  const [selectedAlloc, setSelectedAlloc] = useState<RoomAllocationItem | null>(null);
  const [reviewNote, setReviewNote] = useState<string>('');

  // Run Lottery Modal states
  const [windows, setWindows] = useState<any[]>([]);
  const [allHostels, setAllHostels] = useState<any[]>([]);
  const [targetHostelIdOverride, setTargetHostelIdOverride] = useState<string>('');
  const [isRunModalOpen, setIsRunModalOpen] = useState<boolean>(false);
  const [selectedWindowId, setSelectedWindowId] = useState<string>('');
  const [customSeed, setCustomSeed] = useState<string>('');
  const [isRunningLottery, setIsRunningLottery] = useState<boolean>(false);

  const fetchWindows = async () => {
    try {
      const params: any = {};
      if (hostelId) params.hostel_id = hostelId;
      const res = await api.get('/allocations/windows', { params });
      const winList = res.data.windows || [];
      setWindows(winList);
      if (winList.length > 0 && !selectedWindowId) {
        setSelectedWindowId(winList[0].id);
      }
      if (!hostelId) {
        const hRes = await api.get('/hostels');
        const hList = hRes.data.hostels || [];
        setAllHostels(hList);
        if (hList.length > 0 && !targetHostelIdOverride) {
          setTargetHostelIdOverride(hList[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load admission windows:', err);
    }
  };

  const handleRunBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWindowId) {
      setMessage({ type: 'error', text: 'Please select an admission registration window.' });
      return;
    }
    try {
      setIsRunningLottery(true);
      setMessage(null);
      const win = windows.find((w) => w.id === selectedWindowId);
      const targetHostelId = hostelId || win?.hostel_id || win?.hostel?.id || targetHostelIdOverride;
      if (!targetHostelId) {
        setMessage({ type: 'error', text: 'No hostel associated with this window. Please select a hostel.' });
        return;
      }

      const payload: any = {
        window_id: selectedWindowId,
        hostel_id: targetHostelId,
      };
      if (customSeed.trim()) {
        payload.lottery_seed = customSeed.trim();
      }

      const res = await api.post('/allocations/batches/run', payload);
      setMessage({
        type: 'success',
        text: res.data.message || 'Batch allocation executed successfully!',
      });
      setIsRunModalOpen(false);

      // Refresh batch list and select newly created batch
      const batchRes = await api.get('/allocations/batches', {
        params: hostelId ? { hostel_id: hostelId } : {},
      });
      const batchList = batchRes.data.batches || [];
      setBatches(batchList);
      if (res.data.batch?.id) {
        setSelectedBatchId(res.data.batch.id);
        fetchBatchDetails(res.data.batch.id);
      } else if (batchList.length > 0) {
        setSelectedBatchId(batchList[0].id);
        fetchBatchDetails(batchList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to run batch allocation:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to run batch room lottery allocation.',
      });
    } finally {
      setIsRunningLottery(false);
    }
  };

  const fetchBatches = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (hostelId) params.hostel_id = hostelId;

      const res = await api.get('/allocations/batches', { params });
      const batchList = res.data.batches || [];
      setBatches(batchList);

      if (batchList.length > 0 && !selectedBatchId) {
        setSelectedBatchId(batchList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load allocation batches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBatchDetails = async (batchId: string) => {
    if (!batchId) return;
    try {
      setIsLoading(true);
      const res = await api.get(`/allocations/batches/${batchId}`);
      setBatchDetails(res.data.batch);
      setSummary(res.data.summary);
    } catch (err: any) {
      console.error('Failed to load batch details:', err);
      setMessage({ type: 'error', text: 'Failed to load batch details.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [hostelId]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchDetails(selectedBatchId);
    }
  }, [selectedBatchId]);

  const handleBulkConfirmClean = async () => {
    if (!selectedBatchId) return;
    if (!window.confirm('Confirm all clean proposed allocations for this batch? This will write room assignments to students.')) {
      return;
    }
    try {
      setIsActionLoading(true);
      setMessage(null);
      const res = await api.post(`/allocations/batches/${selectedBatchId}/confirm-clean`);
      setMessage({ type: 'success', text: res.data.message || 'Clean allocations confirmed.' });
      fetchBatchDetails(selectedBatchId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to bulk-confirm clean allocations.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmSingle = async (allocId: string) => {
    try {
      setIsActionLoading(true);
      setMessage(null);
      await api.patch(`/allocations/allocations/${allocId}/confirm`, {
        review_notes: reviewNote || 'Verified and confirmed during review',
      });
      setMessage({ type: 'success', text: 'Allocation confirmed and room assigned.' });
      setSelectedAlloc(null);
      setReviewNote('');
      fetchBatchDetails(selectedBatchId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to confirm allocation.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleFlagSingle = async (allocId: string) => {
    try {
      setIsActionLoading(true);
      setMessage(null);
      await api.patch(`/allocations/allocations/${allocId}/flag`, {
        flag_reasons: ['MANUAL_CARETAKER_FLAG'],
        review_notes: reviewNote || 'Flagged for Warden review by Caretaker',
      });
      setMessage({ type: 'success', text: 'Allocation flagged and escalated to Warden.' });
      setSelectedAlloc(null);
      setReviewNote('');
      fetchBatchDetails(selectedBatchId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to flag allocation.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredAllocations = (batchDetails?.allocations || []).filter((item) => {
    if (filter === 'CLEAN_PROPOSED') return item.is_clean && item.status === 'PROPOSED';
    if (filter === 'FLAGGED') return !item.is_clean || item.status === 'FLAGGED';
    if (filter === 'CONFIRMED') return item.status === 'CONFIRMED';
    return true;
  });

  return (
    <div className="bg-white border border-[#E4E1DA] rounded-lg shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E4E1DA] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FBFBFA]">
        <div>
          <div className="flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-[#26415C]" />
            <h2 className="text-base font-semibold text-[#1C2430]">Batch Room Allocation Review</h2>
          </div>
          <p className="text-xs text-[#5B6472] mt-0.5">
            Review offline batch lottery allocations. Bulk-confirm clean assignments or escalate flagged items.
          </p>
        </div>

        {/* Batch Selector & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => {
              fetchWindows();
              setIsRunModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-[#26415C] hover:bg-[#1e344a] text-white rounded transition shadow-sm"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Run Room Lottery</span>
          </button>

          {batches.length > 0 && (
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-[#D5D2CA] rounded bg-white font-medium text-[#1C2430] focus:outline-none focus:border-[#26415C]"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.hostel?.name || 'Hostel'} — Seed: {b.lottery_seed.slice(0, 10)}... (
                  {new Date(b.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => fetchBatchDetails(selectedBatchId)}
            disabled={isLoading}
            className="p-1.5 border border-[#D5D2CA] rounded hover:bg-[#F3F2EE] text-[#5B6472] transition"
            title="Refresh allocations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {summary?.clean > 0 && (
            <button
              onClick={handleBulkConfirmClean}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-[#2E7D5B] hover:bg-[#25664A] text-white rounded transition shadow-sm disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Bulk-Confirm Clean ({summary.clean})</span>
            </button>
          )}
        </div>
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

      {/* Metrics Summary Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-4 bg-[#FBFBFA] border-b border-[#E4E1DA] text-xs">
          <div className="p-2.5 bg-white border border-[#E4E1DA] rounded text-center">
            <span className="text-[#5B6472] block text-[11px]">Total Placed</span>
            <span className="text-base font-semibold text-[#1C2430]">{summary.total}</span>
          </div>
          <div className="p-2.5 bg-white border border-[#E4E1DA] rounded text-center">
            <span className="text-[#5B6472] block text-[11px]">Proposed</span>
            <span className="text-base font-semibold text-[#B7791F]">{summary.proposed}</span>
          </div>
          <div className="p-2.5 bg-white border border-[#E4E1DA] rounded text-center">
            <span className="text-[#5B6472] block text-[11px]">Confirmed</span>
            <span className="text-base font-semibold text-[#2E7D5B]">{summary.confirmed}</span>
          </div>
          <div className="p-2.5 bg-white border border-[#E4E1DA] rounded text-center">
            <span className="text-[#5B6472] block text-[11px]">Clean Proposed</span>
            <span className="text-base font-semibold text-[#0E7490]">{summary.clean}</span>
          </div>
          <div className="p-2.5 bg-white border border-[#E4E1DA] rounded text-center">
            <span className="text-[#5B6472] block text-[11px]">Flagged / Review</span>
            <span className="text-base font-semibold text-[#B91C1C]">{summary.flagged}</span>
          </div>
          <div className="p-2.5 bg-white border border-[#E4E1DA] rounded text-center">
            <span className="text-[#5B6472] block text-[11px]">Overflowed</span>
            <span className="text-base font-semibold text-[#6B21A8]">{summary.overflowed}</span>
          </div>
          <div className="p-2.5 bg-white border border-[#E4E1DA] rounded text-center">
            <span className="text-[#5B6472] block text-[11px]">Redirected</span>
            <span className="text-base font-semibold text-[#EA580C]">{summary.redirected}</span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-[#E4E1DA] px-4 gap-4 text-xs font-medium text-[#5B6472]">
        <button
          onClick={() => setFilter('ALL')}
          className={`py-3 border-b-2 transition ${
            filter === 'ALL' ? 'border-[#26415C] text-[#26415C]' : 'border-transparent hover:text-[#1C2430]'
          }`}
        >
          All Allocations ({batchDetails?.allocations?.length || 0})
        </button>
        <button
          onClick={() => setFilter('CLEAN_PROPOSED')}
          className={`py-3 border-b-2 transition ${
            filter === 'CLEAN_PROPOSED' ? 'border-[#2E7D5B] text-[#2E7D5B]' : 'border-transparent hover:text-[#1C2430]'
          }`}
        >
          Clean Proposed ({summary?.clean || 0})
        </button>
        <button
          onClick={() => setFilter('FLAGGED')}
          className={`py-3 border-b-2 transition ${
            filter === 'FLAGGED' ? 'border-[#B91C1C] text-[#B91C1C]' : 'border-transparent hover:text-[#1C2430]'
          }`}
        >
          Flagged / Redirects ({summary?.flagged || 0})
        </button>
        <button
          onClick={() => setFilter('CONFIRMED')}
          className={`py-3 border-b-2 transition ${
            filter === 'CONFIRMED' ? 'border-[#26415C] text-[#26415C]' : 'border-transparent hover:text-[#1C2430]'
          }`}
        >
          Confirmed Active ({summary?.confirmed || 0})
        </button>
      </div>

      {/* Allocations Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[#1C2430]">
          <thead className="bg-[#F6F5F2] text-[#5B6472] font-semibold border-b border-[#E4E1DA]">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Year / Type</th>
              <th className="px-4 py-3">Assigned Room</th>
              <th className="px-4 py-3">Cascade Step</th>
              <th className="px-4 py-3">Audit / Clean</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Review Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E1DA]">
            {filteredAllocations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[#5B6472]">
                  {batches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#FAF9F6] border border-[#E4E1DA] flex items-center justify-center mb-3 text-[#26415C]">
                        <Shuffle className="w-5 h-5" />
                      </div>
                      <div className="font-semibold text-sm text-[#1C2430]">No batch allocations executed yet</div>
                      <p className="text-xs text-[#5B6472] max-w-md mt-1 mb-4 leading-relaxed">
                        Registered students awaiting room assignment can be placed using the Caretaker 7-pass cascade lottery algorithm (Floor Affinity → Accessibility Pre-Pass → Room Sharing).
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          fetchWindows();
                          setIsRunModalOpen(true);
                        }}
                        className="flex items-center gap-2 text-xs font-medium px-4 py-2 bg-[#26415C] hover:bg-[#1e344a] text-white rounded transition shadow-sm"
                      >
                        <Shuffle className="w-4 h-4" />
                        <span>Run First Room Lottery Batch</span>
                      </button>
                    </div>
                  ) : (
                    'No allocations match the selected filter.'
                  )}
                </td>
              </tr>
            ) : (
              filteredAllocations.map((alloc) => (
                <tr key={alloc.id} className="hover:bg-[#FBFBFA] transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1C2430]">{alloc.student?.user?.name || 'Student'}</div>
                    <div className="text-[11px] text-[#5B6472]">{alloc.student?.roll_number}</div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-[11px] font-medium">Year {alloc.application?.year_of_study || 1}</div>
                    <div className="text-[10px] text-[#5B6472]">
                      {alloc.application?.is_renewal ? (
                        <span className="text-[#0E7490] font-medium">Continuing Resident</span>
                      ) : (
                        <span>New Admit</span>
                      )}
                      {alloc.application?.accessibility_needs && (
                        <span className="ml-1 text-[#EA580C] font-semibold">♿ Special Room</span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#1C2430]">
                      Room {alloc.room?.room_number || 'N/A'}
                    </div>
                    <div className="text-[11px] text-[#5B6472]">
                      Floor {alloc.assigned_floor} • {alloc.hostel?.name || 'Hostel'}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                        alloc.cascade_step === 'TARGET_FLOOR'
                          ? 'bg-[#F0FDF4] text-[#166534]'
                          : alloc.cascade_step === 'ADJACENT_FLOOR'
                          ? 'bg-[#FEF9C3] text-[#854D0E]'
                          : alloc.cascade_step === 'ANY_FLOOR'
                          ? 'bg-[#F3E8FF] text-[#6B21A8]'
                          : alloc.cascade_step === 'REDIRECTED_HOSTEL'
                          ? 'bg-[#FFEDD5] text-[#C2410C]'
                          : 'bg-[#E0F2FE] text-[#0369A1]'
                      }`}
                    >
                      {alloc.cascade_step.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {alloc.is_clean ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#2E7D5B] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Clean
                      </span>
                    ) : (
                      <div className="text-[11px] text-[#B91C1C]">
                        <span className="font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Flagged
                        </span>
                        {alloc.flag_reasons && (
                          <span className="text-[10px] text-[#5B6472] block truncate max-w-[140px]">
                            {alloc.flag_reasons.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        alloc.status === 'CONFIRMED'
                          ? 'bg-[#2E7D5B] text-white'
                          : alloc.status === 'PROPOSED'
                          ? 'bg-[#FEF08A] text-[#854D0E]'
                          : alloc.status === 'FLAGGED'
                          ? 'bg-[#FECACA] text-[#991B1B]'
                          : 'bg-[#E5E7EB] text-[#374151]'
                      }`}
                    >
                      {alloc.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    {alloc.status === 'PROPOSED' || alloc.status === 'FLAGGED' ? (
                      <button
                        onClick={() => {
                          setSelectedAlloc(alloc);
                          setReviewNote(alloc.review_notes || '');
                        }}
                        className="text-xs px-2.5 py-1 border border-[#D5D2CA] hover:bg-[#F3F2EE] rounded font-medium text-[#1C2430] transition"
                      >
                        Review
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#5B6472]">Confirmed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Individual Review Modal */}
      {selectedAlloc && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 border border-[#E4E1DA] shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
              <h3 className="text-sm font-semibold text-[#1C2430]">Allocation Review & Decision</h3>
              <button
                onClick={() => setSelectedAlloc(null)}
                className="text-[#5B6472] hover:text-[#1C2430] text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#FBFBFA] p-3 rounded border border-[#E4E1DA]">
                <div>
                  <span className="text-[#5B6472] block">Student:</span>
                  <span className="font-semibold text-[#1C2430]">{selectedAlloc.student?.user?.name}</span>
                  <span className="block text-[#5B6472]">Roll: {selectedAlloc.student?.roll_number}</span>
                </div>
                <div>
                  <span className="text-[#5B6472] block">Proposed Room:</span>
                  <span className="font-semibold text-[#1C2430]">
                    Room {selectedAlloc.room?.room_number} (Floor {selectedAlloc.assigned_floor})
                  </span>
                  <span className="block text-[#5B6472]">{selectedAlloc.hostel?.name}</span>
                </div>
              </div>

              {selectedAlloc.application?.redirect_reason && (
                <div className="p-3 bg-[#FFF7ED] border border-[#FED7AA] rounded text-[#C2410C]">
                  <span className="font-semibold block mb-0.5">Redirect Reason:</span>
                  <span>{selectedAlloc.application.redirect_reason}</span>
                </div>
              )}

              {selectedAlloc.flag_reasons && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-[#991B1B]">
                  <span className="font-semibold block mb-0.5">Flags:</span>
                  <span>{selectedAlloc.flag_reasons.join(', ')}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                  Reviewer Notes / Verification Details
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. Identity and documents verified, approved for check-in"
                  className="w-full text-xs p-2 border border-[#D5D2CA] rounded focus:outline-none focus:border-[#26415C]"
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#E4E1DA] flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleFlagSingle(selectedAlloc.id)}
                disabled={isActionLoading}
                className="text-xs text-[#B91C1C] hover:bg-[#FEF2F2] px-3 py-1.5 rounded font-medium border border-[#FECACA] transition flex items-center gap-1"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Flag for Warden</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAlloc(null)}
                  className="text-xs px-3 py-1.5 rounded border border-[#D5D2CA] hover:bg-[#F6F5F2] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSingle(selectedAlloc.id)}
                  disabled={isActionLoading}
                  className="text-xs px-4 py-1.5 rounded bg-[#2E7D5B] hover:bg-[#25664A] text-white font-medium transition shadow-sm flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Allocation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Run Batch Room Lottery */}
      {isRunModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl border border-[#E4E1DA] w-full max-w-lg p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-[#E4E1DA] mb-4">
              <div>
                <h3 className="font-serif text-lg font-medium text-[#1C2430] flex items-center gap-2">
                  <Shuffle className="w-5 h-5 text-[#26415C]" />
                  <span>Run Batch Room Lottery</span>
                </h3>
                <p className="text-xs text-[#5B6472] mt-0.5">
                  Automated 7-pass offline cascade engine for registered student applicants
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRunModalOpen(false)}
                className="text-[#5B6472] hover:text-[#1C2430] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRunBatch} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[#1C2430] mb-1">
                  Target Admission Window
                </label>
                {windows.length === 0 ? (
                  <div className="p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-[#5B6472] space-y-1.5">
                    <div>No active registration windows found for this hostel.</div>
                    <a
                      href="/dashboard/hostels"
                      className="inline-flex items-center gap-1 text-[#26415C] font-semibold hover:underline"
                    >
                      <span>Open a Registration Window in Hostels & Rooms</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <select
                    value={selectedWindowId}
                    onChange={(e) => setSelectedWindowId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] font-medium"
                    required
                  >
                    <option value="">— Select Registration Window —</option>
                    {windows.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.hostel ? `${w.hostel.name} (${w.hostel.code})` : 'Campus-Wide (All Hostels)'} • {w.academic_year} (Sem {w.semester}) — {w._count?.applications || 0} applicants [{w.status}]
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {!hostelId && !windows.find((w) => w.id === selectedWindowId)?.hostel_id && allHostels.length > 0 && (
                <div>
                  <label className="font-medium text-[#1C2430] block mb-1">
                    Select Target Hostel for Batch Run
                  </label>
                  <select
                    value={targetHostelIdOverride}
                    onChange={(e) => setTargetHostelIdOverride(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                    required
                  >
                    {allHostels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-[#5B6472] mt-0.5 block">
                    Campus-wide window detected. Please pick which hostel's applicant pool and rooms to lottery allocate.
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-[#1C2430]">
                    Audit Lottery Seed (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomSeed(`SEED-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`)}
                    className="text-[11px] text-[#26415C] hover:underline flex items-center gap-1 font-medium"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Seed</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={customSeed}
                  onChange={(e) => setCustomSeed(e.target.value)}
                  placeholder="Leave blank for secure random seed (e.g. SEED-2026-X89F)"
                  className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#5B6472]/60 focus:outline-none focus:border-[#26415C] font-mono"
                />
                <span className="text-[10px] text-[#5B6472] mt-0.5 block">
                  Seed guarantees deterministic, audit-reproducible lottery results for Council of Wardens oversight.
                </span>
              </div>

              {/* 7-Pass Algorithm Overview */}
              <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1DA] text-[11px] text-[#5B6472] space-y-1.5">
                <div className="font-semibold text-[#1C2430] text-xs">7-Pass Cascade Engine Steps:</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#26415C]/10 text-[#26415C] flex items-center justify-center font-bold text-[9px]">1</span>
                    <span>Floor Target Match</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#26415C]/10 text-[#26415C] flex items-center justify-center font-bold text-[9px]">2</span>
                    <span>♿ Accessibility Pre-pass</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#26415C]/10 text-[#26415C] flex items-center justify-center font-bold text-[9px]">3</span>
                    <span>Adjacent Floor Fallback</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#26415C]/10 text-[#26415C] flex items-center justify-center font-bold text-[9px]">4</span>
                    <span>Hostel Any-Floor Fill</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E4E1DA] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRunModalOpen(false)}
                  disabled={isRunningLottery}
                  className="px-3 py-2 rounded border border-[#D5D2CA] text-[#5B6472] hover:bg-[#F6F5F2] font-medium text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRunningLottery || windows.length === 0}
                  className="px-4 py-2 bg-[#26415C] hover:bg-[#1e344a] text-white font-medium rounded text-xs transition flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {isRunningLottery ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing Lottery Cascade...</span>
                    </>
                  ) : (
                    <>
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Execute Batch Lottery</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllocationReviewPanel;
