import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  Laptop, Plus, RefreshCw, ShieldAlert, CheckCircle2, 
  XCircle, Copy, Check, AlertTriangle, Radio, DoorOpen, Utensils,
  QrCode, ExternalLink
} from 'lucide-react';

interface Gate {
  id: string;
  name: string;
  hostel: {
    id: string;
    name: string;
    code: string;
  };
}

interface Mess {
  id: string;
  name: string;
}

interface DeviceItem {
  id: string;
  device_code?: string;
  device_name: string;
  purpose: 'GATE' | 'MESS';
  is_active: boolean;
  last_heartbeat_at?: string;
  created_at: string;
  gate?: Gate;
  mess?: Mess;
  registrant?: {
    name: string;
    email: string;
  };
}

export const DeviceManagementPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [messes, setMesses] = useState<Mess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registration Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [purpose, setPurpose] = useState<'GATE' | 'MESS'>('GATE');
  const [selectedGateId, setSelectedGateId] = useState('');
  const [selectedMessId, setSelectedMessId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // One-time Secret Modal State
  const [secretModalData, setSecretModalData] = useState<{
    deviceName: string;
    secret: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/devices');
      setDevices(res.data.devices || []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to load registered devices');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      // In Phase 3, fetch devices also gives us sample gates/messes from seed
      const devRes = await api.get('/devices');
      const existing = devRes.data.devices || [];
      const extractedGates: Gate[] = [];
      const extractedMesses: Mess[] = [];

      existing.forEach((d: DeviceItem) => {
        if (d.gate && !extractedGates.some(g => g.id === d.gate?.id)) {
          extractedGates.push(d.gate);
        }
        if (d.mess && !extractedMesses.some(m => m.id === d.mess?.id)) {
          extractedMesses.push(d.mess);
        }
      });
      setGates(extractedGates);
      setMesses(extractedMesses);
      if (extractedGates.length > 0) setSelectedGateId(extractedGates[0].id);
      if (extractedMesses.length > 0) setSelectedMessId(extractedMesses[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchOptions();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        device_name: deviceName,
        device_code: deviceCode || undefined,
        purpose,
        gate_id: purpose === 'GATE' ? selectedGateId : undefined,
        mess_id: purpose === 'MESS' ? selectedMessId : undefined,
      };

      const res = await api.post('/devices/register', payload);
      const { device, secret } = res.data;

      // Show one-time secret modal
      setSecretModalData({
        deviceName: device.device_name,
        secret,
      });

      setIsModalOpen(false);
      setDeviceName('');
      setDeviceCode('');
      fetchDevices();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to register device');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisableDevice = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to disable ${name}? Active QR tokens will be revoked immediately.`)) {
      return;
    }

    try {
      await api.patch(`/devices/${id}/disable`);
      fetchDevices();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Failed to disable device');
    }
  };

  const handleCopySecret = () => {
    if (secretModalData) {
      navigator.clipboard.writeText(secretModalData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E4E1DA]">
        <div>
          <div className="flex items-center gap-2 text-[#5B6472] text-xs font-medium mb-1">
            <Radio className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Hardware gateways</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C2430] tracking-tight">
            Kiosk device authentication
          </h1>
          <p className="text-xs text-[#5B6472] mt-1">
            Manage mounted gate displays and mess counters with per-device cryptographically hashed secrets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDevices}
            disabled={isLoading}
            className="p-2 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition disabled:opacity-50"
            title="Refresh device list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register new device</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded bg-[#B3432B]/10 border border-[#B3432B]/30 text-[#B3432B] text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Devices Grid */}
      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center text-[#5B6472] text-xs">
          Loading registered devices...
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E4E1DA] rounded-lg p-8">
          <Laptop className="w-10 h-10 text-[#5B6472] mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="text-sm font-medium text-[#1C2430] mb-1">No devices registered yet</h3>
          <p className="text-xs text-[#5B6472] max-w-sm mx-auto mb-5">
            Register your first gate kiosk or mess counter to generate an authentication secret.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 bg-[#26415C] hover:bg-[#1e344a] text-white rounded text-xs font-medium transition"
          >
            Register device
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {devices.map((device) => {
            const isOnline =
              device.last_heartbeat_at &&
              new Date().getTime() - new Date(device.last_heartbeat_at).getTime() < 120000;

            return (
              <div
                key={device.id}
                className={`p-5 rounded-lg border bg-white transition ${
                  device.is_active ? 'border-[#E4E1DA]' : 'border-[#E4E1DA] opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded border ${
                        device.purpose === 'GATE'
                          ? 'bg-[#26415C]/10 border-[#26415C]/20 text-[#26415C]'
                          : 'bg-[#2E7D5B]/10 border-[#2E7D5B]/20 text-[#2E7D5B]'
                      }`}
                    >
                      {device.purpose === 'GATE' ? (
                        <DoorOpen className="w-4 h-4" />
                      ) : (
                        <Utensils className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-[#1C2430] text-xs leading-tight">
                        {device.device_name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[11px] text-[#26415C] bg-[#FAF9F6] px-1.5 py-0.2 rounded border border-[#E4E1DA]">
                          {device.device_code || 'NO_CODE'}
                        </span>
                        <span className="text-[11px] text-[#5B6472]">
                          {device.purpose === 'GATE' ? 'Gate terminal' : 'Dining terminal'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {device.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#2E7D5B]/10 text-[#2E7D5B] border border-[#2E7D5B]/30">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#B3432B]/10 text-[#B3432B] border border-[#B3432B]/30">
                      <XCircle className="w-3 h-3" />
                      Disabled
                    </span>
                  )}
                </div>

                {/* Binding Info */}
                <div className="p-3 bg-[#FAF9F6] rounded text-xs space-y-1 mb-3 border border-[#E4E1DA]">
                  {device.purpose === 'GATE' ? (
                    <div className="flex justify-between">
                      <span className="text-[#5B6472]">Bound gate:</span>
                      <span className="text-[#1C2430] font-medium truncate">
                        {device.gate?.hostel?.code ? `[${device.gate.hostel.code}] ` : ''}
                        {device.gate?.name || 'Unassigned gate'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-[#5B6472]">Bound mess:</span>
                      <span className="text-[#1C2430] font-medium truncate">
                        {device.mess?.name || 'Central campus mess'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[#5B6472]">Heartbeat:</span>
                    <span
                      className={`font-medium ${
                        isOnline ? 'text-[#2E7D5B]' : 'text-[#5B6472]'
                      }`}
                    >
                      {device.last_heartbeat_at
                        ? new Date(device.last_heartbeat_at).toLocaleTimeString()
                        : 'No heartbeat recorded'}
                    </span>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-[#E4E1DA] text-xs">
                  <span className="text-[#5B6472] text-[11px]">
                    Added {new Date(device.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-3">
                    {device.is_active && (
                      <a
                        href={`/display/${device.purpose.toLowerCase()}/${device.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#26415C] hover:underline font-medium flex items-center gap-1 text-xs"
                        title="Open live kiosk QR terminal"
                      >
                        <QrCode className="w-3 h-3" />
                        <span>Open kiosk</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}

                    {device.is_active && (
                      <button
                        onClick={() => handleDisableDevice(device.id, device.device_name)}
                        className="text-[#B3432B] hover:underline font-medium flex items-center gap-1 text-xs"
                      >
                        <ShieldAlert className="w-3 h-3" />
                        <span>Revoke</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 max-w-lg w-full shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E4E1DA]">
              <div>
                <h2 className="text-base font-serif font-medium text-[#1C2430]">
                  Register kiosk display device
                </h2>
                <p className="text-xs text-[#5B6472] mt-0.5">
                  Create a cryptographic identity for a gate or mess counter display kiosk.
                </p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">
                  Device name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. H1 Main Gate Display"
                  required
                  className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">
                  Device code (unique identifier)
                </label>
                <input
                  type="text"
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  placeholder="e.g. H1_GATE_1 or H1_MESS"
                  className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">
                  Device purpose
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPurpose('GATE')}
                    className={`py-2 px-3 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                      purpose === 'GATE'
                        ? 'bg-[#FAF9F6] border-[#26415C] text-[#26415C]'
                        : 'bg-white border-[#E4E1DA] text-[#5B6472] hover:bg-[#FAF9F6]'
                    }`}
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>Hostel gate kiosk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurpose('MESS')}
                    className={`py-2 px-3 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                      purpose === 'MESS'
                        ? 'bg-[#FAF9F6] border-[#26415C] text-[#26415C]'
                        : 'bg-white border-[#E4E1DA] text-[#5B6472] hover:bg-[#FAF9F6]'
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Mess counter kiosk</span>
                  </button>
                </div>
              </div>

              {purpose === 'GATE' && gates.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Assign to hostel gate
                  </label>
                  <select
                    value={selectedGateId}
                    onChange={(e) => setSelectedGateId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  >
                    {gates.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.hostel.code} — {g.hostel.name} ({g.name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {purpose === 'MESS' && messes.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Assign to mess dining hall
                  </label>
                  <select
                    value={selectedMessId}
                    onChange={(e) => setSelectedMessId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  >
                    {messes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded border border-[#E4E1DA] bg-white text-[#5B6472] hover:text-[#1C2430] text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Generate secret & register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Secret Reveal Modal */}
      {secretModalData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 max-w-lg w-full shadow-lg text-center">
            <div className="w-10 h-10 bg-[#B7791F]/10 border border-[#B7791F]/30 text-[#B7791F] rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <h2 className="text-base font-serif font-medium text-[#1C2430] mb-1">
              Save this device secret
            </h2>
            <p className="text-xs text-[#B7791F] font-medium mb-4">
              This secret will be shown ONLY ONCE and cannot be recovered if lost.
            </p>

            <div className="p-3.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded-lg mb-4 text-left">
              <div className="text-[11px] text-[#5B6472] font-medium mb-1">
                Device name: <span className="text-[#1C2430] font-semibold">{secretModalData.deviceName}</span>
              </div>
              <div className="text-[11px] text-[#5B6472] font-medium mb-1.5">
                Shared secret (bearer token):
              </div>
              <div className="font-mono text-xs break-all bg-white p-2.5 rounded border border-[#E4E1DA] text-[#1C2430] select-all">
                {secretModalData.secret}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleCopySecret}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to clipboard' : 'Copy secret'}</span>
              </button>

              <button
                onClick={() => setSecretModalData(null)}
                className="px-3.5 py-2 rounded border border-[#E4E1DA] bg-white hover:bg-[#FAF9F6] text-[#1C2430] text-xs font-medium transition"
              >
                I have securely saved it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
