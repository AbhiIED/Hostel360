import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import api from '../api/client';
import {
  Camera,
  QrCode,
  History,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building,
  DoorOpen,
  User,
  Utensils,
  FlipHorizontal,
  VideoOff,
  ClipboardPaste,
} from 'lucide-react';

interface StudentProfile {
  id: string;
  roll_number: string;
  gender: string;
  department?: string;
  year?: number;
  current_state: 'INSIDE' | 'OUTSIDE';
  photo_url?: string;
  user: {
    name: string;
    email: string;
  };
  hostel?: {
    id: string;
    name: string;
    code: string;
  };
  room?: {
    id: string;
    room_number: string;
  };
}

interface HostelAttendanceLog {
  id: string;
  direction: 'ENTRY' | 'EXIT';
  scanned_at: string;
  gate?: {
    name: string;
  };
  hostel?: {
    name: string;
  };
}

interface MessAttendanceLog {
  id: string;
  meal_type: string;
  scanned_at: string;
  mess?: {
    name: string;
  };
  meal_window?: {
    meal_type: string;
    start_time: string;
    end_time: string;
  };
}

export const StudentAppPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scan' | 'history' | 'mess'>('scan');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [hostelLogs, setHostelLogs] = useState<HostelAttendanceLog[]>([]);
  const [messLogs, setMessLogs] = useState<MessAttendanceLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Scanner State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    direction?: string;
    mealType?: string;
    newState?: string;
    timestamp?: string;
    gate?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch student self data
  const fetchStudentData = useCallback(async () => {
    try {
      const res = await api.get('/attendance/self');
      setProfile(res.data.student);
      setHostelLogs(res.data.hostel_logs || []);
      setMessLogs(res.data.mess_logs || []);
    } catch (err: any) {
      console.error('Error fetching student data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  // Stop camera stream helper
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Submit scanned token to backend
  const submitToken = async (rawToken: string) => {
    if (!rawToken || isScanning) return;
    setIsScanning(true);

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {
        /* ignore */
      }
    }

    try {
      const res = await api.post('/attendance/scan', { token: rawToken.trim() });
      const data = res.data;

      setScanResult({
        success: true,
        message: data.message,
        direction: data.direction,
        mealType: data.meal_type,
        newState: data.student_state,
        gate: data.attendance?.gate,
        timestamp: new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
      });

      if (data.student_state) {
        setProfile((prev) => (prev ? { ...prev, current_state: data.student_state } : prev));
      }

      fetchStudentData();
      stopCamera();
    } catch (err: any) {
      console.error('Scan submission error:', err);
      const errMsg = err.response?.data?.error || 'Failed to process QR scan. Please verify alignment and try again.';
      setScanResult({
        success: false,
        message: errMsg,
      });
    } finally {
      setIsScanning(false);
    }
  };

  const startCamera = () => {
    setCameraError(null);
    setScanResult(null);
    setCameraActive(true);
  };

  const toggleFacingMode = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    setTimeout(() => {
      setCameraActive(true);
    }, 150);
  };

  useEffect(() => {
    if (!cameraActive) return;

    let isMounted = true;

    async function initCameraStream() {
      setCameraError(null);
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Camera hardware access is not available in this browser context. Please use the manual token input.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          animationFrameRef.current = requestAnimationFrame(tickScan);
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        setCameraError(err.message || 'Camera permission denied or camera is in use by another app.');
        setCameraActive(false);
      }
    }

    initCameraStream();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraActive, facingMode]);

  const tickScan = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(tickScan);
      return;
    }

    const video = videoRef.current;
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(tickScan);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      const scannedData = code.data.trim();
      let extractedToken = scannedData;

      try {
        if (scannedData.startsWith('{') && scannedData.endsWith('}')) {
          const parsed = JSON.parse(scannedData);
          if (parsed.token) extractedToken = parsed.token;
        } else if (scannedData.includes('token=')) {
          const urlObj = new URL(scannedData);
          const tParam = urlObj.searchParams.get('token');
          if (tParam) extractedToken = tParam;
        }
      } catch {
        // use raw string
      }

      submitToken(extractedToken);
      return;
    }

    animationFrameRef.current = requestAnimationFrame(tickScan);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    submitToken(manualToken.trim());
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setManualToken(text.trim());
        submitToken(text.trim());
      }
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-[#5B6472]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#26415C] mb-3" />
        <p className="text-xs font-medium">Connecting to resident registry...</p>
      </div>
    );
  }

  const isInside = profile?.current_state === 'INSIDE';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* 1. Student Identity and Campus Status Card */}
      <div className="bg-white border border-[#E4E1DA] rounded-lg p-5 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left w-full sm:w-auto">
            {/* Student Photo */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded border border-[#E4E1DA] bg-[#FAF9F6] overflow-hidden flex items-center justify-center">
                {profile?.photo_url ? (
                  <img
                    src={profile.photo_url}
                    alt={profile.user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-[#5B6472]" />
                )}
              </div>
            </div>

            {/* Student Details */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="font-serif text-xl sm:text-2xl font-medium text-[#1C2430] tracking-tight">
                  {profile?.user.name}
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#5B6472] text-[11px] font-medium">
                  Student resident
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 text-xs text-[#5B6472]">
                <span>Roll: <strong className="text-[#1C2430] font-mono tabular-nums">{profile?.roll_number}</strong></span>
                <span>•</span>
                <span>Dept: <strong className="text-[#1C2430]">{profile?.department || 'MANIT Bhopal'}</strong></span>
                <span>•</span>
                <span>Year: <strong className="text-[#1C2430] tabular-nums">{profile?.year ? `Year ${profile.year}` : 'Undergraduate'}</strong></span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-xs text-[#5B6472]">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E4E1DA]">
                  <Building className="w-3.5 h-3.5 text-[#26415C]" strokeWidth={1.5} />
                  <span>{profile?.hostel?.name || 'Assigned hostel'}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E4E1DA]">
                  <DoorOpen className="w-3.5 h-3.5 text-[#26415C]" strokeWidth={1.5} />
                  <span>Room: <strong className="font-mono text-[#1C2430] tabular-nums">{profile?.room?.room_number || 'N/A'}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Status Pill */}
          <div className="w-full sm:w-auto flex flex-col items-center sm:items-end pt-2 sm:pt-0">
            <div className="px-3.5 py-1.5 rounded border border-[#E4E1DA] bg-[#FAF9F6] flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isInside ? '#2E7D5B' : '#B7791F' }}
              />
              <span className="text-xs font-medium text-[#1C2430]">
                {isInside ? 'Inside hostel' : 'Outside hostel'}
              </span>
            </div>
            <p className="text-[11px] text-[#5B6472] mt-1.5 text-center sm:text-right">
              Next scan records {isInside ? 'exit' : 'entry'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Lean Segmented Tab Navigation */}
      <div className="flex items-center gap-3 border-b border-[#E4E1DA] pb-2 mb-6 text-xs">
        <button
          onClick={() => setActiveTab('scan')}
          className={`flex items-center gap-1.5 pb-2 -mb-2.5 transition ${
            activeTab === 'scan'
              ? 'text-[#1C2430] font-medium border-b-2 border-[#26415C]'
              : 'text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Camera scanner</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 pb-2 -mb-2.5 transition ${
            activeTab === 'history'
              ? 'text-[#1C2430] font-medium border-b-2 border-[#26415C]'
              : 'text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Gate log ({hostelLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('mess')}
          className={`flex items-center gap-1.5 pb-2 -mb-2.5 transition ${
            activeTab === 'mess'
              ? 'text-[#1C2430] font-medium border-b-2 border-[#26415C]'
              : 'text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Dining log ({messLogs.length})</span>
        </button>
      </div>

      {/* 3. Tab 1: Scanner View */}
      {activeTab === 'scan' && (
        <div className="space-y-6">
          {scanResult && (
            <div
              className={`p-4 rounded-lg border text-xs flex items-start gap-3 ${
                scanResult.success
                  ? 'bg-[#2E7D5B]/5 border-[#2E7D5B]/20 text-[#2E7D5B]'
                  : 'bg-[#B3432B]/5 border-[#B3432B]/20 text-[#B3432B]'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {scanResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D5B]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#B3432B]" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between font-medium text-[#1C2430]">
                  <span>{scanResult.success ? 'Attendance recorded' : 'Scan rejected'}</span>
                  {scanResult.timestamp && (
                    <span className="text-[11px] text-[#5B6472] font-mono tabular-nums">
                      {scanResult.timestamp}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[#5B6472]">{scanResult.message}</p>
                {scanResult.success && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {scanResult.direction && (
                      <span className="px-2 py-0.5 rounded bg-white border border-[#E4E1DA] font-medium text-[#1C2430]">
                        {scanResult.direction === 'ENTRY' ? 'Entry' : 'Exit'} recorded
                      </span>
                    )}
                    {scanResult.gate && (
                      <span className="px-2 py-0.5 rounded bg-white border border-[#E4E1DA] text-[#5B6472]">
                        {scanResult.gate}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Camera Viewfinder Card */}
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 sm:p-8 text-center">
            {cameraActive ? (
              <div className="relative mx-auto max-w-sm rounded border border-[#E4E1DA] overflow-hidden bg-black">
                <video ref={videoRef} className="w-full h-72 object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6">
                  <div className="w-48 h-48 border-2 border-white/80 rounded relative" />
                  <span className="text-[11px] text-white mt-3 bg-black/60 px-3 py-1 rounded">
                    Align gate display QR inside frame
                  </span>
                </div>

                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={toggleFacingMode}
                    className="p-1.5 bg-black/70 hover:bg-black/90 text-white rounded text-xs flex items-center gap-1"
                    title="Flip camera"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-2.5 py-1 bg-black/70 hover:bg-black/90 text-white rounded text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center">
                <QrCode className="w-10 h-10 text-[#26415C] mb-3" strokeWidth={1.5} />
                <h2 className="font-serif text-lg font-medium text-[#1C2430] mb-1">
                  Scan gate or mess QR code
                </h2>
                <p className="text-xs text-[#5B6472] max-w-md mx-auto mb-6 leading-relaxed">
                  Hold your phone camera up to the physical monitor display at your assigned hostel gate or mess counter.
                </p>

                {cameraError && (
                  <div className="mb-4 p-3 max-w-md rounded bg-[#B3432B]/5 border border-[#B3432B]/20 text-[#B3432B] text-xs flex items-center gap-2 text-left">
                    <VideoOff className="w-4 h-4 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}

                <button
                  onClick={startCamera}
                  disabled={isScanning}
                  className="px-6 py-2.5 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium text-xs transition flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Launch camera scanner</span>
                </button>
              </div>
            )}

            {/* Manual Token Input */}
            <div className="mt-8 pt-6 border-t border-[#E4E1DA] text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                <label className="text-xs font-medium text-[#1C2430]">
                  Manual token entry
                </label>
                <span className="text-[11px] text-[#5B6472]">For testing without a secondary camera</span>
              </div>
              <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Paste 64-character token..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] font-mono placeholder-[#5B6472]/60 focus:outline-none focus:border-[#26415C]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-3 py-2 rounded bg-[#FAF9F6] hover:bg-[#E4E1DA]/40 text-[#1C2430] text-xs border border-[#E4E1DA] flex items-center justify-center gap-1.5 transition"
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-[#5B6472]" />
                    <span>Paste</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isScanning || !manualToken.trim()}
                    className="px-4 py-2 rounded bg-[#26415C] hover:bg-[#1e344a] text-white font-medium text-xs transition disabled:opacity-40"
                  >
                    {isScanning ? 'Verifying...' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 4. Tab 2: Gate Entry/Exit History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E4E1DA]">
            <h2 className="font-serif text-base font-medium text-[#1C2430]">
              Gate entrance records
            </h2>
            <span className="text-xs text-[#5B6472] font-mono tabular-nums">
              {hostelLogs.length} total
            </span>
          </div>

          {hostelLogs.length === 0 ? (
            <div className="py-12 text-center bg-white border border-[#E4E1DA] rounded-lg p-6">
              <p className="text-xs text-[#5B6472]">
                No gate movements recorded yet.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E4E1DA] rounded-lg divide-y divide-[#E4E1DA]">
              {hostelLogs.map((log) => {
                const isEntry = log.direction === 'ENTRY';
                const dateObj = new Date(log.scanned_at);
                const timeStr = dateObj.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                });
                const dateStr = dateObj.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={log.id}
                    className="p-3 sm:p-4 hover:bg-[#FAF9F6] transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: isEntry ? '#2E7D5B' : '#B7791F' }}
                      />
                      <div>
                        <div className="font-medium text-[#1C2430]">
                          {isEntry ? 'Inside' : 'Outside'} • {log.gate?.name || 'Gate terminal'}
                        </div>
                        <div className="text-[11px] text-[#5B6472] mt-0.5">
                          {log.hostel?.name || 'Campus hostel'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-[#1C2430] tabular-nums">{timeStr}</div>
                      <div className="text-[11px] text-[#5B6472]">{dateStr}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 3: Dining Attendance History */}
      {activeTab === 'mess' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E4E1DA]">
            <h2 className="font-serif text-base font-medium text-[#1C2430]">
              Dining hall records
            </h2>
            <span className="text-xs text-[#5B6472] font-mono tabular-nums">
              {messLogs.length} total
            </span>
          </div>

          {messLogs.length === 0 ? (
            <div className="py-12 text-center bg-white border border-[#E4E1DA] rounded-lg p-6">
              <p className="text-xs text-[#5B6472]">
                No meal scans recorded yet.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E4E1DA] rounded-lg divide-y divide-[#E4E1DA]">
              {messLogs.map((log) => {
                const dateObj = new Date(log.scanned_at);
                const timeStr = dateObj.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                });
                const dateStr = dateObj.toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={log.id}
                    className="p-3 sm:p-4 hover:bg-[#FAF9F6] transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Utensils className="w-4 h-4 text-[#5B6472]" strokeWidth={1.5} />
                      <div>
                        <div className="font-medium text-[#1C2430]">
                          {log.meal_type} • {log.mess?.name || 'Campus mess'}
                        </div>
                        <div className="text-[11px] text-[#5B6472] mt-0.5">
                          Window: {log.meal_window?.start_time} - {log.meal_window?.end_time}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-[#1C2430] tabular-nums">{timeStr}</div>
                      <div className="text-[11px] text-[#5B6472]">{dateStr}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentAppPage;
