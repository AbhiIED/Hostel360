import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  ShieldCheck,
  Clock,
  Maximize2,
  Minimize2,
  RefreshCw,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Building,
  Utensils,
  Wifi,
  WifiOff,
  SlidersHorizontal,
  X,
} from 'lucide-react';

interface DeviceMetadata {
  id: string;
  device_code?: string;
  device_name: string;
  purpose: 'GATE' | 'MESS';
  is_active: boolean;
  gate?: {
    id: string;
    name: string;
    hostel?: {
      id: string;
      code: string;
      name: string;
      type: string;
    };
  };
  mess?: {
    id: string;
    name: string;
  };
}

interface MealWindowInfo {
  id: string;
  meal_type: string;
  start_time: string;
  end_time: string;
}

interface QrTokenResponse {
  token: string;
  expires_at: string;
  ttl: number;
  purpose: 'GATE' | 'MESS';
  device: {
    id: string;
    device_name: string;
    device_code?: string;
    purpose: 'GATE' | 'MESS';
    gate?: any;
    mess?: any;
  };
  meal_window?: MealWindowInfo | null;
}

interface ConfirmationFlash {
  studentName: string;
  rollNumber: string;
  photoUrl?: string;
  direction?: 'ENTRY' | 'EXIT';
  mealType?: string;
  timestamp: string;
}

export const KioskDisplayPage: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();

  const [deviceInfo, setDeviceInfo] = useState<DeviceMetadata | null>(null);
  const [deviceSecret, setDeviceSecret] = useState<string>('');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [secretInput, setSecretInput] = useState<string>('');
  const [configError, setConfigError] = useState<string>('');

  const [qrToken, setQrToken] = useState<string>('');
  const [mealWindow, setMealWindow] = useState<MealWindowInfo | null>(null);
  const [ttlTotal, setTtlTotal] = useState<number>(20);
  const [secondsLeft, setSecondsLeft] = useState<number>(20);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  // Anti-proxy confirmation flash overlay state
  const [confirmation, setConfirmation] = useState<ConfirmationFlash | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);
  const storageKey = `hostel360_device_secret_${deviceId}`;

  // Live Clock updater
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check saved secret from localStorage
  useEffect(() => {
    if (!deviceId) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setDeviceSecret(saved);
      setSecretInput(saved);
    } else {
      setShowConfigModal(true);
    }
  }, [deviceId, storageKey]);

  // Fetch public device info
  const fetchDeviceInfo = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await axios.get(`/api/display/info/${deviceId}`);
      setDeviceInfo(res.data.device);
    } catch (err: any) {
      console.warn('Could not fetch device metadata:', err);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDeviceInfo();
  }, [fetchDeviceInfo]);

  // Fetch rotating QR token from backend
  const fetchNextQrToken = useCallback(async () => {
    if (!deviceId || !deviceSecret) return;
    setIsRotating(true);
    setErrorStatus(null);

    try {
      const res = await axios.get<QrTokenResponse>('/api/display/qr', {
        headers: {
          Authorization: `Bearer ${deviceSecret}`,
          'x-device-id': deviceId,
        },
      });

      const data = res.data;
      setQrToken(data.token);
      setMealWindow(data.meal_window || null);
      const ttl = data.ttl || 20;
      setTtlTotal(ttl);
      setSecondsLeft(ttl);

      if (data.device) {
        setDeviceInfo((prev) => ({
          ...(prev || {}),
          ...data.device,
          is_active: true,
        } as DeviceMetadata));
      }
    } catch (err: any) {
      console.error('Error fetching QR token:', err);
      if (err.response?.status === 401) {
        setErrorStatus('Unauthorized: Invalid or expired device secret. Please reconfigure secret.');
        setShowConfigModal(true);
      } else if (err.response?.status === 403) {
        setErrorStatus('Device Disabled: This terminal has been deactivated by the administrator.');
      } else {
        setErrorStatus('Connection Error: Unable to fetch QR code from server. Retrying...');
      }
    } finally {
      setIsRotating(false);
    }
  }, [deviceId, deviceSecret]);

  // Countdown timer effect
  useEffect(() => {
    if (!qrToken || showConfigModal || errorStatus?.includes('Unauthorized')) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          fetchNextQrToken();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [qrToken, showConfigModal, errorStatus, fetchNextQrToken]);

  // Initial trigger when secret is set
  useEffect(() => {
    if (deviceSecret && deviceId) {
      fetchNextQrToken();
    }
  }, [deviceSecret, deviceId, fetchNextQrToken]);

  // Socket.IO Setup for real-time connection & anti-proxy confirmation flash
  useEffect(() => {
    if (!deviceId) return;

    const socket = io('/', {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsSocketConnected(true);
      socket.emit('join', `device:${deviceId}`);
    });

    socket.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    // Anti-proxy confirmation flash listener
    socket.on('display:confirm', (data: ConfirmationFlash) => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setConfirmation(data);

      // Flash for 5 seconds as mandated by ARCHITECTURE.md
      flashTimerRef.current = setTimeout(() => {
        setConfirmation(null);
      }, 5000);
    });

    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      socket.disconnect();
    };
  }, [deviceId]);

  // Handle Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Handle saving new secret
  const handleSaveSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretInput.trim()) {
      setConfigError('Device secret cannot be empty');
      return;
    }
    localStorage.setItem(storageKey, secretInput.trim());
    setDeviceSecret(secretInput.trim());
    setShowConfigModal(false);
    setConfigError('');
    setErrorStatus(null);
  };

  // Color calculation for circular ring & timer badge
  const percentLeft = Math.max(0, Math.min(100, (secondsLeft / ttlTotal) * 100));
  const isUrgent = secondsLeft <= 5;
  const isWarning = secondsLeft > 5 && secondsLeft <= 10;

  const timerColor = isUrgent
    ? 'text-rose-400 stroke-rose-500 border-rose-500/40 bg-rose-500/10'
    : isWarning
    ? 'text-amber-400 stroke-amber-500 border-amber-500/40 bg-amber-500/10'
    : 'text-emerald-400 stroke-emerald-500 border-emerald-500/40 bg-emerald-500/10';

  const strokeColor = isUrgent ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981';

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between select-none overflow-hidden font-sans">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* TOP HEADER BAR */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between z-10">
        {/* Left: Branding & Campus */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-500 p-0.5 shadow-lg shadow-sky-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <QrCode className="w-6 h-6 text-sky-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                HOSTEL<span className="text-sky-400">360</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                  KIOSK TERMINAL
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              MANIT BHOPAL CAMPUS • SECURE ACCESS CONTROL
            </p>
          </div>
        </div>

        {/* Center: Location Details */}
        <div className="hidden md:flex flex-col items-center text-center">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-lg">
            {deviceInfo?.purpose === 'MESS' ? (
              <>
                <Utensils className="w-5 h-5 text-amber-400" />
                <span>{deviceInfo.mess?.name || 'Campus Mess Counter'}</span>
              </>
            ) : (
              <>
                <Building className="w-5 h-5 text-sky-400" />
                <span>
                  {deviceInfo?.gate?.hostel?.name || deviceInfo?.device_name || 'Hostel Access Gate'}
                  {deviceInfo?.gate?.name ? ` — ${deviceInfo.gate.name}` : ''}
                </span>
              </>
            )}
          </div>
          {deviceInfo?.purpose === 'MESS' && mealWindow && (
            <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 px-3 py-0.5 rounded-full border border-amber-500/20 mt-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-bold">{mealWindow.meal_type} WINDOW</span>
              <span className="text-slate-400">({mealWindow.start_time} - {mealWindow.end_time})</span>
            </div>
          )}
        </div>

        {/* Right: Clock & System Controls */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-lg font-mono font-bold text-white tracking-wider">
              {currentTime}
            </div>
            <div className="text-xs text-slate-400">{currentDate}</div>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              isSocketConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
            title={isSocketConnected ? 'Real-time WebSocket Live' : 'WebSocket Disconnected'}
          >
            {isSocketConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">ONLINE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">RECONNECTING</span>
              </>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 shadow"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Config Settings Button */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 shadow"
            title="Configure Device Secret"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN CENTER DISPLAY AREA */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {errorStatus && !qrToken ? (
          /* Error / Configuration state */
          <div className="max-w-md w-full bg-slate-900/90 border border-rose-500/30 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Display Offline</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">{errorStatus}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => fetchNextQrToken()}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm transition flex items-center gap-2 border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={() => setShowConfigModal(true)}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium text-sm transition flex items-center gap-2 shadow-lg shadow-sky-600/30"
              >
                <KeyRound className="w-4 h-4" />
                Configure Secret
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE ROTATING QR CARD */
          <div className="flex flex-col items-center">
            {/* Header Badge */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 text-xs font-semibold mb-6 shadow-md backdrop-blur">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span>DYNAMIC ONE-TIME QR CODE</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{ttlTotal}s ANTI-PROXY CYCLE</span>
            </div>

            {/* QR Card Container */}
            <div className="relative p-6 sm:p-8 bg-slate-900/95 border-2 border-slate-700/80 rounded-3xl shadow-2xl shadow-sky-950/40 backdrop-blur-2xl flex flex-col items-center">
              {/* Corner accent brackets for futuristic kiosk aesthetic */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-sky-400 rounded-tl-sm pointer-events-none" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-sky-400 rounded-tr-sm pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-sky-400 rounded-bl-sm pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-sky-400 rounded-br-sm pointer-events-none" />

              {/* QR Canvas / SVG */}
              <div className="bg-white p-5 rounded-2xl shadow-inner flex items-center justify-center transition-all duration-300">
                {qrToken ? (
                  <QRCodeSVG
                    value={qrToken}
                    size={280}
                    level="H"
                    includeMargin={false}
                    className="w-56 h-56 sm:w-72 sm:h-72 transition-opacity duration-300"
                  />
                ) : (
                  <div className="w-56 h-56 sm:w-72 sm:h-72 flex flex-col items-center justify-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin text-sky-500 mb-2" />
                    <span className="text-xs font-medium">Generating QR...</span>
                  </div>
                )}
              </div>

              {/* Scanning Instructions */}
              <div className="mt-6 text-center">
                <div className="text-base font-bold text-white tracking-wide flex items-center justify-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-400" />
                  <span>Scan with HOSTEL360 Student App</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Point camera at screen • Authenticated scans record attendance instantly
                </p>
              </div>

              {/* Progress & Countdown Bar */}
              <div className="w-full mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between gap-4">
                {/* Visual Circular / Pill Timer */}
                <div className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-colors ${timerColor}`}>
                  <Clock className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                  <span>
                    {isRotating ? 'Rotating...' : `Rotates in ${secondsLeft}s`}
                  </span>
                </div>

                {/* Progress bar line */}
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${percentLeft}%`,
                      backgroundColor: strokeColor,
                    }}
                  />
                </div>

                {/* Refresh Trigger Button */}
                <button
                  onClick={() => fetchNextQrToken()}
                  disabled={isRotating}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition disabled:opacity-50"
                  title="Force Rotate Now"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER BAR */}
      <footer className="px-6 py-3 border-t border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 z-10 gap-2">
        <div className="flex items-center gap-3">
          <span>Terminal ID: <code className="text-slate-400">{deviceInfo?.device_code || deviceId}</code></span>
          <span>•</span>
          <span>Type: <strong className="text-slate-300">{deviceInfo?.purpose || 'GATE'}</strong></span>
          <span>•</span>
          <span>Security: <strong className="text-emerald-400">SHA-256 OPAQUE</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span>HOSTEL360 v1.0 Production Engine</span>
          <span>•</span>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-sky-400 underline transition"
          >
            Back to Dashboard
          </button>
        </div>
      </footer>

      {/* ANTI-PROXY CONFIRMATION FLASH MODAL (5s Visual Verification) */}
      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <div className="relative max-w-lg w-full bg-gradient-to-b from-slate-900 to-slate-950 border-4 border-emerald-500 rounded-3xl p-8 shadow-2xl shadow-emerald-500/30 text-center flex flex-col items-center">
            {/* Top Success Badge */}
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mb-4 shadow-lg animate-bounce">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="inline-block px-4 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-extrabold text-sm tracking-wider uppercase mb-4">
              {confirmation.direction
                ? `${confirmation.direction} CONFIRMED`
                : confirmation.mealType
                ? `${confirmation.mealType} RECORDED`
                : 'ATTENDANCE CONFIRMED'}
            </div>

            {/* Student Photo */}
            <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-slate-700 shadow-xl mb-4 bg-slate-800">
              {confirmation.photoUrl ? (
                <img
                  src={confirmation.photoUrl}
                  alt={confirmation.studentName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-3xl font-bold bg-slate-800">
                  {confirmation.studentName?.charAt(0) || 'S'}
                </div>
              )}
            </div>

            {/* Student Details */}
            <h2 className="text-2xl font-black text-white tracking-tight">
              {confirmation.studentName}
            </h2>
            <p className="text-lg font-mono font-semibold text-emerald-400 mt-1">
              {confirmation.rollNumber}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Verified at {confirmation.timestamp || currentTime}
            </p>

            {/* 5-second countdown pill */}
            <div className="mt-6 text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Anti-proxy verification auto-dismisses in 5s...</span>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURATION / SECRET SETUP MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Configure Kiosk Secret</h3>
                  <p className="text-xs text-slate-400">Terminal Authentication Setup</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSecret} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Device ID or Code
                </label>
                <input
                  type="text"
                  value={deviceId}
                  disabled
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  32-Byte Secret Key (Hex)
                </label>
                <input
                  type="password"
                  placeholder="Paste device secret generated during registration..."
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl text-white text-sm font-mono placeholder:text-slate-600 focus:outline-none"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Stored securely in kiosk browser localStorage. Never transmitted to 3rd parties.
                </p>
              </div>

              {configError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {configError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition shadow-lg shadow-sky-600/30"
                >
                  Save & Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KioskDisplayPage;
