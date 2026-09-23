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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4" />
            Hardware Gateways
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Kiosk Device Authentication</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage mounted gate displays and mess counters with per-device cryptographically hashed secrets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDevices}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Refresh device list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition shadow-lg shadow-sky-600/25"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Device</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Devices Grid */}
      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center text-slate-400 text-sm">
          Loading registered devices...
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
          <Laptop className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-1">No Devices Registered Yet</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            Register your first gate kiosk or mess counter to generate an authentication secret.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-medium"
          >
            Register Device
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {devices.map((device) => {
            const isOnline = device.last_heartbeat_at && 
              (new Date().getTime() - new Date(device.last_heartbeat_at).getTime() < 120000);

            return (
              <div
                key={device.id}
                className={`p-6 rounded-2xl border transition ${
                  device.is_active
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/60 border-red-500/20 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2.5 rounded-xl border ${
                      device.purpose === 'GATE'
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                      {device.purpose === 'GATE' ? <DoorOpen className="w-5 h-5" /> : <Utensils className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-base leading-tight">
                        {device.device_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[11px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                          {device.device_code || 'NO_CODE'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {device.purpose}
                        </span>
                      </div>
                    </div>
                  </div>

                  {device.is_active ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                      <XCircle className="w-3.5 h-3.5" />
                      Disabled
                    </span>
                  )}
                </div>

                {/* Binding Info */}
                <div className="p-3 bg-slate-950/60 rounded-xl text-xs space-y-1.5 mb-4 border border-slate-800/80">
                  {device.purpose === 'GATE' ? (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bound Gate:</span>
                      <span className="text-slate-300 font-medium truncate">
                        {device.gate?.hostel?.code ? `[${device.gate.hostel.code}] ` : ''}
                        {device.gate?.name || 'Unassigned Gate'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bound Mess:</span>
                      <span className="text-slate-300 font-medium truncate">
                        {device.mess?.name || 'Central Campus Mess'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Heartbeat:</span>
                    <span className={`font-medium ${isOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {device.last_heartbeat_at
                        ? new Date(device.last_heartbeat_at).toLocaleTimeString()
                        : 'No heartbeat recorded'}
                    </span>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-500 text-[11px]">
                    Added {new Date(device.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-3">
                    {device.is_active && (
                      <a
                        href={`/display/${device.purpose.toLowerCase()}/${device.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 font-semibold hover:underline flex items-center gap-1"
                        title="Open live kiosk QR terminal"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Open Kiosk
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}

                    {device.is_active && (
                      <button
                        onClick={() => handleDisableDevice(device.id, device.device_name)}
                        className="text-red-400 hover:text-red-300 font-medium hover:underline flex items-center gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Revoke
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">Register Kiosk Display Device</h2>
            <p className="text-slate-400 text-xs mb-6">
              Create a cryptographic identity for a gate or mess counter display kiosk.
            </p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Device Name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. H1 Main Gate Display"
                  required
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Device Code (Unique Identifier)
                </label>
                <input
                  type="text"
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  placeholder="e.g. H1_GATE_1 or H1_MESS"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-sky-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Device Purpose
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPurpose('GATE')}
                    className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition ${
                      purpose === 'GATE'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <DoorOpen className="w-4 h-4" />
                    Hostel Gate Kiosk
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurpose('MESS')}
                    className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition ${
                      purpose === 'MESS'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Utensils className="w-4 h-4" />
                    Mess Counter Kiosk
                  </button>
                </div>
              </div>

              {purpose === 'GATE' && gates.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Assign to Hostel Gate
                  </label>
                  <select
                    value={selectedGateId}
                    onChange={(e) => setSelectedGateId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition"
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
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Assign to Mess Dining Hall
                  </label>
                  <select
                    value={selectedMessId}
                    onChange={(e) => setSelectedMessId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition"
                  >
                    {messes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition shadow-lg shadow-sky-600/25 disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Generate Secret & Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Secret Reveal Modal */}
      {secretModalData && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl shadow-amber-950/50 text-center">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-bold text-white mb-1">Save This Device Secret</h2>
            <p className="text-xs text-amber-400 font-medium mb-4">
              ⚠️ This secret will be shown ONLY ONCE and cannot be recovered if lost.
            </p>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl mb-4 text-left">
              <div className="text-[11px] text-slate-400 uppercase font-semibold mb-1">
                Device Name: <span className="text-white">{secretModalData.deviceName}</span>
              </div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold mb-2">
                Shared Secret (Bearer Token):
              </div>
              <div className="font-mono text-xs break-all bg-slate-900 p-3 rounded-xl border border-slate-800 text-sky-400 select-all">
                {secretModalData.secret}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleCopySecret}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Secret'}</span>
              </button>

              <button
                onClick={() => setSecretModalData(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition"
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
