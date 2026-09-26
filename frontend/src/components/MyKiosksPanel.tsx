import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import {
  Laptop,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  X,
  QrCode,
  MapPin,
} from 'lucide-react';
import { getSocket } from '../api/socket';

interface KioskDevice {
  id: string;
  name: string;
  device_code: string;
  device_type: 'GATE' | 'MESS';
  is_active: boolean;
  last_heartbeat: string | null;
  last_token_issued_at: string | null;
  created_at: string;
  gate?: {
    id: string;
    name: string;
    hostel_id: string;
    hostel?: {
      id: string;
      name: string;
      code: string;
    };
  } | null;
  mess?: {
    id: string;
    name: string;
  } | null;
}

interface MyKiosksPanelProps {
  hostelId?: string;
}

export const MyKiosksPanel: React.FC<MyKiosksPanelProps> = ({ hostelId }) => {
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Malfunction modal state
  const [malfunctionTarget, setMalfunctionTarget] = useState<KioskDevice | null>(null);
  const [malfunctionNote, setMalfunctionNote] = useState('');
  const [submittingMalfunction, setSubmittingMalfunction] = useState(false);

  const fetchKiosks = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api.get('/devices/my-kiosks');
      setDevices(res.data.devices || []);
    } catch (err: any) {
      console.error('Failed to fetch assigned kiosks:', err);
      setErrorMsg('Failed to load assigned kiosk devices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchKiosks();
  }, [fetchKiosks]);

  // Real-time socket updates for heartbeats / refreshes
  useEffect(() => {
    const socket = getSocket();

    const joinRooms = () => {
      if (hostelId) {
        socket.emit('join', `hostel:${hostelId}`);
      }
      socket.emit('join', 'admin:feed');
    };

    if (socket.connected) {
      joinRooms();
    }
    socket.on('connect', joinRooms);

    const handleHeartbeat = (data: { deviceId: string; timestamp: string }) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === data.deviceId
            ? { ...d, last_heartbeat: data.timestamp }
            : d
        )
      );
    };

    const handleDeviceRefresh = (data: { deviceId: string }) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === data.deviceId
            ? { ...d, last_token_issued_at: new Date().toISOString() }
            : d
        )
      );
    };

    socket.on('device:heartbeat', handleHeartbeat);
    socket.on('device:force_refresh', handleDeviceRefresh);

    return () => {
      socket.off('connect', joinRooms);
      socket.off('device:heartbeat', handleHeartbeat);
      socket.off('device:force_refresh', handleDeviceRefresh);
    };
  }, [hostelId]);

  // Force token refresh operational action
  const handleForceRefresh = async (device: KioskDevice) => {
    setActionLoadingId(device.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.post(`/devices/${device.id}/force-refresh`);
      setSuccessMsg(res.data.message || `Token refresh signal sent to ${device.name}`);
      fetchKiosks();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || `Failed to refresh token on ${device.name}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Report malfunction to Super Admin
  const handleReportMalfunction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!malfunctionTarget || !malfunctionNote.trim()) {
      setErrorMsg('Please describe the observed malfunction');
      return;
    }

    setSubmittingMalfunction(true);
    setErrorMsg(null);

    try {
      const res = await api.post(`/devices/${malfunctionTarget.id}/report-malfunction`, {
        note: malfunctionNote.trim(),
      });
      setSuccessMsg(res.data.message || `Malfunction reported to Super Admin for ${malfunctionTarget.name}`);
      setMalfunctionTarget(null);
      setMalfunctionNote('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to submit malfunction report');
    } finally {
      setSubmittingMalfunction(false);
    }
  };

  // Helper: check if device is online (heartbeat within last 2 minutes)
  const isOnline = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) return false;
    const diffMs = Date.now() - new Date(lastHeartbeat).getTime();
    return diffMs < 2 * 60 * 1000;
  };

  // Helper: relative time format
  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never recorded';
    const diffSec = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return new Date(timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#E4E1DA] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#F1F5F9] border border-[#CBD5E1] flex items-center justify-center text-[#26415C]">
            <Laptop className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-medium text-[#1C2430]">
                My Kiosks (Operational Status)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono text-[#5B6472] bg-[#FAF9F6] border border-[#E4E1DA]">
                {devices.length} {devices.length === 1 ? 'device' : 'devices'}
              </span>
            </div>
            <p className="text-xs text-[#5B6472] mt-0.5">
              Live wall kiosk heartbeat and token issuance for your assigned hostel. Provisioning and secret credentials are managed exclusively by Super Admin.
            </p>
          </div>
        </div>

        <button
          onClick={fetchKiosks}
          disabled={refreshing}
          className="p-1.5 text-[#5B6472] hover:text-[#1C2430] rounded transition self-start sm:self-auto"
          title="Refresh kiosk statuses"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
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

      {errorMsg && (
        <div className="mb-4 p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-0.5 hover:opacity-75">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Device List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#5B6472]">
          Loading kiosk devices...
        </div>
      ) : devices.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#5B6472]">
          <Laptop className="w-6 h-6 text-[#5B6472] mx-auto mb-2 opacity-50" />
          <span>No hardware kiosks currently assigned to your hostel gates or dining halls.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((device) => {
            const online = isOnline(device.last_heartbeat);
            const tokenFresh = device.last_token_issued_at
              ? Date.now() - new Date(device.last_token_issued_at).getTime() < 3 * 60 * 1000
              : false;

            return (
              <div
                key={device.id}
                className="border border-[#E4E1DA] rounded-lg p-4 bg-[#FAF9F6]/50 hover:bg-[#FAF9F6] transition flex flex-col justify-between space-y-4"
              >
                {/* Top: Name, Code, Location & Online Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-serif font-medium text-[#1C2430] text-sm">
                        {device.name}
                      </div>
                      <div className="text-[11px] font-mono text-[#5B6472]">
                        {device.device_code}
                      </div>
                    </div>

                    {/* Online / Offline status badge */}
                    <div className="shrink-0">
                      {online ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#DEF7EC] text-[#03543F] border border-[#84E1BC]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B] animate-pulse" />
                          ONLINE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
                          OFFLINE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Location metadata */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-[#5B6472]">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-[#26415C]" />
                    <span>
                      {device.device_type === 'GATE'
                        ? `${device.gate?.hostel?.name || 'Assigned hostel'} • ${device.gate?.name || 'Gate'}`
                        : `Dining Hall • ${device.mess?.name || 'Mess'}`}
                    </span>
                  </div>
                </div>

                {/* Middle: Operational Telemetry Metrics */}
                <div className="bg-white p-3 rounded border border-[#E4E1DA] grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[11px] text-[#5B6472] flex items-center gap-1 mb-0.5">
                      <Clock className="w-3 h-3" />
                      <span>Last Heartbeat</span>
                    </div>
                    <div className="font-mono text-[#1C2430] font-medium text-[11px]">
                      {formatRelativeTime(device.last_heartbeat)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-[#5B6472] flex items-center gap-1 mb-0.5">
                      <QrCode className="w-3 h-3" />
                      <span>Token Health</span>
                    </div>
                    <div className="font-mono text-[11px]">
                      {tokenFresh ? (
                        <span className="text-[#2E7D5B] font-medium">Active (Fresh)</span>
                      ) : (
                        <span className="text-[#5B6472]">
                          {device.last_token_issued_at ? formatRelativeTime(device.last_token_issued_at) : 'Idle'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom: Caretaker Operational Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#E4E1DA] text-xs">
                  <span className="text-[10px] text-[#5B6472]">
                    {device.is_active ? 'Active device' : 'Disabled by Admin'}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Force token refresh action */}
                    <button
                      onClick={() => handleForceRefresh(device)}
                      disabled={actionLoadingId === device.id}
                      className="px-2.5 py-1 bg-white hover:bg-[#FAF9F6] border border-[#E4E1DA] text-[#1C2430] rounded font-medium transition inline-flex items-center gap-1.5 disabled:opacity-50"
                      title="Safely restarts token loop on the kiosk display without changing credentials"
                    >
                      <RefreshCw className={`w-3 h-3 text-[#26415C] ${actionLoadingId === device.id ? 'animate-spin' : ''}`} />
                      <span>Force refresh</span>
                    </button>

                    {/* Report malfunction action */}
                    <button
                      onClick={() => {
                        setMalfunctionTarget(device);
                        setMalfunctionNote('');
                      }}
                      className="px-2.5 py-1 text-[#DC2626] hover:bg-[#FEF2F2] border border-[#FCA5A5] rounded font-medium transition inline-flex items-center gap-1"
                      title="Flags this hardware unit to Super Admin for technical inspection"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Report issue</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Malfunction Report Modal */}
      {malfunctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg border border-[#E4E1DA] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                <h3 className="font-serif text-base font-medium text-[#1C2430]">
                  Report Kiosk Malfunction
                </h3>
              </div>
              <button
                onClick={() => setMalfunctionTarget(null)}
                className="text-[#5B6472] hover:text-[#1C2430] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#FAF9F6] p-3 rounded border border-[#E4E1DA] text-xs space-y-1">
              <div className="font-medium text-[#1C2430]">
                {malfunctionTarget.name} ({malfunctionTarget.device_code})
              </div>
              <div className="text-[#5B6472]">
                Location:{' '}
                {malfunctionTarget.gate?.name
                  ? `${malfunctionTarget.gate.hostel?.name || 'Hostel'} — ${malfunctionTarget.gate.name}`
                  : malfunctionTarget.mess?.name || 'Dining Hall'}
              </div>
              <p className="text-[11px] text-[#5B6472] pt-1">
                This notice will be recorded in the Super Admin technical audit log and alerted to campus engineering. The kiosk will remain online unless an administrator chooses to deactivate it.
              </p>
            </div>

            <form onSubmit={handleReportMalfunction} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[#1C2430] mb-1">
                  Describe the Issue / Malfunction <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Display backlight flickering, QR code not refreshing every 15s, camera misaligned or physical casing damaged"
                  value={malfunctionNote}
                  onChange={(e) => setMalfunctionNote(e.target.value)}
                  className="w-full p-2 border border-[#E4E1DA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => setMalfunctionTarget(null)}
                  className="px-3 py-1.5 text-xs text-[#5B6472] hover:text-[#1C2430] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMalfunction || !malfunctionNote.trim()}
                  className="px-4 py-1.5 text-xs font-medium bg-[#DC2626] text-white rounded hover:bg-[#B91C1C] transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingMalfunction ? 'Sending report...' : 'Dispatch Alert to Super Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyKiosksPanel;
