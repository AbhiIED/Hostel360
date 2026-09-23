import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/client';
import jsQR from 'jsqr';
import {
  Camera,
  History,
  QrCode,
  ShieldCheck,
  Building,
  DoorOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRightLeft,
  LogIn,
  LogOut,
  Utensils,
  VideoOff,
  User,
  Sparkles,
  Clock,
} from 'lucide-react';

interface StudentProfile {
  id: string;
  roll_number: string;
  gender: string;
  department?: string;
  year?: number;
  photo_url?: string;
  current_state: 'INSIDE' | 'OUTSIDE';
  user: {
    id: string;
    name: string;
    email: string;
  };
  hostel?: {
    id: string;
    code: string;
    name: string;
    type: string;
    location: string;
  };
  room?: {
    id: string;
    room_number: string;
    floor: number;
    block?: string;
  };
}

interface HostelAttendanceLog {
  id: string;
  direction: 'ENTRY' | 'EXIT';
  scanned_at: string;
  gate: {
    id: string;
    name: string;
  };
  hostel: {
    id: string;
    name: string;
    code: string;
  };
}

interface MessAttendanceLog {
  id: string;
  meal_type: string;
  date: string;
  scanned_at: string;
  mess: {
    id: string;
    name: string;
  };
  meal_window: {
    id: string;
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
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Scanner State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
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
      setRefreshing(false);
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
    setCameraActive(false);
  }, []);

  // Submit token to backend
  const submitToken = async (rawToken: string) => {
    if (!rawToken || isScanning) return;
    setIsScanning(true);
    setScanResult(null);

    // Haptic vibration feedback
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(150);
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

      // Update student profile state locally
      if (data.student_state) {
        setProfile((prev) => (prev ? { ...prev, current_state: data.student_state } : prev));
      }

      // Refresh history records
      fetchStudentData();
      stopCamera();
    } catch (err: any) {
      console.error('Scan submission error:', err);
      const errMsg = err.response?.data?.error || 'Failed to process QR scan. Please try again.';
      setScanResult({
        success: false,
        message: errMsg,
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Start Camera for scanning
  const startCamera = async () => {
    setCameraError(null);
    setScanResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        requestAnimationFrame(tickScan);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Camera access denied or unavailable. You can use the manual token option below.');
      setCameraActive(false);
    }
  };

  // QR Scanning Animation Loop with jsQR
  const tickScan = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(tickScan);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data && code.data.trim().length > 0) {
      // Detected a QR code!
      submitToken(code.data.trim());
      return; // Stop animation loop
    }

    animationFrameRef.current = requestAnimationFrame(tickScan);
  };

  // Clean up camera on tab switch or unmount
  useEffect(() => {
    if (activeTab !== 'scan') {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      submitToken(manualToken.trim());
      setManualToken('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500 mb-3" />
        <p className="text-sm font-medium">Loading Student Profile...</p>
      </div>
    );
  }

  const isInside = profile?.current_state === 'INSIDE';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      {/* 1. STUDENT IDENTITY & PERSISTED STATE CARD */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* Student Photo */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-800 shadow-md">
                {profile?.photo_url ? (
                  <img
                    src={profile.photo_url}
                    alt={profile.user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <User className="w-8 h-8" />
                  </div>
                )}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                  isInside ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                title={isInside ? 'Inside Hostel' : 'Outside Hostel'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            {/* Student Info */}
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {profile?.user.name}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-bold border border-sky-500/20">
                  STUDENT
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>Roll: <strong className="text-slate-200 font-mono">{profile?.roll_number}</strong></span>
                <span>•</span>
                <span>Dept: <strong className="text-slate-200">{profile?.department || 'MANIT'}</strong></span>
                <span>•</span>
                <span>Year: <strong className="text-slate-200">{profile?.year || '1st'}</strong></span>
              </div>

              {/* Bound Hostel & Room */}
              <div className="flex items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-sky-400" />
                  <span>{profile?.hostel?.name || 'Assigned Hostel'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Room: <strong className="font-mono text-white">{profile?.room?.room_number || 'N/A'}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Current State Indicator Badge */}
          <div className="flex flex-col items-center sm:items-end">
            <div
              className={`px-4 py-2 rounded-2xl border flex items-center gap-2.5 shadow-lg ${
                isInside
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/10'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isInside ? 'bg-emerald-400' : 'bg-amber-400'} animate-ping`} />
              <div className="text-left sm:text-right">
                <div className="text-[10px] font-bold tracking-wider uppercase opacity-80">
                  Current Status
                </div>
                <div className="text-sm font-extrabold tracking-wide">
                  {isInside ? 'INSIDE HOSTEL' : 'OUTSIDE HOSTEL'}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 text-center sm:text-right">
              Next gate scan will trigger:{' '}
              <strong className={isInside ? 'text-amber-400' : 'text-emerald-400'}>
                {isInside ? 'EXIT' : 'ENTRY'}
              </strong>
            </p>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-6">
        <button
          onClick={() => setActiveTab('scan')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
            activeTab === 'scan'
              ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>QR Scanner</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
            activeTab === 'history'
              ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Entry/Exit Log ({hostelLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('mess')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
            activeTab === 'mess'
              ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Mess Attendance ({messLogs.length})</span>
        </button>

        <button
          onClick={() => {
            setRefreshing(true);
            fetchStudentData();
          }}
          disabled={refreshing}
          className="ml-auto p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 3. TAB 1: SCANNER VIEW */}
      {activeTab === 'scan' && (
        <div className="space-y-6">
          {/* Scan result banner */}
          {scanResult && (
            <div
              className={`p-6 rounded-3xl border shadow-xl flex items-start gap-4 animate-in fade-in duration-300 ${
                scanResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              <div
                className={`p-2.5 rounded-2xl border ${
                  scanResult.success
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                }`}
              >
                {scanResult.success ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">
                    {scanResult.success ? 'Attendance Recorded!' : 'Scan Failed'}
                  </h3>
                  {scanResult.timestamp && (
                    <span className="text-xs font-mono text-slate-400">{scanResult.timestamp}</span>
                  )}
                </div>

                <p className="text-sm mt-1 opacity-90">{scanResult.message}</p>

                {scanResult.success && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    {scanResult.direction && (
                      <span
                        className={`px-3 py-1 rounded-full border ${
                          scanResult.direction === 'ENTRY'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        {scanResult.direction === 'ENTRY' ? 'ENTRY' : 'EXIT'} CONFIRMED
                      </span>
                    )}
                    {scanResult.gate && (
                      <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                        {scanResult.gate}
                      </span>
                    )}
                    {scanResult.newState && (
                      <span className="px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300">
                        Status: {scanResult.newState}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Camera Viewfinder Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden shadow-2xl">
            {cameraActive ? (
              <div className="relative mx-auto max-w-sm rounded-2xl overflow-hidden border-2 border-sky-500/50 shadow-2xl bg-black">
                <video ref={videoRef} className="w-full h-80 object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* Animated Scanner Reticle / Viewfinder Frame */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6">
                  <div className="w-56 h-56 border-2 border-sky-400/80 rounded-2xl relative">
                    {/* Corner Reticles */}
                    <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-sky-400 -mt-1 -ml-1 rounded-tl-sm" />
                    <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-sky-400 -mt-1 -mr-1 rounded-tr-sm" />
                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-sky-400 -mb-1 -ml-1 rounded-bl-sm" />
                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-sky-400 -mb-1 -mr-1 rounded-br-sm" />

                    {/* Animated scanning laser line */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-lg shadow-sky-400 animate-pulse mt-24" />
                  </div>
                  <span className="text-xs text-sky-300 font-semibold mt-4 bg-slate-950/80 px-3 py-1 rounded-full border border-sky-500/30">
                    Align QR code within box
                  </span>
                </div>

                {/* Stop button overlay */}
                <div className="absolute bottom-3 right-3">
                  <button
                    onClick={stopCamera}
                    className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 shadow"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center">
                <div className="w-20 h-20 rounded-3xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/10">
                  <QrCode className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Scan Gate or Mess QR Code</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                  Point your device camera at the physical display screen at your hostel gate or mess counter.
                </p>

                {cameraError && (
                  <div className="mb-6 p-4 max-w-md rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-3 text-left">
                    <VideoOff className="w-5 h-5 flex-shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}

                <button
                  onClick={startCamera}
                  disabled={isScanning}
                  className="px-6 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition shadow-lg shadow-sky-600/30 flex items-center gap-2.5"
                >
                  <Camera className="w-5 h-5" />
                  <span>Launch Camera Scanner</span>
                </button>
              </div>
            )}

            {/* Manual Token Fallback */}
            <div className="mt-8 pt-6 border-t border-slate-800/80 text-left">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Test / Manual Token Input
                </label>
                <span className="text-[11px] text-slate-500">For testing without a camera</span>
              </div>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste 64-character token..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={isScanning || !manualToken.trim()}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-xs transition border border-slate-700 disabled:opacity-40"
                >
                  {isScanning ? 'Verifying...' : 'Submit Token'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: ENTRY/EXIT HISTORY (6.8) */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
              <span>Hostel Entry & Exit History</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Total Recorded: {hostelLogs.length}
            </span>
          </div>

          {hostelLogs.length === 0 ? (
            <div className="py-16 text-center bg-slate-900/60 border border-slate-800 rounded-3xl p-8">
              <ArrowRightLeft className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Scans Recorded Yet</h3>
              <p className="text-xs text-slate-400">
                Your entry and exit movements will appear here automatically when you scan at a gate kiosk.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
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
                  year: 'numeric',
                });

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                          isEntry
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}
                      >
                        {isEntry ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                              isEntry
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {log.direction}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {log.gate?.name || 'Gate Terminal'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {log.hostel?.name || 'Hostel Campus'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-200">{timeStr}</div>
                      <div className="text-[11px] text-slate-500">{dateStr}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: MESS ATTENDANCE HISTORY */}
      {activeTab === 'mess' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Utensils className="w-5 h-5 text-amber-400" />
              <span>Mess & Meal Consumption Log</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Total Meals: {messLogs.length}
            </span>
          </div>

          {messLogs.length === 0 ? (
            <div className="py-16 text-center bg-slate-900/60 border border-slate-800 rounded-3xl p-8">
              <Utensils className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Meal Records Yet</h3>
              <p className="text-xs text-slate-400">
                When you scan your QR at the mess counter during an active meal window, your meals will be logged here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messLogs.map((log) => {
                const dateObj = new Date(log.scanned_at);
                const timeStr = dateObj.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });
                const dateStr = dateObj.toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                        <Utensils className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300">
                            {log.meal_type}
                          </span>
                          <span className="text-sm font-bold text-white">{log.mess?.name}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>Window: {log.meal_window?.start_time} - {log.meal_window?.end_time}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-200">{timeStr}</div>
                      <div className="text-[11px] text-slate-500">{dateStr}</div>
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
