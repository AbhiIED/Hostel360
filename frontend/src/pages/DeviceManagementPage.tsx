import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { QRCodeSVG } from 'qrcode.react';
import {
  Laptop,
  Plus,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
  Radio,
  DoorOpen,
  Utensils,
  QrCode,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Building,
  Search,
  Sparkles,
} from 'lucide-react';

interface Gate {
  id: string;
  name: string;
  hostel_id?: string;
  hostel?: {
    id: string;
    name: string;
    code: string;
    type?: string;
  };
}

interface Mess {
  id: string;
  name: string;
  hostel_id?: string | null;
  hostel?: {
    id: string;
    name: string;
    code: string;
    type?: string;
  };
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

interface HostelItem {
  id: string;
  code: string;
  name: string;
  type: 'BOYS' | 'GIRLS';
  location: string;
  total_capacity: number;
}

interface LoadedQrState {
  token: string;
  expires_at: string;
  ttl: number;
  secondsLeft: number;
  isRotating: boolean;
  error?: string;
  meal_window?: {
    id: string;
    meal_type: string;
    start_time: string;
    end_time: string;
  } | null;
  next_meal_window?: {
    meal_type: string;
    start_time: string;
    end_time: string;
  } | null;
}

export const DeviceManagementPage: React.FC = () => {
  const [hostels, setHostels] = useState<HostelItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [messes, setMesses] = useState<Mess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'BOYS' | 'GIRLS' | 'CENTRAL'>('ALL');

  // Accordion state (expanded hostels)
  const [expandedHostels, setExpandedHostels] = useState<Record<string, boolean>>({});

  // Dynamic QR state per device
  const [loadedQrs, setLoadedQrs] = useState<Record<string, LoadedQrState>>({});
  const [loadingQrDeviceIds, setLoadingQrDeviceIds] = useState<Record<string, boolean>>({});
  const [copiedDeviceId, setCopiedDeviceId] = useState<string | null>(null);

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
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Fetch Hostels and Devices
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [hostelsRes, devicesRes] = await Promise.all([
        api.get('/hostels'),
        api.get('/devices'),
      ]);

      const fetchedHostels: HostelItem[] = hostelsRes.data.hostels || [];
      const fetchedDevices: DeviceItem[] = devicesRes.data.devices || [];

      // Sort hostels numerically by code (H1, H2 ... H12)
      fetchedHostels.sort((a, b) => {
        const numA = parseInt(a.code.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.code.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      setHostels(fetchedHostels);
      setDevices(fetchedDevices);

      // Default expand all hostels
      const initialExpanded: Record<string, boolean> = { CENTRAL: true };
      fetchedHostels.forEach((h) => {
        initialExpanded[h.id] = true;
      });
      setExpandedHostels(initialExpanded);

      // Extract unique gates and messes for registration modal
      const extractedGates: Gate[] = [];
      const extractedMesses: Mess[] = [];

      fetchedDevices.forEach((d) => {
        if (d.gate && !extractedGates.some((g) => g.id === d.gate?.id)) {
          extractedGates.push(d.gate);
        }
        if (d.mess && !extractedMesses.some((m) => m.id === d.mess?.id)) {
          extractedMesses.push(d.mess);
        }
      });

      setGates(extractedGates);
      setMesses(extractedMesses);
      if (extractedGates.length > 0) setSelectedGateId(extractedGates[0].id);
      if (extractedMesses.length > 0) setSelectedMessId(extractedMesses[0].id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to load hostels and kiosk devices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1-second interval engine for active dynamic QR countdown and auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadedQrs((prev) => {
        const updated = { ...prev };
        let changed = false;

        Object.entries(updated).forEach(([id, qr]) => {
          if (!qr.token || qr.error) return;
          const nextSec = qr.secondsLeft - 1;

          if (nextSec <= 0) {
            if (!qr.isRotating) {
              updated[id] = { ...qr, secondsLeft: 0, isRotating: true };
              changed = true;

              // Silently fetch next dynamic token
              api
                .get(`/devices/${id}/qr-token`)
                .then((res) => {
                  const data = res.data;
                  const ttl = data.ttl || 20;
                  setLoadedQrs((curr) => ({
                    ...curr,
                    [id]: {
                      token: data.token,
                      expires_at: data.expires_at,
                      ttl,
                      secondsLeft: ttl,
                      isRotating: false,
                      meal_window: data.meal_window,
                      next_meal_window: data.next_meal_window,
                    },
                  }));
                })
                .catch((err) => {
                  console.error(`Auto-refresh error for ${id}:`, err);
                });
            }
          } else {
            updated[id] = { ...qr, secondsLeft: nextSec };
            changed = true;
          }
        });

        return changed ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch live QR token for a single device
  const handleLoadQr = async (deviceId: string) => {
    try {
      setLoadingQrDeviceIds((prev) => ({ ...prev, [deviceId]: true }));
      const res = await api.get(`/devices/${deviceId}/qr-token`);
      const data = res.data;
      const ttl = data.ttl || 20;

      setLoadedQrs((prev) => ({
        ...prev,
        [deviceId]: {
          token: data.token,
          expires_at: data.expires_at,
          ttl,
          secondsLeft: ttl,
          isRotating: false,
          meal_window: data.meal_window,
          next_meal_window: data.next_meal_window,
        },
      }));
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to load QR code for kiosk';
      setLoadedQrs((prev) => ({
        ...prev,
        [deviceId]: {
          token: '',
          expires_at: '',
          ttl: 20,
          secondsLeft: 0,
          isRotating: false,
          error: msg,
        },
      }));
    } finally {
      setLoadingQrDeviceIds((prev) => ({ ...prev, [deviceId]: false }));
    }
  };

  const handleHideQr = (deviceId: string) => {
    setLoadedQrs((prev) => {
      const updated = { ...prev };
      delete updated[deviceId];
      return updated;
    });
  };

  // Load all QRs in a specific hostel
  const handleLoadAllHostelQrs = async (hostelDevices: DeviceItem[]) => {
    const activeDevs = hostelDevices.filter((d) => d.is_active);
    await Promise.all(activeDevs.map((d) => handleLoadQr(d.id)));
  };

  const handleHideAllHostelQrs = (hostelDevices: DeviceItem[]) => {
    setLoadedQrs((prev) => {
      const updated = { ...prev };
      hostelDevices.forEach((d) => {
        delete updated[d.id];
      });
      return updated;
    });
  };

  // Load all campus QRs
  const handleLoadAllCampusQrs = async () => {
    const activeDevs = devices.filter((d) => d.is_active);
    await Promise.all(activeDevs.map((d) => handleLoadQr(d.id)));
  };

  const handleStopAllQrs = () => {
    setLoadedQrs({});
  };

  // Toggle hostel accordion
  const toggleHostel = (hostelId: string) => {
    setExpandedHostels((prev) => ({
      ...prev,
      [hostelId]: !prev[hostelId],
    }));
  };

  const handleCopyToken = (deviceId: string, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedDeviceId(deviceId);
    setTimeout(() => setCopiedDeviceId(null), 2500);
  };

  // Registration handler
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

      setSecretModalData({
        deviceName: device.device_name,
        secret,
      });

      setIsModalOpen(false);
      setDeviceName('');
      setDeviceCode('');
      fetchData();
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
      handleHideQr(id);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Failed to disable device');
    }
  };

  const handleCopySecret = () => {
    if (secretModalData) {
      navigator.clipboard.writeText(secretModalData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2500);
    }
  };

  // Central campus mess devices (not tied to any specific hostel)
  const centralMessDevices = devices.filter(
    (d) =>
      d.purpose === 'MESS' &&
      !d.mess?.hostel_id &&
      !d.mess?.hostel &&
      (!d.device_code || !d.device_code.match(/^H\d+_/))
  );

  // Group devices per hostel
  const getHostelDevices = (hostel: HostelItem) => {
    const gateDevs = devices.filter(
      (d) =>
        d.purpose === 'GATE' &&
        (d.gate?.hostel?.code === hostel.code ||
          d.gate?.hostel_id === hostel.id ||
          d.device_code?.startsWith(`${hostel.code}_GATE`))
    );

    const messDevs = devices.filter(
      (d) =>
        d.purpose === 'MESS' &&
        (d.mess?.hostel?.code === hostel.code ||
          d.mess?.hostel_id === hostel.id ||
          d.device_code?.startsWith(`${hostel.code}_MESS`))
    );

    return { gateDevs, messDevs, all: [...gateDevs, ...messDevs] };
  };

  // Filter hostels based on search & filter tabs
  const filteredHostels = hostels.filter((h) => {
    if (filterType === 'BOYS' && h.type !== 'BOYS') return false;
    if (filterType === 'GIRLS' && h.type !== 'GIRLS') return false;
    if (filterType === 'CENTRAL') return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const { all } = getHostelDevices(h);
    const matchesHostel =
      h.code.toLowerCase().includes(q) ||
      h.name.toLowerCase().includes(q) ||
      h.location.toLowerCase().includes(q);
    const matchesDevices = all.some(
      (d) =>
        d.device_name.toLowerCase().includes(q) ||
        (d.device_code && d.device_code.toLowerCase().includes(q)) ||
        (d.gate?.name && d.gate.name.toLowerCase().includes(q))
    );
    return matchesHostel || matchesDevices;
  });

  // Calculate high-level campus statistics
  const totalGateDevices = devices.filter((d) => d.purpose === 'GATE').length;
  const totalMessDevices = devices.filter((d) => d.purpose === 'MESS').length;
  const activeQrCount = Object.keys(loadedQrs).length;

  // Render individual Kiosk Device Card with inline dynamic QR
  const renderKioskCard = (device: DeviceItem) => {
    const qrState = loadedQrs[device.id];
    const isLoadingQr = loadingQrDeviceIds[device.id];
    const isOnline =
      device.last_heartbeat_at &&
      new Date().getTime() - new Date(device.last_heartbeat_at).getTime() < 120000;

    return (
      <div
        key={device.id}
        className={`border rounded-lg bg-white p-4 transition flex flex-col justify-between ${
          device.is_active ? 'border-[#E4E1DA] hover:border-[#26415C]/60' : 'border-[#E4E1DA] opacity-75'
        }`}
      >
        {/* Card Header */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded border ${
                  device.purpose === 'GATE'
                    ? 'bg-[#26415C]/10 border-[#26415C]/20 text-[#26415C]'
                    : 'bg-[#B7791F]/10 border-[#B7791F]/20 text-[#B7791F]'
                }`}
              >
                {device.purpose === 'GATE' ? <DoorOpen className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#1C2430] leading-tight">
                  {device.device_name}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-[10px] text-[#26415C] bg-[#FAF9F6] px-1.5 py-0.2 rounded border border-[#E4E1DA]">
                    {device.device_code || 'NO_CODE'}
                  </span>
                  <span className="text-[10px] text-[#5B6472]">
                    {device.purpose === 'GATE' ? 'Gate terminal' : 'Dining counter'}
                  </span>
                </div>
              </div>
            </div>

            {device.is_active ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2E7D5B]/10 text-[#2E7D5B] border border-[#2E7D5B]/20 shrink-0">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#B3432B]/10 text-[#B3432B] border border-[#B3432B]/20 shrink-0">
                <XCircle className="w-2.5 h-2.5" />
                Disabled
              </span>
            )}
          </div>

          {/* Binding & Heartbeat Telemetry */}
          <div className="p-2.5 bg-[#FAF9F6] rounded text-[11px] space-y-1 mb-3 border border-[#E4E1DA]">
            <div className="flex justify-between items-center">
              <span className="text-[#5B6472]">Location:</span>
              <span className="text-[#1C2430] font-medium truncate max-w-[170px]">
                {device.purpose === 'GATE'
                  ? device.gate?.name || 'Gate terminal'
                  : device.mess?.name || 'Mess dining hall'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#5B6472]">Heartbeat:</span>
              <span
                className={`font-mono text-[10px] font-medium ${
                  isOnline ? 'text-[#2E7D5B]' : 'text-[#5B6472]'
                }`}
              >
                {device.last_heartbeat_at
                  ? new Date(device.last_heartbeat_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Idle'}
              </span>
            </div>
          </div>

          {/* Dynamic QR Display Area */}
          {qrState?.token ? (
            <div className="p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded-lg flex flex-col items-center mb-3">
              {/* Active countdown pill */}
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-[#E4E1DA] text-[10px] font-mono font-medium text-[#26415C] mb-2 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B] animate-pulse" />
                <span>
                  {qrState.isRotating
                    ? 'Rotating token...'
                    : `${qrState.secondsLeft}s dynamic cycle`}
                </span>
              </div>

              {/* QR Code SVG */}
              <div className="p-2.5 bg-white rounded border border-[#E4E1DA] shadow-2xs">
                <QRCodeSVG
                  value={qrState.token}
                  size={150}
                  level="H"
                  includeMargin={false}
                  className="transition-opacity duration-200"
                />
              </div>

              {/* Meal window indicator if mess */}
              {device.purpose === 'MESS' && (
                <div className="text-[10px] text-[#5B6472] mt-1.5 text-center">
                  {qrState.meal_window ? (
                    <span className="text-[#2E7D5B] font-medium">
                      ✓ {qrState.meal_window.meal_type} service active
                    </span>
                  ) : (
                    <span className="text-[#B7791F]">Standby • Dining schedule enforced</span>
                  )}
                </div>
              )}

              {/* Actions below QR */}
              <div className="flex items-center gap-2 mt-2 w-full justify-center">
                <button
                  onClick={() => handleCopyToken(device.id, qrState.token)}
                  className="px-2 py-1 bg-white hover:bg-[#FAF9F6] border border-[#E4E1DA] rounded text-[10px] font-mono text-[#5B6472] hover:text-[#1C2430] transition inline-flex items-center gap-1 cursor-pointer"
                  title="Copy token string for testing in student scanner"
                >
                  {copiedDeviceId === device.id ? (
                    <Check className="w-2.5 h-2.5 text-[#2E7D5B]" />
                  ) : (
                    <Copy className="w-2.5 h-2.5 text-[#26415C]" />
                  )}
                  <span>{copiedDeviceId === device.id ? 'Copied' : 'Copy test token'}</span>
                </button>

                <button
                  onClick={() => handleHideQr(device.id)}
                  className="px-2 py-1 bg-white hover:bg-[#FAF9F6] border border-[#E4E1DA] rounded text-[10px] text-[#5B6472] hover:text-[#1C2430] transition cursor-pointer"
                >
                  Hide
                </button>
              </div>
            </div>
          ) : qrState?.error ? (
            <div className="p-3 bg-[#B3432B]/5 border border-[#B3432B]/20 rounded-lg text-center mb-3">
              <AlertTriangle className="w-4 h-4 text-[#B3432B] mx-auto mb-1" />
              <div className="text-[11px] text-[#B3432B] font-medium leading-tight mb-2">
                {qrState.error}
              </div>
              <button
                onClick={() => handleLoadQr(device.id)}
                className="px-2.5 py-1 bg-white hover:bg-[#FAF9F6] border border-[#E4E1DA] rounded text-[10px] text-[#1C2430] font-medium cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded-lg flex flex-col items-center justify-center text-center mb-3 min-h-[90px]">
              <QrCode className="w-6 h-6 text-[#5B6472] mb-1.5 opacity-60" />
              <button
                onClick={() => handleLoadQr(device.id)}
                disabled={isLoadingQr || !device.is_active}
                className="px-3 py-1.5 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <QrCode className={`w-3.5 h-3.5 ${isLoadingQr ? 'animate-spin' : ''}`} />
                <span>{isLoadingQr ? 'Generating QR...' : `Load ${device.purpose === 'GATE' ? 'Gate' : 'Mess'} QR`}</span>
              </button>
            </div>
          )}
        </div>

        {/* Card Footer Controls */}
        <div className="flex items-center justify-between pt-2.5 border-t border-[#E4E1DA] text-xs">
          <span className="text-[#5B6472] text-[10px]">
            {device.is_active ? 'Online terminal' : 'Deactivated'}
          </span>

          <div className="flex items-center gap-2">
            {device.is_active && (
              <a
                href={`/display/${device.purpose.toLowerCase()}/${device.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#26415C] hover:underline font-medium inline-flex items-center gap-1 text-[11px]"
                title="Launch full wall terminal view"
              >
                <span>Fullscreen</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}

            {device.is_active && (
              <button
                onClick={() => handleDisableDevice(device.id, device.device_name)}
                className="text-[#B3432B] hover:underline font-medium inline-flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <ShieldAlert className="w-2.5 h-2.5" />
                <span>Revoke</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#E4E1DA]">
        <div>
          <div className="flex items-center gap-2 text-[#5B6472] text-xs font-medium mb-1">
            <Radio className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Hardware gateways & physical wall kiosks</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C2430] tracking-tight">
            Hostel kiosk distribution & live QR terminals
          </h1>
          <p className="text-xs text-[#5B6472] mt-1">
            Distributed gate displays and dining hall counters across all 12 MANIT hostels with dynamic 20-second reverse QR rotation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeQrCount > 0 ? (
            <button
              onClick={handleStopAllQrs}
              className="px-3.5 py-2 rounded bg-white border border-[#E4E1DA] hover:border-[#B3432B] text-[#B3432B] text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Stop live QR rendering on all kiosks"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hide all QRs ({activeQrCount})</span>
            </button>
          ) : (
            <button
              onClick={handleLoadAllCampusQrs}
              className="px-3.5 py-2 rounded bg-[#26415C]/10 border border-[#26415C]/30 hover:bg-[#26415C]/20 text-[#26415C] text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Activate live dynamic QRs across all campus kiosks"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#26415C]" />
              <span>Load all campus QRs</span>
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition disabled:opacity-50 cursor-pointer shadow-xs"
            title="Refresh status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register kiosk device</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded bg-[#B3432B]/10 border border-[#B3432B]/30 text-[#B3432B] text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-white border border-[#E4E1DA] rounded-lg">
          <div className="text-[11px] text-[#5B6472] font-medium mb-1 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Campus Hostels</span>
          </div>
          <div className="text-xl font-serif font-medium text-[#1C2430]">
            {hostels.length} <span className="text-xs font-sans text-[#5B6472] font-normal">(10 Boys • 2 Girls)</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E4E1DA] rounded-lg">
          <div className="text-[11px] text-[#5B6472] font-medium mb-1 flex items-center gap-1.5">
            <DoorOpen className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Gate Kiosks</span>
          </div>
          <div className="text-xl font-serif font-medium text-[#1C2430]">
            {totalGateDevices} <span className="text-xs font-sans text-[#2E7D5B] font-normal">Active terminals</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E4E1DA] rounded-lg">
          <div className="text-[11px] text-[#5B6472] font-medium mb-1 flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-[#B7791F]" />
            <span>Mess Counters</span>
          </div>
          <div className="text-xl font-serif font-medium text-[#1C2430]">
            {totalMessDevices} <span className="text-xs font-sans text-[#5B6472] font-normal">Dining terminals</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E4E1DA] rounded-lg">
          <div className="text-[11px] text-[#5B6472] font-medium mb-1 flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-[#26415C]" />
            <span>Live QRs Rotating</span>
          </div>
          <div className="text-xl font-serif font-medium text-[#26415C]">
            {activeQrCount} <span className="text-xs font-sans text-[#5B6472] font-normal">On this console</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Navigation & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-white p-3 border border-[#E4E1DA] rounded-lg">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-[#26415C] text-white'
                : 'bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] border border-[#E4E1DA]'
            }`}
          >
            All Hostels ({hostels.length})
          </button>
          <button
            onClick={() => setFilterType('BOYS')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
              filterType === 'BOYS'
                ? 'bg-[#26415C] text-white'
                : 'bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] border border-[#E4E1DA]'
            }`}
          >
            Boys Hostels ({hostels.filter((h) => h.type === 'BOYS').length})
          </button>
          <button
            onClick={() => setFilterType('GIRLS')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
              filterType === 'GIRLS'
                ? 'bg-[#26415C] text-white'
                : 'bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] border border-[#E4E1DA]'
            }`}
          >
            Girls Hostels ({hostels.filter((h) => h.type === 'GIRLS').length})
          </button>
          <button
            onClick={() => setFilterType('CENTRAL')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
              filterType === 'CENTRAL'
                ? 'bg-[#26415C] text-white'
                : 'bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] border border-[#E4E1DA]'
            }`}
          >
            Central Campus Mess ({centralMessDevices.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hostel or kiosk code..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
          />
        </div>
      </div>

      {/* 4. Hostels & Kiosks List */}
      {isLoading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-[#5B6472] text-xs gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-[#26415C]" />
          <span>Loading campus hostels and hardware kiosk terminals...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* A. Central Campus Mess Section (When ALL or CENTRAL selected) */}
          {(filterType === 'ALL' || filterType === 'CENTRAL') && centralMessDevices.length > 0 && (
            <div className="bg-white border border-[#E4E1DA] rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 sm:p-5 bg-[#FAF9F6] border-b border-[#E4E1DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#B7791F]/10 border border-[#B7791F]/20 text-[#B7791F]">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#26415C] text-white">
                        CENTRAL
                      </span>
                      <h2 className="text-base font-serif font-medium text-[#1C2430]">
                        MANIT Central Campus Mess
                      </h2>
                    </div>
                    <p className="text-xs text-[#5B6472] mt-0.5">
                      Main Institute Dining Hall • Serving all students and staff • {centralMessDevices.length} Kiosk Counter(s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLoadAllHostelQrs(centralMessDevices)}
                    className="px-3 py-1.5 rounded bg-white hover:bg-[#FAF9F6] border border-[#E4E1DA] text-[#26415C] text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#26415C]" />
                    <span>Load Central QRs</span>
                  </button>
                  <button
                    onClick={() => toggleHostel('CENTRAL')}
                    className="p-1.5 rounded hover:bg-white text-[#5B6472] hover:text-[#1C2430] transition cursor-pointer"
                    title={expandedHostels['CENTRAL'] ? 'Collapse' : 'Expand'}
                  >
                    {expandedHostels['CENTRAL'] ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {expandedHostels['CENTRAL'] && (
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {centralMessDevices.map((device) => renderKioskCard(device))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* B. All Hostels (H1 to H12) */}
          {filterType !== 'CENTRAL' &&
            filteredHostels.map((hostel) => {
              const { gateDevs, messDevs, all } = getHostelDevices(hostel);
              const isExpanded = expandedHostels[hostel.id] !== false;
              const hasActiveQr = all.some((d) => loadedQrs[d.id]?.token);

              return (
                <div
                  key={hostel.id}
                  className="bg-white border border-[#E4E1DA] rounded-xl overflow-hidden shadow-xs transition hover:border-[#26415C]/40"
                >
                  {/* Hostel Header Card */}
                  <div className="p-4 sm:p-5 bg-[#FAF9F6] border-b border-[#E4E1DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-[#26415C] text-white font-mono font-bold text-sm shadow-xs shrink-0">
                        {hostel.code}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base sm:text-lg font-serif font-medium text-[#1C2430]">
                            {hostel.name}
                          </h2>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                              hostel.type === 'GIRLS'
                                ? 'bg-[#9B2C2C]/10 text-[#9B2C2C] border-[#9B2C2C]/20'
                                : 'bg-[#26415C]/10 text-[#26415C] border-[#26415C]/20'
                            }`}
                          >
                            {hostel.type === 'GIRLS' ? 'Girls Hostel' : 'Boys Hostel'}
                          </span>
                        </div>
                        <p className="text-xs text-[#5B6472] mt-0.5">
                          {hostel.location} • Capacity: {hostel.total_capacity} residents •{' '}
                          <span className="font-medium text-[#1C2430]">
                            {gateDevs.length} Gate Kiosk{gateDevs.length === 1 ? '' : 's'}
                          </span>
                          {' • '}
                          <span className="font-medium text-[#1C2430]">
                            {messDevs.length} Mess Kiosk{messDevs.length === 1 ? '' : 's'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {hasActiveQr ? (
                        <button
                          onClick={() => handleHideAllHostelQrs(all)}
                          className="px-3 py-1.5 rounded bg-white hover:bg-[#FAF9F6] border border-[#E4E1DA] hover:border-[#B3432B] text-[#B3432B] text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Hide QRs for this hostel"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hide QRs</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLoadAllHostelQrs(all)}
                          className="px-3 py-1.5 rounded bg-white hover:bg-[#FAF9F6] border border-[#E4E1DA] hover:border-[#26415C] text-[#26415C] text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Load and render all Gate and Mess QRs for this hostel"
                        >
                          <QrCode className="w-3.5 h-3.5 text-[#26415C]" />
                          <span>Load {hostel.code} QRs</span>
                        </button>
                      )}

                      <button
                        onClick={() => toggleHostel(hostel.id)}
                        className="p-1.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] transition cursor-pointer"
                        title={isExpanded ? 'Collapse section' : 'Expand section'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Hostel Kiosks Content */}
                  {isExpanded && (
                    <div className="p-5 space-y-6">
                      {/* Gate Kiosks Subsection */}
                      <div>
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E4E1DA]/60">
                          <div className="flex items-center gap-2">
                            <DoorOpen className="w-4 h-4 text-[#26415C]" />
                            <h3 className="text-xs font-semibold text-[#1C2430] uppercase tracking-wider">
                              Gate Attendance Terminals ({gateDevs.length})
                            </h3>
                          </div>
                          <span className="text-[11px] text-[#5B6472]">
                            Dynamic ENTRY / EXIT reverse attendance
                          </span>
                        </div>

                        {gateDevs.length === 0 ? (
                          <div className="p-4 rounded-lg bg-[#FAF9F6] border border-dashed border-[#E4E1DA] text-center text-xs text-[#5B6472]">
                            No gate terminals registered for {hostel.code} yet.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {gateDevs.map((device) => renderKioskCard(device))}
                          </div>
                        )}
                      </div>

                      {/* Mess Kiosks Subsection */}
                      <div>
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E4E1DA]/60">
                          <div className="flex items-center gap-2">
                            <Utensils className="w-4 h-4 text-[#B7791F]" />
                            <h3 className="text-xs font-semibold text-[#1C2430] uppercase tracking-wider">
                              Dining Hall Attendance Counters ({messDevs.length})
                            </h3>
                          </div>
                          <span className="text-[11px] text-[#5B6472]">
                            Meal window attendance • Standby when closed
                          </span>
                        </div>

                        {messDevs.length === 0 ? (
                          <div className="p-4 rounded-lg bg-[#FAF9F6] border border-dashed border-[#E4E1DA] text-center text-xs text-[#5B6472]">
                            No dining hall terminals registered for {hostel.code} yet.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {messDevs.map((device) => renderKioskCard(device))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {filterType !== 'CENTRAL' && filteredHostels.length === 0 && (
            <div className="text-center py-16 bg-white border border-[#E4E1DA] rounded-lg p-8">
              <Laptop className="w-10 h-10 text-[#5B6472] mx-auto mb-3" strokeWidth={1.5} />
              <h3 className="text-sm font-medium text-[#1C2430] mb-1">No hostels match your filter</h3>
              <p className="text-xs text-[#5B6472] max-w-sm mx-auto mb-4">
                Try clearing your search query or selecting "All Hostels".
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('ALL');
                }}
                className="px-3.5 py-1.5 bg-[#26415C] text-white rounded text-xs font-medium transition cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1C2430]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E4E1DA] max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E4E1DA]">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-[#26415C]" />
                <h3 className="text-base font-serif font-medium text-[#1C2430]">
                  Register custom kiosk device
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-[#5B6472] hover:text-[#1C2430] hover:bg-[#FAF9F6] transition cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">
                  Device Display Name <span className="text-[#B3432B]">*</span>
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. H2 Main Gate Terminal"
                  required
                  className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">
                  Device Code (Unique Identifier)
                </label>
                <input
                  type="text"
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  placeholder="e.g. H2_GATE_MAIN or H2_MESS"
                  className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">
                  Terminal Purpose <span className="text-[#B3432B]">*</span>
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as 'GATE' | 'MESS')}
                  className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                >
                  <option value="GATE">Hostel Gate (ENTRY / EXIT)</option>
                  <option value="MESS">Dining Counter / Mess Attendance</option>
                </select>
              </div>

              {purpose === 'GATE' ? (
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Bound Hostel Gate <span className="text-[#B3432B]">*</span>
                  </label>
                  <select
                    value={selectedGateId}
                    onChange={(e) => setSelectedGateId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  >
                    <option value="">Select a gate...</option>
                    {gates.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.hostel?.code} — {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Bound Mess / Dining Hall <span className="text-[#B3432B]">*</span>
                  </label>
                  <select
                    value={selectedMessId}
                    onChange={(e) => setSelectedMessId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  >
                    <option value="">Select a mess...</option>
                    {messes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded bg-white border border-[#E4E1DA] text-[#5B6472] hover:text-[#1C2430] text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? 'Registering...' : 'Register device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-time Secret Modal */}
      {secretModalData && (
        <div className="fixed inset-0 z-50 bg-[#1C2430]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E4E1DA] max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-2 text-[#2E7D5B] mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="font-serif text-base font-medium text-[#1C2430]">
                Device registered successfully
              </h3>
            </div>
            <p className="text-xs text-[#5B6472] mb-4">
              Copy this 32-byte secret now. It is hashed with bcrypt at rest and will not be displayed again:
            </p>

            <div className="p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded font-mono text-xs text-[#1C2430] break-all mb-4 select-all">
              {secretModalData.secret}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={handleCopySecret}
                className="px-3.5 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copiedSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSecret ? 'Copied to clipboard' : 'Copy secret'}</span>
              </button>
              <button
                onClick={() => setSecretModalData(null)}
                className="px-3.5 py-2 rounded bg-white border border-[#E4E1DA] text-[#1C2430] text-xs font-medium transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
