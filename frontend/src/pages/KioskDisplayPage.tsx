import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
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
  SlidersHorizontal,
  X,
  Copy,
  ArrowLeft,
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
  next_meal_window?: MealWindowInfo | null;
  all_meal_windows?: MealWindowInfo[];
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
  const { isAuthenticated, user } = useAuth();

  const [deviceInfo, setDeviceInfo] = useState<DeviceMetadata | null>(null);
  const [deviceSecret, setDeviceSecret] = useState<string>('');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [secretInput, setSecretInput] = useState<string>('');
  const [configError, setConfigError] = useState<string>('');

  const [qrToken, setQrToken] = useState<string>('');
  const [mealWindow, setMealWindow] = useState<MealWindowInfo | null>(null);
  const [nextMealWindow, setNextMealWindow] = useState<MealWindowInfo | null>(null);
  const [allMealWindows, setAllMealWindows] = useState<MealWindowInfo[]>([]);
  const [ttlTotal, setTtlTotal] = useState<number>(20);
  const [secondsLeft, setSecondsLeft] = useState<number>(20);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  // Anti-proxy confirmation flash overlay state
  const [confirmation, setConfirmation] = useState<ConfirmationFlash | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `hostel360_device_secret_${deviceId}`;

  // Exit navigation handler
  const handleExit = () => {
    if (isAuthenticated) {
      if (user?.role === 'STUDENT') {
        navigate('/app');
      } else {
        navigate('/dashboard');
      }
    } else {
      navigate('/');
    }
  };

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
      if (res.data.meal_status) {
        setMealWindow(res.data.meal_status.active || null);
        setNextMealWindow(res.data.meal_status.next || null);
        setAllMealWindows(res.data.meal_status.allWindows || []);
      }
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
      setNextMealWindow(data.next_meal_window || null);
      setAllMealWindows(data.all_meal_windows || []);
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

  // Percentage for progress bar
  const percentLeft = Math.max(0, Math.min(100, (secondsLeft / ttlTotal) * 100));
  const isUrgent = secondsLeft <= 5;
  const isWarning = secondsLeft > 5 && secondsLeft <= 10;

  return (
    <div className="relative min-h-screen w-full bg-[#FAF9F6] text-[#1C2430] flex flex-col justify-between select-none font-sans">
      {/* TOP HEADER BAR */}
      <header className="px-4 sm:px-6 py-3 border-b border-[#E4E1DA] bg-white flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Left: Exit Navigation & Crest */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FAF9F6] hover:bg-[#F2EFE9] text-[#1C2430] border border-[#E4E1DA] text-xs font-medium transition cursor-pointer"
            title="Exit kiosk and return"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#26415C]" strokeWidth={2} />
            <span>Exit kiosk</span>
          </button>

          <div className="h-5 w-px bg-[#E4E1DA]" />

          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[#26415C]" strokeWidth={1.75} />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-base font-semibold tracking-tight text-[#1C2430]">
                  HOSTEL360
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-[#FAF9F6] text-[#5B6472] border border-[#E4E1DA] font-medium">
                  Terminal kiosk
                </span>
              </div>
              <p className="text-[10px] text-[#5B6472] font-normal tracking-wide">
                MANIT Bhopal • Council of Wardens
              </p>
            </div>
          </div>
        </div>

        {/* Center: Location Details & Meal Window */}
        <div className="hidden md:flex flex-col items-center text-center">
          <div className="flex items-center gap-2 text-[#1C2430] font-medium text-sm">
            {deviceInfo?.purpose === 'MESS' ? (
              <>
                <Utensils className="w-4 h-4 text-[#26415C]" strokeWidth={1.75} />
                <span>{deviceInfo.mess?.name || 'Central Campus Mess Counter'}</span>
              </>
            ) : (
              <>
                <Building className="w-4 h-4 text-[#26415C]" strokeWidth={1.75} />
                <span>
                  {deviceInfo?.gate?.hostel?.name || deviceInfo?.device_name || 'Hostel Access Gate'}
                  {deviceInfo?.gate?.name ? ` — ${deviceInfo.gate.name}` : ''}
                </span>
              </>
            )}
          </div>
          {deviceInfo?.purpose === 'MESS' && (
            <div className="text-[11px] text-[#5B6472] mt-0.5 flex items-center gap-1.5">
              {mealWindow ? (
                <span className="inline-flex items-center gap-1 text-[#2E7D5B] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B] animate-pulse" />
                  {mealWindow.meal_type} window active ({mealWindow.start_time} - {mealWindow.end_time})
                </span>
              ) : (
                <span className="text-[#B7791F] font-medium inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B7791F]" />
                  Dining counter standby • No active meal service
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Clock & Terminal Controls */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-mono font-medium text-[#1C2430] tabular-nums">
              {currentTime}
            </div>
            <div className="text-[11px] text-[#5B6472]">{currentDate}</div>
          </div>

          <div className="h-5 w-px bg-[#E4E1DA] hidden sm:block" />

          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${
              isSocketConnected
                ? 'bg-[#2E7D5B]/10 border-[#2E7D5B]/30 text-[#2E7D5B]'
                : 'bg-[#B3432B]/10 border-[#B3432B]/30 text-[#B3432B]'
            }`}
            title={isSocketConnected ? 'Real-time WebSocket Live' : 'WebSocket Disconnected'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-[#2E7D5B]' : 'bg-[#B3432B]'}`} />
            <span className="hidden lg:inline">{isSocketConnected ? 'Live sync' : 'Reconnecting'}</span>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded bg-white hover:bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] transition border border-[#E4E1DA] cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Config Settings Button */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 rounded bg-white hover:bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] transition border border-[#E4E1DA] cursor-pointer"
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
          <div className="max-w-md w-full bg-white border border-[#B3432B]/30 rounded-xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#B3432B]/10 text-[#B3432B] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <h2 className="font-serif text-lg font-medium text-[#1C2430] mb-2">Display Offline</h2>
            <p className="text-[#5B6472] text-xs mb-6 leading-relaxed">{errorStatus}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => fetchNextQrToken()}
                className="px-4 py-2 bg-white hover:bg-[#FAF9F6] text-[#1C2430] rounded border border-[#E4E1DA] font-medium text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
              <button
                onClick={() => setShowConfigModal(true)}
                className="px-4 py-2 bg-[#26415C] hover:bg-[#1e344a] text-white rounded font-medium text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Configure Secret
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE KIOSK DISPLAY CARD */
          <div className="flex flex-col items-center w-full max-w-lg">
            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E4E1DA] text-xs font-medium text-[#26415C] mb-6 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#26415C] animate-pulse" />
              {deviceInfo?.purpose === 'MESS' && mealWindow ? (
                <>
                  <span>{mealWindow.meal_type} service active</span>
                  <span className="text-[#E4E1DA]">•</span>
                  <span className="text-[#5B6472] font-mono">{mealWindow.start_time} - {mealWindow.end_time}</span>
                  <span className="text-[#E4E1DA]">•</span>
                  <span className="text-[#5B6472]">{ttlTotal}s dynamic cycle</span>
                </>
              ) : deviceInfo?.purpose === 'MESS' && !mealWindow ? (
                <>
                  <span className="text-[#B7791F]">Dining counter standby</span>
                  <span className="text-[#E4E1DA]">•</span>
                  <span className="text-[#5B6472]">No meal currently serving</span>
                </>
              ) : (
                <>
                  <span>Dynamic one-time QR code</span>
                  <span className="text-[#E4E1DA]">•</span>
                  <span className="text-[#5B6472]">{ttlTotal}s anti-proxy cycle</span>
                </>
              )}
            </div>

            {/* Main Institutional Pedestal Card */}
            <div className="bg-white border border-[#E4E1DA] rounded-xl p-6 sm:p-8 shadow-sm flex flex-col items-center w-full">
              {/* Standby Schedule or Active QR Code */}
              {deviceInfo?.purpose === 'MESS' && !mealWindow ? (
                <div className="w-full flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[#B7791F]/10 border border-[#B7791F]/20 text-[#B7791F] flex items-center justify-center mb-3">
                    <Utensils className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <h2 className="font-serif text-lg font-medium text-[#1C2430] mb-1">
                    Dining Counter on Standby
                  </h2>
                  <p className="text-xs text-[#5B6472] mb-4">
                    {nextMealWindow
                      ? `Next: ${nextMealWindow.meal_type} (${nextMealWindow.start_time} - ${nextMealWindow.end_time})`
                      : 'No meal window scheduled right now'}
                  </p>

                  <div className="w-full bg-[#FAF9F6] border border-[#E4E1DA] rounded-lg p-3.5 text-xs mb-4">
                    <div className="text-[11px] font-medium text-[#1C2430] uppercase tracking-wider mb-2.5 pb-1.5 border-b border-[#E4E1DA] flex justify-between">
                      <span>Official Dining Schedule</span>
                      <span className="text-[10px] text-[#5B6472] font-normal">Council of Wardens</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      {allMealWindows.length > 0 ? (
                        allMealWindows.map((w) => (
                          <div key={w.id} className="flex justify-between items-center py-0.5 border-b border-[#E4E1DA]/50 last:border-0">
                            <span className="capitalize font-medium text-[#1C2430]">{w.meal_type.toLowerCase()}</span>
                            <span className="font-mono text-[#5B6472] tabular-nums">{w.start_time} - {w.end_time}</span>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex justify-between items-center py-0.5 border-b border-[#E4E1DA]/50">
                            <span className="font-medium text-[#1C2430]">Breakfast</span>
                            <span className="font-mono text-[#5B6472] tabular-nums">07:30 - 09:30</span>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-[#E4E1DA]/50">
                            <span className="font-medium text-[#1C2430]">Lunch</span>
                            <span className="font-mono text-[#5B6472] tabular-nums">12:30 - 14:30</span>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-[#E4E1DA]/50">
                            <span className="font-medium text-[#1C2430]">Snacks</span>
                            <span className="font-mono text-[#5B6472] tabular-nums">17:00 - 18:30</span>
                          </div>
                          <div className="flex justify-between items-center py-0.5 last:border-0">
                            <span className="font-medium text-[#1C2430]">Dinner</span>
                            <span className="font-mono text-[#5B6472] tabular-nums">20:00 - 22:00</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-[#5B6472]">
                    QR code activates automatically when the scheduled meal window opens.
                  </p>
                </div>
              ) : qrToken ? (
                <div className="flex flex-col items-center">
                  <div className="p-4 bg-white rounded-lg border border-[#E4E1DA] shadow-xs">
                    <QRCodeSVG
                      value={qrToken}
                      size={260}
                      level="H"
                      includeMargin={false}
                      className="w-56 h-56 sm:w-64 sm:h-64 transition-opacity duration-300"
                    />
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(qrToken);
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 2500);
                    }}
                    className="mt-3 px-3 py-1.5 rounded bg-[#FAF9F6] hover:bg-[#F2EFE9] text-[#5B6472] hover:text-[#1C2430] text-xs font-mono border border-[#E4E1DA] flex items-center gap-1.5 transition cursor-pointer"
                    title="Copy active token string for manual testing in Student App"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#26415C]" />
                    <span>{copiedToken ? '✓ Copied to clipboard' : 'Copy test token'}</span>
                  </button>
                </div>
              ) : (
                <div className="w-56 h-56 sm:w-64 sm:h-64 flex flex-col items-center justify-center text-[#5B6472]">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#26415C] mb-2" />
                  <span className="text-xs font-medium">Generating dynamic QR...</span>
                </div>
              )}

              {/* Scanning Instructions */}
              <div className="mt-6 text-center max-w-sm">
                <div className="text-sm font-serif font-medium text-[#1C2430] flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#2E7D5B]" strokeWidth={2} />
                  <span>
                    {deviceInfo?.purpose === 'MESS'
                      ? mealWindow
                        ? `Scan with Student App for ${mealWindow.meal_type}`
                        : 'Dining counter standby'
                      : 'Scan with HOSTEL360 Student App'}
                  </span>
                </div>
                <p className="text-xs text-[#5B6472] mt-1 leading-relaxed">
                  {deviceInfo?.purpose === 'MESS' && !mealWindow
                    ? 'Attendance recording opens automatically during active meal hours'
                    : 'Open camera scanner on your mobile • Attendance is authenticated and recorded in real time'}
                </p>
              </div>

              {/* Progress & Countdown Bar */}
              <div className="w-full mt-6 pt-5 border-t border-[#E4E1DA] flex items-center justify-between gap-3">
                {/* Visual Circular / Pill Timer */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-xs font-mono text-[#1C2430]">
                  <Clock className={`w-3.5 h-3.5 text-[#26415C] ${isRotating ? 'animate-spin' : ''}`} />
                  <span>{isRotating ? 'Rotating...' : `${secondsLeft}s`}</span>
                </div>

                {/* Progress bar line */}
                <div className="flex-1 h-1.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${percentLeft}%`,
                      backgroundColor: isUrgent ? '#B3432B' : isWarning ? '#B7791F' : '#26415C',
                    }}
                  />
                </div>

                {/* Force Refresh Trigger */}
                <button
                  onClick={() => fetchNextQrToken()}
                  disabled={isRotating}
                  className="p-1.5 rounded bg-white hover:bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] transition border border-[#E4E1DA] disabled:opacity-50 cursor-pointer"
                  title="Force rotate new QR code"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER BAR */}
      <footer className="px-4 sm:px-6 py-3 border-t border-[#E4E1DA] bg-white flex flex-col sm:flex-row items-center justify-between text-xs text-[#5B6472] z-10 gap-2">
        <div className="flex items-center gap-2.5">
          <span>Terminal ID: <code className="font-mono text-[#1C2430]">{deviceInfo?.device_code || deviceId}</code></span>
          <span className="text-[#E4E1DA]">•</span>
          <span>Type: <strong className="text-[#1C2430] font-medium">{deviceInfo?.purpose || 'GATE'}</strong></span>
          <span className="text-[#E4E1DA]">•</span>
          <span>Security: <strong className="text-[#2E7D5B] font-medium">SHA-256 HMAC Opaque</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span>Council of Wardens • MANIT Bhopal</span>
          <span className="text-[#E4E1DA]">•</span>
          <button
            onClick={handleExit}
            className="text-[#26415C] hover:underline font-medium cursor-pointer"
          >
            Exit Kiosk
          </button>
        </div>
      </footer>

      {/* ANTI-PROXY CONFIRMATION FLASH MODAL (5s Visual Verification) */}
      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C2430]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-w-sm w-full bg-white border-2 border-[#2E7D5B] rounded-xl p-6 shadow-2xl text-center flex flex-col items-center">
            {/* Top Success Icon */}
            <div className="w-12 h-12 rounded-full bg-[#2E7D5B]/10 border border-[#2E7D5B]/20 text-[#2E7D5B] flex items-center justify-center mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="inline-block px-3 py-0.5 rounded bg-[#2E7D5B]/10 border border-[#2E7D5B]/20 text-[#2E7D5B] font-medium text-xs tracking-wider uppercase mb-3">
              {confirmation.direction
                ? `${confirmation.direction} confirmed`
                : confirmation.mealType
                ? `${confirmation.mealType} attendance recorded`
                : 'Attendance confirmed'}
            </div>

            {/* Student Photo */}
            <div className="w-24 h-24 rounded-lg overflow-hidden border border-[#E4E1DA] bg-[#FAF9F6] shadow-xs mb-3">
              {confirmation.photoUrl ? (
                <img
                  src={confirmation.photoUrl}
                  alt={confirmation.studentName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#5B6472] text-2xl font-serif bg-[#FAF9F6]">
                  {confirmation.studentName?.charAt(0) || 'S'}
                </div>
              )}
            </div>

            {/* Student Details */}
            <h2 className="font-serif text-lg font-medium text-[#1C2430]">
              {confirmation.studentName}
            </h2>
            <p className="font-mono text-sm font-medium text-[#26415C] mt-0.5 tabular-nums">
              {confirmation.rollNumber}
            </p>
            <p className="text-[11px] text-[#5B6472] mt-1.5">
              Verified at {confirmation.timestamp || currentTime}
            </p>

            {/* 5-second countdown note */}
            <div className="mt-4 text-[11px] text-[#5B6472] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B] animate-pulse" />
              <span>Anti-proxy confirmation • Auto-dismisses in 5s</span>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURATION / SECRET SETUP MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C2430]/60 backdrop-blur-sm">
          <div className="max-w-md w-full bg-white border border-[#E4E1DA] rounded-xl p-6 shadow-xl text-left">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded bg-[#26415C]/10 text-[#26415C] flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-medium text-[#1C2430]">Configure Kiosk Secret</h3>
                  <p className="text-xs text-[#5B6472]">Terminal authentication credentials</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded hover:bg-[#FAF9F6] text-[#5B6472] hover:text-[#1C2430] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSecret} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">
                  Device ID or Code
                </label>
                <input
                  type="text"
                  value={deviceId}
                  disabled
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-[#5B6472] text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1C2430] mb-1">
                  32-Byte Secret Key (Hex or alphanumeric)
                </label>
                <input
                  type="password"
                  placeholder="Paste device secret generated during registration..."
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E4E1DA] focus:border-[#26415C] rounded text-[#1C2430] text-xs font-mono placeholder:text-[#5B6472]/60 focus:outline-none"
                  autoFocus
                />
                <p className="text-[11px] text-[#5B6472] mt-1">
                  Stored securely in browser localStorage. Never transmitted to third parties.
                </p>
              </div>

              {configError && (
                <div className="p-2.5 rounded bg-[#B3432B]/10 border border-[#B3432B]/20 text-[#B3432B] text-xs">
                  {configError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2 rounded border border-[#E4E1DA] bg-white text-[#1C2430] hover:bg-[#FAF9F6] font-medium text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium text-xs transition cursor-pointer"
                >
                  Save and activate
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
