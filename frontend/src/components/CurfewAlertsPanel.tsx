import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  X,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { getSocket } from '../api/socket';

interface CurfewAlert {
  id: string;
  student_id: string;
  hostel_id: string;
  alert_type: 'OVERNIGHT_NOT_RETURNED' | 'EXIT_DURING_CURFEW';
  triggered_at: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  resolution_note?: string;
  is_escalated?: boolean;
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
  hostel?: {
    id: string;
    name: string;
    code: string;
  };
  related_attendance?: {
    gate?: {
      name: string;
    };
  };
}

interface CurfewAlertsPanelProps {
  hostelId?: string;
  showAllHostels?: boolean;
}

export const CurfewAlertsPanel: React.FC<CurfewAlertsPanelProps> = ({
  hostelId,
  showAllHostels = false,
}) => {
  const [alerts, setAlerts] = useState<CurfewAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'ALL'>('OPEN');
  const [selectedAlert, setSelectedAlert] = useState<CurfewAlert | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [actionStatus, setActionStatus] = useState<'RESOLVED' | 'ACKNOWLEDGED'>('RESOLVED');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const params: any = {};
      if (statusFilter === 'OPEN') {
        params.status = 'OPEN';
      }
      if (hostelId && !showAllHostels) {
        params.hostel_id = hostelId;
      }
      const res = await api.get('/curfew/alerts', { params });
      setAlerts(res.data.alerts || []);
    } catch (err) {
      console.error('Failed to load curfew alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [hostelId, showAllHostels, statusFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Real-time socket updates
  useEffect(() => {
    const socket = getSocket();

    const joinRooms = () => {
      if (hostelId) {
        socket.emit('join', `hostel:${hostelId}`);
      }
      socket.emit('join', 'admin:feed');
      socket.emit('join', 'admin:curfew');
    };

    if (socket.connected) {
      joinRooms();
    }
    socket.on('connect', joinRooms);

    const handleAlert = (newAlert: CurfewAlert) => {
      if (showAllHostels || !hostelId || newAlert.hostel_id === hostelId) {
        setAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id)]);
      }
    };

    const handleAlertUpdated = (updated: CurfewAlert) => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
      );
    };

    socket.on('curfew:alert', handleAlert);
    socket.on('curfew:alert_updated', handleAlertUpdated);

    return () => {
      socket.off('connect', joinRooms);
      socket.off('curfew:alert', handleAlert);
      socket.off('curfew:alert_updated', handleAlertUpdated);
    };
  }, [hostelId, showAllHostels]);

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    if (!resolutionNote.trim() || resolutionNote.trim().length < 3) {
      setActionError('Resolution note is required (minimum 3 characters)');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      await api.patch(`/curfew/alerts/${selectedAlert.id}/resolve`, {
        status: actionStatus,
        resolution_note: resolutionNote.trim(),
      });
      setSelectedAlert(null);
      setResolutionNote('');
      fetchAlerts();
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to update alert');
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = alerts.filter((a) => a.status === 'OPEN').length;

  return (
    <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#E4E1DA] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#FEF2F2] border border-[#FCA5A5] flex items-center justify-center text-[#DC2626]">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-medium text-[#1C2430]">
                Curfew Alerts
              </h2>
              {openCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5] tabular-nums">
                  {openCount} OPEN
                </span>
              )}
            </div>
            <p className="text-xs text-[#5B6472] mt-0.5">
              Live continuous rule enforcement over hostel attendance crossings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-1.5 rounded transition ${
              statusFilter === 'OPEN'
                ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                : 'text-[#5B6472] hover:text-[#1C2430]'
            }`}
          >
            Open only ({openCount})
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded transition ${
              statusFilter === 'ALL'
                ? 'bg-[#FAF9F6] border border-[#E4E1DA] font-medium text-[#1C2430]'
                : 'text-[#5B6472] hover:text-[#1C2430]'
            }`}
          >
            All records
          </button>
          <button
            onClick={fetchAlerts}
            className="p-1.5 text-[#5B6472] hover:text-[#1C2430] rounded transition"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alert Feed Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#5B6472]">
          Loading curfew alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#5B6472]">
          <CheckCircle2 className="w-6 h-6 text-[#2E7D5B] mx-auto mb-2 opacity-70" />
          <span>No {statusFilter === 'OPEN' ? 'open' : ''} curfew alerts recorded. All continuous rules satisfied.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                <th className="py-2.5 font-medium">Resident</th>
                <th className="py-2.5 font-medium">Room</th>
                <th className="py-2.5 font-medium">Alert Type</th>
                <th className="py-2.5 font-medium">Triggered At</th>
                <th className="py-2.5 font-medium">Status & Urgency</th>
                <th className="py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E1DA]">
              {alerts.map((alert) => {
                const timeStr = new Date(alert.triggered_at).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });

                const isOvernight = alert.alert_type === 'OVERNIGHT_NOT_RETURNED';
                const isEscalated = alert.is_escalated;

                return (
                  <tr
                    key={alert.id}
                    className={`transition hover:bg-[#FAF9F6] ${
                      isEscalated
                        ? 'bg-[#FEF2F2]/40 font-medium'
                        : alert.status === 'OPEN'
                        ? 'bg-amber-50/20'
                        : ''
                    }`}
                  >
                    <td className="py-3">
                      <div className="font-medium text-[#1C2430]">
                        {alert.student?.user?.name || 'Resident'}
                      </div>
                      <div className="text-[11px] font-mono text-[#5B6472] tabular-nums">
                        {alert.student?.roll_number}
                      </div>
                    </td>

                    <td className="py-3 text-[#5B6472]">
                      {alert.student?.room?.room_number ? (
                        <span>
                          Room {alert.student.room.room_number}{' '}
                          {alert.student.room.block ? `(${alert.student.room.block})` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium ${
                          isOvernight
                            ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]'
                            : 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>
                          {isOvernight ? 'Overnight Not Returned' : 'Exit During Curfew'}
                        </span>
                      </span>
                    </td>

                    <td className="py-3 font-mono text-[#5B6472] tabular-nums">
                      {timeStr}
                    </td>

                    <td className="py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${
                            alert.status === 'OPEN'
                              ? 'bg-[#DC2626] text-white'
                              : alert.status === 'ACKNOWLEDGED'
                              ? 'bg-[#B7791F] text-white'
                              : 'bg-[#2E7D5B] text-white'
                          }`}
                        >
                          {alert.status}
                        </span>
                        {isEscalated && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#DC2626] uppercase animate-pulse">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Curfew window ended (Escalated)
                          </span>
                        )}
                        {alert.resolution_note && (
                          <span className="text-[11px] text-[#5B6472] italic line-clamp-1 max-w-[200px]" title={alert.resolution_note}>
                            "{alert.resolution_note}"
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 text-right">
                      {alert.status === 'OPEN' ? (
                        <button
                          onClick={() => {
                            setSelectedAlert(alert);
                            setActionStatus('RESOLVED');
                            setResolutionNote('');
                            setActionError(null);
                          }}
                          className="px-2.5 py-1 bg-[#26415C] hover:bg-[#1B2E42] text-white rounded text-xs font-medium transition"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#5B6472]">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolution Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg border border-[#E4E1DA] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#DC2626]" />
                <h3 className="font-serif text-lg font-medium text-[#1C2430]">
                  Resolve Curfew Alert
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-[#5B6472] hover:text-[#1C2430] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2 bg-[#FAF9F6] p-3 rounded border border-[#E4E1DA]">
              <div>
                <span className="text-[#5B6472]">Student:</span>{' '}
                <strong className="text-[#1C2430]">
                  {selectedAlert.student?.user?.name} ({selectedAlert.student?.roll_number})
                </strong>
              </div>
              <div>
                <span className="text-[#5B6472]">Alert:</span>{' '}
                <span className="font-medium text-[#DC2626]">
                  {selectedAlert.alert_type === 'OVERNIGHT_NOT_RETURNED'
                    ? 'Overnight Not Returned'
                    : 'Exit During Curfew Window'}
                </span>
              </div>
              <div>
                <span className="text-[#5B6472]">Triggered:</span>{' '}
                <span className="font-mono text-[#1C2430]">
                  {new Date(selectedAlert.triggered_at).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1.5">
                  Resolution Status
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setActionStatus('RESOLVED')}
                    className={`py-2 px-3 rounded border text-center font-medium transition ${
                      actionStatus === 'RESOLVED'
                        ? 'border-[#26415C] bg-[#26415C] text-white'
                        : 'border-[#E4E1DA] text-[#5B6472] hover:bg-[#FAF9F6]'
                    }`}
                  >
                    Resolved (Closed)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionStatus('ACKNOWLEDGED')}
                    className={`py-2 px-3 rounded border text-center font-medium transition ${
                      actionStatus === 'ACKNOWLEDGED'
                        ? 'border-[#B7791F] bg-[#B7791F] text-white'
                        : 'border-[#E4E1DA] text-[#5B6472] hover:bg-[#FAF9F6]'
                    }`}
                  >
                    Acknowledged
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">
                  Resolution Note <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Mandatory explanation (e.g. Student reported at security desk at 06:10 AM, verified by security guard)"
                  className="w-full text-xs p-2.5 border border-[#E4E1DA] rounded focus:outline-none focus:border-[#26415C]"
                  required
                />
                <p className="text-[11px] text-[#5B6472] mt-1">
                  Required audit record. This action will be permanently recorded in institutional audit logs.
                </p>
              </div>

              {actionError && (
                <div className="p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => setSelectedAlert(null)}
                  className="px-3 py-1.5 text-xs text-[#5B6472] hover:text-[#1C2430] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-medium bg-[#26415C] text-white rounded hover:bg-[#1B2E42] transition disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CurfewAlertsPanel;
