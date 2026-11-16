import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import api from '../api/client';
import { useConfirm } from '../context/ConfirmContext';
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
  FileText,
  Wifi,
  Send,
  X,
  AlertCircle,
  Edit2,
  ShieldAlert,
  ShieldCheck,
  ArrowLeftRight,
  Shuffle,
  ArrowRight,
  Sparkles,
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
  const { confirm, alert: customAlert } = useConfirm();
  const [activeTab, setActiveTab] = useState<'scan' | 'history' | 'mess' | 'leave' | 'allocation'>('scan');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [hostelLogs, setHostelLogs] = useState<HostelAttendanceLog[]>([]);
  const [messLogs, setMessLogs] = useState<MessAttendanceLog[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [wifiHint, setWifiHint] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Leave Form State
  const [leaveForm, setLeaveForm] = useState({
    requested_from: '',
    requested_to: '',
    reason: '',
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveSuccess, setLeaveSuccess] = useState<string | null>(null);
  const [editingLeave, setEditingLeave] = useState<any | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Allocation & Swaps State (Phase 14)
  const [openWindows, setOpenWindows] = useState<any[]>([]);
  const [hostelList, setHostelList] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [mySwaps, setMySwaps] = useState<any[]>([]);
  const [allocLoading, setAllocLoading] = useState<boolean>(false);
  const [allocSubmitting, setAllocSubmitting] = useState<boolean>(false);
  const [allocError, setAllocError] = useState<string | null>(null);
  const [allocSuccess, setAllocSuccess] = useState<string | null>(null);

  const [appForm, setAppForm] = useState({
    window_id: '',
    hostel_id: '',
    year_of_study: 1,
    accessibility_needs: false,
    accessibility_notes: '',
    documents_url: '',
  });

  const [swapTargetRoll, setSwapTargetRoll] = useState('');
  const [swapNote, setSwapNote] = useState('');
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);

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
  const isSubmittingRef = useRef<boolean>(false);
  const lastRejectedTokenRef = useRef<string | null>(null);
  const lastScanAttemptTimeRef = useRef<number>(0);

  const fetchLeaveData = useCallback(async () => {
    try {
      const res = await api.get('/curfew/leave-requests/self');
      setLeaveRequests(res.data.requests || []);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
    }
  }, []);

  const fetchWifiHint = useCallback(async (studentId: string) => {
    try {
      const res = await api.get(`/curfew/presence-hint/${studentId}`);
      if (res.data.inside && res.data.hint) {
        setWifiHint(res.data.hint);
      } else {
        setWifiHint(null);
      }
    } catch (err) {
      setWifiHint(null);
    }
  }, []);

  // Fetch student self data
  const fetchStudentData = useCallback(async () => {
    try {
      const res = await api.get('/attendance/self');
      setProfile(res.data.student);
      setHostelLogs(res.data.hostel_logs || []);
      setMessLogs(res.data.mess_logs || []);
      if (res.data.student?.id) {
        fetchWifiHint(res.data.student.id);
      }
      fetchLeaveData();
    } catch (err: any) {
      console.error('Error fetching student data:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchLeaveData, fetchWifiHint]);

  useEffect(() => {
    fetchStudentData();
    fetchAllocationData();
  }, [fetchStudentData]);

  const fetchAllocationData = useCallback(async () => {
    try {
      setAllocLoading(true);
      const [winRes, hostRes, myAppRes] = await Promise.all([
        api.get('/allocations/windows?status=OPEN'),
        api.get('/hostels'),
        api.get('/allocations/applications/my'),
      ]);
      const wins = winRes.data.windows || [];
      setOpenWindows(wins);
      setHostelList(hostRes.data.hostels || []);
      setMyApplications(myAppRes.data.applications || []);
      setMySwaps(myAppRes.data.swap_requests || []);
      if (wins.length > 0) {
        setAppForm((prev) => ({
          ...prev,
          window_id: prev.window_id || wins[0].id,
          hostel_id: prev.hostel_id || wins[0].hostel_id || '',
        }));
      }
    } catch (err: any) {
      console.error('Error fetching allocation data:', err);
    } finally {
      setAllocLoading(false);
    }
  }, []);

  const handleApplyHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAllocSubmitting(true);
      setAllocError(null);
      setAllocSuccess(null);

      const res = await api.post('/allocations/applications', {
        window_id: appForm.window_id,
        hostel_id: appForm.hostel_id,
        year_of_study: parseInt(appForm.year_of_study.toString(), 10),
        accessibility_needs: appForm.accessibility_needs,
        accessibility_notes: appForm.accessibility_needs ? appForm.accessibility_notes : undefined,
        documents_url: appForm.documents_url || undefined,
      });

      setAllocSuccess(res.data.message || 'Application submitted successfully.');
      fetchAllocationData();
    } catch (err: any) {
      setAllocError(err.response?.data?.error || 'Failed to submit application.');
    } finally {
      setAllocSubmitting(false);
    }
  };

  const handleRequestSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapTargetRoll.trim()) {
      setSwapError('Please enter peer student roll number.');
      return;
    }
    try {
      setSwapSubmitting(true);
      setSwapError(null);
      setSwapSuccess(null);

      const res = await api.post('/allocations/swaps', {
        target_roll_number: swapTargetRoll.trim(),
        note: swapNote || undefined,
      });

      setSwapSuccess(res.data.message || 'Room swap request sent to peer.');
      setSwapTargetRoll('');
      setSwapNote('');
      fetchAllocationData();
    } catch (err: any) {
      setSwapError(err.response?.data?.error || 'Failed to submit room swap request.');
    } finally {
      setSwapSubmitting(false);
    }
  };

  const handleAcceptPeerSwap = async (swapId: string) => {
    try {
      setSwapSubmitting(true);
      setSwapError(null);
      setSwapSuccess(null);

      const res = await api.patch(`/allocations/swaps/${swapId}/peer-accept`);
      setSwapSuccess(res.data.message || 'Swap request accepted!');
      fetchAllocationData();
    } catch (err: any) {
      setSwapError(err.response?.data?.error || 'Failed to accept swap request.');
    } finally {
      setSwapSubmitting(false);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.requested_from || !leaveForm.requested_to || !leaveForm.reason.trim()) {
      setLeaveError('Please specify departure date/time, return date/time, and reason');
      return;
    }

    const from = new Date(leaveForm.requested_from);
    const to = new Date(leaveForm.requested_to);

    if (from >= to) {
      setLeaveError('Return date must be chronologically after departure date');
      return;
    }

    setLeaveSubmitting(true);
    setLeaveError(null);
    setLeaveSuccess(null);

    try {
      await api.post('/curfew/leave-requests', {
        requested_from: from.toISOString(),
        requested_to: to.toISOString(),
        reason: leaveForm.reason.trim(),
      });
      setLeaveSuccess('Out-pass request submitted successfully (Pending Warden review)');
      setLeaveForm({ requested_from: '', requested_to: '', reason: '' });
      fetchLeaveData();
    } catch (err: any) {
      setLeaveError(err.response?.data?.error || 'Failed to submit leave request');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleEditLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLeave) return;

    const from = new Date(editingLeave.requested_from);
    const to = new Date(editingLeave.requested_to);

    if (from >= to) {
      setEditError('Return date must be chronologically after departure date');
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    try {
      await api.patch(`/curfew/leave-requests/${editingLeave.id}`, {
        requested_from: from.toISOString(),
        requested_to: to.toISOString(),
        reason: editingLeave.reason.trim(),
      });
      setLeaveSuccess('Out-pass request updated successfully (Risk tier re-evaluated)');
      setEditingLeave(null);
      fetchLeaveData();
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update leave request');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCancelLeave = async (id: string) => {
    const ok = await confirm({
      title: 'Cancel Out-Pass Request?',
      message: 'Are you sure you want to cancel this out-pass request?',
      confirmText: 'Yes, Cancel Request',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await api.patch(`/curfew/leave-requests/${id}/cancel`);
      fetchLeaveData();
    } catch (err: any) {
      await customAlert({
        title: 'Action Failed',
        message: err.response?.data?.error || 'Failed to cancel leave request',
        variant: 'danger',
      });
    }
  };

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
    if (!rawToken || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
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

      // SUCCESS: Clear any previously rejected token tracker
      lastRejectedTokenRef.current = null;

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
      // Remember this rejected token so camera ignores it until a NEW rotated QR appears
      lastRejectedTokenRef.current = rawToken.trim();

      const errMsg = err.response?.data?.error || 'Failed to process QR scan. Please verify alignment and try again.';
      setScanResult({
        success: false,
        message: `${errMsg} (Scanner remains active — waiting for next QR rotation...)`,
      });

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(200);
        } catch {
          /* ignore */
        }
      }
    } finally {
      isSubmittingRef.current = false;
      setIsScanning(false);
    }
  };

  const startCamera = () => {
    setCameraError(null);
    setScanResult(null);
    lastRejectedTokenRef.current = null;
    lastScanAttemptTimeRef.current = 0;
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

  const handleDetectedData = (scannedData: string) => {
    let extractedToken = scannedData.trim();
    try {
      if (extractedToken.startsWith('{') && extractedToken.endsWith('}')) {
        const parsed = JSON.parse(extractedToken);
        if (parsed.token) extractedToken = parsed.token;
      } else if (extractedToken.includes('token=')) {
        const urlObj = new URL(extractedToken);
        const tParam = urlObj.searchParams.get('token');
        if (tParam) extractedToken = tParam;
      }
    } catch {
      // use raw string
    }

    if (!extractedToken) return;

    // 1. If this exact token was already rejected, ignore it and wait for screen to rotate
    if (lastRejectedTokenRef.current && lastRejectedTokenRef.current === extractedToken) {
      return;
    }

    // 2. Cooldown check: avoid rapid duplicate requests
    const now = Date.now();
    if (now - lastScanAttemptTimeRef.current < 1200) {
      return;
    }

    if (isSubmittingRef.current) {
      return;
    }

    lastScanAttemptTimeRef.current = now;
    submitToken(extractedToken);
  };

  const tickScan = async () => {
    if (!videoRef.current || !streamRef.current?.active) {
      return;
    }

    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      let detectedData: string | null = null;

      // 1. Hardware-Accelerated Native BarcodeDetector (instant <10ms on mobile Chrome/Safari)
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await barcodeDetector.detect(video);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            detectedData = barcodes[0].rawValue;
          }
        } catch {
          // Fallback to optimized jsQR
        }
      }

      // 2. High-performance downscaled jsQR fallback (max width 640px)
      if (!detectedData) {
        let canvas = canvasRef.current;
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvasRef.current = canvas;
        }

        // Downscale for instant CPU processing (up to 15x faster than 1080p/4K)
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.round(video.videoWidth * scale);
        const height = Math.round(video.videoHeight * scale);

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code && code.data) {
            detectedData = code.data;
          }
        }
      }

      if (detectedData) {
        handleDetectedData(detectedData);
      }
    }

    // Keep camera loop running continuously so it automatically scans the next QR code
    if (cameraActive && streamRef.current?.active) {
      animationFrameRef.current = requestAnimationFrame(tickScan);
    }
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
            {isInside && wifiHint && (
              <div
                className="mt-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800"
                title="Advisory presence signal from campus WiFi controller. Advisory only; never used for attendance or alerts."
              >
                <Wifi className="w-3 h-3 text-[#2E7D5B]" />
                <span>{wifiHint}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Lean Segmented Tab Navigation */}
      <div className="flex items-center gap-3 border-b border-[#E4E1DA] pb-2 mb-6 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('scan')}
          className={`flex items-center gap-1.5 pb-2 -mb-2.5 transition whitespace-nowrap ${
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
          className={`flex items-center gap-1.5 pb-2 -mb-2.5 transition whitespace-nowrap ${
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
          className={`flex items-center gap-1.5 pb-2 -mb-2.5 transition whitespace-nowrap ${
            activeTab === 'mess'
              ? 'text-[#1C2430] font-medium border-b-2 border-[#26415C]'
              : 'text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Dining log ({messLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('leave')}
          className={`flex items-center gap-1.5 pb-2 -mb-2.5 transition whitespace-nowrap ${
            activeTab === 'leave'
              ? 'text-[#1C2430] font-medium border-b-2 border-[#26415C]'
              : 'text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Out-pass / Leave ({leaveRequests.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('allocation');
            fetchAllocationData();
          }}
          className={`flex items-center gap-1.5 pb-2 -mb-2.5 transition whitespace-nowrap ${
            activeTab === 'allocation'
              ? 'text-[#1C2430] font-medium border-b-2 border-[#26415C]'
              : 'text-[#5B6472] hover:text-[#1C2430]'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Room Allocation & Swaps</span>
          {openWindows.length > 0 && myApplications.length === 0 && (
            <span className="w-2 h-2 rounded-full bg-[#E5484D] inline-block animate-pulse" title="Registration Window Open" />
          )}
        </button>
      </div>

      {/* 3. Tab 1: Scanner View */}
      {activeTab === 'scan' && (
        <div className="space-y-6">
          {/* Active Room Registration Window Announcement Banner */}
          {openWindows.length > 0 && myApplications.length === 0 && (
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-[#26415C]/20 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-full bg-[#26415C]/10 text-[#26415C] shrink-0 mt-0.5 sm:mt-0">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-[#1C2430] flex items-center gap-1.5">
                    <span>Hostel Room Registration Window is Open!</span>
                    <span className="px-1.5 py-0.2 bg-[#2E7D5B]/10 text-[#2E7D5B] text-[10px] font-semibold rounded">
                      {openWindows[0].academic_year}
                    </span>
                  </div>
                  <p className="text-[#5B6472] mt-0.5">
                    Submit your room lottery application before {new Date(openWindows[0].open_to).toLocaleDateString()} to participate in room allocations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('allocation');
                  fetchAllocationData();
                }}
                className="px-3.5 py-1.5 bg-[#26415C] hover:bg-[#1e344a] text-white rounded font-medium text-xs whitespace-nowrap transition shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <span>Apply for Room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Active Lottery Enrollment Status Banner */}
          {myApplications.length > 0 && !profile?.room?.room_number && (
            <div className="p-3.5 rounded-lg bg-[#E0F2FE]/40 border border-[#BAE6FD] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-[#0369A1]">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Room Allocation Status:</strong> Application submitted for {myApplications[0]?.hostel?.name || 'hostel'} (Awaiting Caretaker lottery draw).
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('allocation');
                  fetchAllocationData();
                }}
                className="text-xs font-semibold text-[#0369A1] hover:underline whitespace-nowrap shrink-0"
              >
                View Status ➔
              </button>
            </div>
          )}
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

      {/* 6. Tab 4: Out-Pass & Leave Requests */}
      {activeTab === 'leave' && (
        <div className="space-y-6">
          {/* Request Form Card */}
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
            <div className="flex items-center gap-3 pb-3 mb-4 border-b border-[#E4E1DA]">
              <div className="w-8 h-8 rounded bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#1D4ED8]">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-serif text-base font-medium text-[#1C2430]">
                  Submit Out-Pass / Leave Request
                </h2>
                <p className="text-xs text-[#5B6472] mt-0.5">
                  Authorized out-passes automatically suppress curfew alerts during your night out.
                </p>
              </div>
            </div>

            {leaveSuccess && (
              <div className="mb-4 p-3 bg-[#DEF7EC] border border-[#84E1BC] text-[#03543F] rounded text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{leaveSuccess}</span>
                </div>
                <button onClick={() => setLeaveSuccess(null)} className="text-[#03543F]">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {leaveError && (
              <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{leaveError}</span>
                </div>
                <button onClick={() => setLeaveError(null)} className="text-[#DC2626]">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleLeaveSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-[#1C2430] mb-1">
                    Departure Date & Time <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={leaveForm.requested_from}
                    onChange={(e) => setLeaveForm({ ...leaveForm, requested_from: e.target.value })}
                    className="w-full p-2.5 border border-[#E4E1DA] rounded font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#1C2430] mb-1">
                    Expected Return Date & Time <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={leaveForm.requested_to}
                    onChange={(e) => setLeaveForm({ ...leaveForm, requested_to: e.target.value })}
                    className="w-full p-2.5 border border-[#E4E1DA] rounded font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#1C2430] mb-1">
                  Purpose / Reason for Leave <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Traveling home for weekend festival, hackathon participation in Bhopal, or family emergency"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full p-2.5 border border-[#E4E1DA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={leaveSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#26415C] text-white rounded font-medium hover:bg-[#1B2E42] transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{leaveSubmitting ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* History Card */}
          <div className="bg-white border border-[#E4E1DA] rounded-lg p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E4E1DA]">
              <h2 className="font-serif text-base font-medium text-[#1C2430]">
                Your Out-Pass History
              </h2>
              <span className="text-xs text-[#5B6472] font-mono tabular-nums">
                {leaveRequests.length} requests
              </span>
            </div>

            {leaveRequests.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#5B6472]">
                You have not submitted any out-pass requests yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E1DA] text-[#5B6472]">
                      <th className="py-2.5 font-medium">Period & Risk Tier</th>
                      <th className="py-2.5 font-medium">Reason</th>
                      <th className="py-2.5 font-medium">Status & Decider</th>
                      <th className="py-2.5 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E1DA]">
                    {leaveRequests.map((req) => {
                      const fromDate = new Date(req.requested_from);
                      const toDate = new Date(req.requested_to);
                      const now = new Date();
                      const canCancel = (req.status === 'PENDING' || req.status === 'APPROVED') && now < fromDate;
                      const isPending = req.status === 'PENDING';
                      const isHigh = req.risk_tier === 'HIGH';

                      return (
                        <tr key={req.id} className="hover:bg-[#FAF9F6] transition">
                          <td className="py-3 font-mono text-[#1C2430] tabular-nums whitespace-nowrap">
                            <div className="mb-1">
                              {isHigh ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                                  <ShieldAlert className="w-3 h-3 text-[#B7791F]" />
                                  HIGH RISK (Warden)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                                  <ShieldCheck className="w-3 h-3 text-[#1D4ED8]" />
                                  LOW RISK (Caretaker)
                                </span>
                              )}
                            </div>
                            <div>
                              {fromDate.toLocaleString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <div className="text-[11px] text-[#5B6472]">
                              to{' '}
                              {toDate.toLocaleString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          <td className="py-3 max-w-xs">
                            <p className="line-clamp-2 text-[#1C2430]" title={req.reason}>
                              {req.reason}
                            </p>
                            {req.caretaker_note && (
                              <div className="mt-1 text-[11px] text-[#26415C] bg-[#F1F5F9] p-1 rounded border border-[#E2E8F0]">
                                <span className="font-medium">Caretaker note:</span> {req.caretaker_note}
                              </div>
                            )}
                          </td>

                          <td className="py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${
                                req.status === 'PENDING'
                                  ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]'
                                  : req.status === 'APPROVED'
                                  ? 'bg-[#DEF7EC] text-[#03543F] border border-[#84E1BC]'
                                  : req.status === 'REJECTED'
                                  ? 'bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]'
                                  : 'bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]'
                              }`}
                            >
                              {req.status}
                            </span>
                            {req.decider && (
                              <div className="text-[10px] text-[#5B6472] mt-0.5">
                                Decided by {req.decider.name}
                              </div>
                            )}
                            {req.caretaker_verifier && (
                              <div className="text-[10px] text-[#2E7D5B] mt-0.5">
                                Verified by {req.caretaker_verifier.name}
                              </div>
                            )}
                          </td>

                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending && (
                                <button
                                  onClick={() => {
                                    const formatForInput = (d: string) => {
                                      const date = new Date(d);
                                      const pad = (n: number) => String(n).padStart(2, '0');
                                      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                                    };
                                    setEditingLeave({
                                      id: req.id,
                                      requested_from: formatForInput(req.requested_from),
                                      requested_to: formatForInput(req.requested_to),
                                      reason: req.reason,
                                    });
                                    setEditError(null);
                                  }}
                                  className="px-2 py-1 text-xs text-[#26415C] hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded transition font-medium inline-flex items-center gap-1"
                                  title="Edit dates or reason (will re-evaluate risk tier)"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              )}
                              {canCancel && (
                                <button
                                  onClick={() => handleCancelLeave(req.id)}
                                  className="px-2 py-1 text-xs text-[#DC2626] hover:bg-[#FEF2F2] border border-[#FCA5A5] rounded transition font-medium"
                                >
                                  Cancel
                                </button>
                              )}
                              {!isPending && !canCancel && (
                                <span className="text-[11px] text-[#5B6472]">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Edit Leave Request Modal */}
          {editingLeave && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-lg border border-[#E4E1DA] shadow-xl max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E4E1DA]">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-[#26415C]" />
                    <h3 className="font-serif text-base font-medium text-[#1C2430]">
                      Edit Out-Pass Request
                    </h3>
                  </div>
                  <button
                    onClick={() => setEditingLeave(null)}
                    className="text-[#5B6472] hover:text-[#1C2430] p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {editError && (
                  <div className="p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                <form onSubmit={handleEditLeaveSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-[#1C2430] mb-1">
                        Departure Date & Time <span className="text-[#DC2626]">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={editingLeave.requested_from}
                        onChange={(e) =>
                          setEditingLeave({ ...editingLeave, requested_from: e.target.value })
                        }
                        className="w-full p-2.5 border border-[#E4E1DA] rounded font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#1C2430] mb-1">
                        Expected Return Date & Time <span className="text-[#DC2626]">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={editingLeave.requested_to}
                        onChange={(e) =>
                          setEditingLeave({ ...editingLeave, requested_to: e.target.value })
                        }
                        className="w-full p-2.5 border border-[#E4E1DA] rounded font-mono text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[#1C2430] mb-1">
                      Purpose / Reason for Leave <span className="text-[#DC2626]">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={editingLeave.reason}
                      onChange={(e) =>
                        setEditingLeave({ ...editingLeave, reason: e.target.value })
                      }
                      className="w-full p-2.5 border border-[#E4E1DA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                    />
                  </div>

                  <div className="p-2.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-[11px] text-[#5B6472]">
                    Note: Updating dates will automatically recalculate the risk tier. If the duration exceeds 8 hours or overlaps curfew hours, the request will automatically escalate to HIGH tier (requiring Warden approval).
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E1DA]">
                    <button
                      type="button"
                      onClick={() => setEditingLeave(null)}
                      className="px-3 py-1.5 text-xs text-[#5B6472] hover:text-[#1C2430] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editSubmitting}
                      className="px-4 py-1.5 text-xs font-medium bg-[#26415C] text-white rounded hover:bg-[#1B2E42] transition disabled:opacity-50"
                    >
                      {editSubmitting ? 'Saving...' : 'Update & Re-evaluate'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 5: Batch Room Allocation & Mutual Room Swaps (Phase 14) */}
      {activeTab === 'allocation' && (
        <div className="space-y-6">
          {/* Informational Architecture Banner */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 text-xs text-[#334155] space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[#1E293B]">
              <Shuffle className="w-4 h-4 text-[#26415C]" />
              <span>Continuous Batch Room Allocation Model</span>
            </div>
            <p>
              Students apply to a <strong>Hostel</strong> rather than racing to claim individual rooms. A deterministic,
              seeded batch job allocates rooms after the registration window closes based on floor-year mapping policy
              and accessibility requirements.
            </p>
          </div>

          {allocLoading && (
            <div className="flex items-center gap-2 text-xs text-[#5B6472] p-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#26415C]" />
              <span>Loading allocation status and open windows...</span>
            </div>
          )}

          {/* Alert Messages */}
          {allocError && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-xs text-[#991B1B] flex items-center justify-between">
              <span>{allocError}</span>
              <button onClick={() => setAllocError(null)} className="font-semibold underline text-[11px]">
                Dismiss
              </button>
            </div>
          )}

          {allocSuccess && (
            <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded text-xs text-[#166534] flex items-center justify-between">
              <span>{allocSuccess}</span>
              <button onClick={() => setAllocSuccess(null)} className="font-semibold underline text-[11px]">
                Dismiss
              </button>
            </div>
          )}

          {/* Section 1: Active Applications Status */}
          {myApplications.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#1C2430]">Your Hostel Applications</h3>
              {myApplications.map((appItem) => {
                const alloc = appItem.room_allocation;
                const isRedirected = Boolean(appItem.redirect_from_hostel_id);

                return (
                  <div
                    key={appItem.id}
                    className="bg-white border border-[#E4E1DA] rounded-lg p-5 shadow-sm space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E4E1DA]">
                      <div>
                        <span className="text-[11px] text-[#5B6472] block">
                          Academic Session: {appItem.window?.academic_year || 'Current'}
                        </span>
                        <span className="font-semibold text-sm text-[#1C2430]">
                          Applied Hostel: {appItem.hostel?.name} ({appItem.hostel?.code})
                        </span>
                      </div>

                      <div>
                        <span
                          className={`inline-block px-2.5 py-1 rounded text-xs font-semibold ${
                            appItem.status === 'ALLOCATED'
                              ? 'bg-[#2E7D5B] text-white'
                              : appItem.status === 'FLAGGED'
                              ? 'bg-[#FEF08A] text-[#854D0E]'
                              : appItem.status === 'ESCALATED'
                              ? 'bg-[#F3E8FF] text-[#6B21A8]'
                              : 'bg-[#E0F2FE] text-[#0369A1]'
                          }`}
                        >
                          Status: {appItem.status}
                        </span>
                      </div>
                    </div>

                    {/* Redirect Alert Banner */}
                    {isRedirected && (
                      <div className="p-3 bg-[#FFF7ED] border border-[#FED7AA] rounded text-[#C2410C]">
                        <span className="font-semibold block mb-0.5">Campus Redirect Notice:</span>
                        <span>{appItem.redirect_reason}</span>
                      </div>
                    )}

                    {/* Zero-Vacancy Escalated Banner */}
                    {appItem.status === 'ESCALATED' && (
                      <div className="p-3 bg-[#FAF5FF] border border-[#E9D5FF] rounded text-[#6B21A8]">
                        <span className="font-semibold block mb-0.5">Super Admin Queue:</span>
                        <span>{appItem.flag_reason || 'Zero vacancy campus-wide. Awaiting manual placement.'}</span>
                      </div>
                    )}

                    {/* Room Allocation Info */}
                    {alloc ? (
                      <div className="bg-[#FBFBFA] p-3 rounded border border-[#E4E1DA] grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="text-[11px] text-[#5B6472] block">Assigned Room</span>
                          <span className="font-semibold text-sm text-[#1C2430]">
                            Room {alloc.room?.room_number || 'N/A'} (Floor {alloc.assigned_floor})
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-[#5B6472] block">Hostel Placement</span>
                          <span className="font-semibold text-sm text-[#1C2430]">{alloc.hostel?.name}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-[#5B6472] block">Allocation Verification</span>
                          <span
                            className={`font-semibold text-xs ${
                              alloc.status === 'CONFIRMED' ? 'text-[#2E7D5B]' : 'text-[#854D0E]'
                            }`}
                          >
                            {alloc.status === 'CONFIRMED'
                              ? 'CONFIRMED (Gate QR Active)'
                              : 'PROPOSED (Awaiting Caretaker Review)'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#5B6472] italic">
                        {appItem.status === 'PENDING'
                          ? 'Application registered. Awaiting window closure and batch lottery draw.'
                          : 'Allocation processing.'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Section 2: Hostel Application Form (when windows are open and user has not applied) */}
          {openWindows.length > 0 && myApplications.length === 0 && (
            <div className="bg-white border border-[#E4E1DA] rounded-lg p-5 shadow-sm space-y-4">
              <div className="pb-3 border-b border-[#E4E1DA]">
                <h3 className="text-sm font-semibold text-[#1C2430]">Apply for Hostel Accommodation</h3>
                <p className="text-xs text-[#5B6472] mt-0.5">
                  Registration window is currently open. Select your preferred hostel and details below.
                </p>
              </div>

              <form onSubmit={handleApplyHostel} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                      Registration Window
                    </label>
                    <select
                      value={appForm.window_id}
                      onChange={(e) => setAppForm({ ...appForm, window_id: e.target.value })}
                      required
                      className="w-full p-2.5 border border-[#E4E1DA] rounded bg-white text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                    >
                      {openWindows.map((w) => (
                        <option key={w.id} value={w.id}>
                          Session {w.academic_year} (Open until {new Date(w.open_to).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                      Preferred Hostel Choice
                    </label>
                    <select
                      value={appForm.hostel_id}
                      onChange={(e) => setAppForm({ ...appForm, hostel_id: e.target.value })}
                      required
                      className="w-full p-2.5 border border-[#E4E1DA] rounded bg-white text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                    >
                      <option value="">-- Choose Hostel --</option>
                      {hostelList
                        .filter((h) => {
                          if (profile?.gender === 'MALE') return h.type === 'BOYS';
                          if (profile?.gender === 'FEMALE') return h.type === 'GIRLS';
                          return true;
                        })
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.code}) — {h.type}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                      Year of Study
                    </label>
                    <select
                      value={appForm.year_of_study}
                      onChange={(e) =>
                        setAppForm({ ...appForm, year_of_study: parseInt(e.target.value, 10) })
                      }
                      className="w-full p-2.5 border border-[#E4E1DA] rounded bg-white text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                    >
                      <option value={1}>1st Year (Floor 1 mapped)</option>
                      <option value={2}>2nd Year (Floor 2 mapped)</option>
                      <option value={3}>3rd Year (Floor 3 mapped)</option>
                      <option value={4}>4th Year (Floor 4 mapped)</option>
                      <option value={5}>5th Year (Floor 5 mapped)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                      Verification Documents URL / Reference
                    </label>
                    <input
                      type="text"
                      value={appForm.documents_url}
                      onChange={(e) => setAppForm({ ...appForm, documents_url: e.target.value })}
                      placeholder="e.g. Admission letter link or registration ID"
                      className="w-full p-2.5 border border-[#E4E1DA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                    />
                  </div>
                </div>

                {/* Accessibility Accommodation Toggle */}
                <div className="p-3 bg-[#FBFBFA] border border-[#E4E1DA] rounded space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appForm.accessibility_needs}
                      onChange={(e) => setAppForm({ ...appForm, accessibility_needs: e.target.checked })}
                      className="rounded text-[#26415C]"
                    />
                    <span className="font-medium text-[#1C2430]">
                      I require special accessibility accommodation (Ground floor / Wheelchair accessible room)
                    </span>
                  </label>

                  {appForm.accessibility_needs && (
                    <textarea
                      value={appForm.accessibility_notes}
                      onChange={(e) => setAppForm({ ...appForm, accessibility_notes: e.target.value })}
                      placeholder="Please describe your specific accommodation needs for the accessibility pre-pass..."
                      className="w-full text-xs p-2 border border-[#D5D2CA] rounded focus:outline-none focus:border-[#26415C]"
                      rows={2}
                    />
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={allocSubmitting}
                    className="px-5 py-2 bg-[#26415C] hover:bg-[#1B2E42] text-white rounded font-medium transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{allocSubmitting ? 'Submitting Application...' : 'Submit Application'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Section 3: Room Swap Requests (Post-Allocation) */}
          {profile?.room && (
            <div className="bg-white border border-[#E4E1DA] rounded-lg p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E4E1DA]">
                <div>
                  <h3 className="text-sm font-semibold text-[#1C2430]">Mutual Room Swap Portal</h3>
                  <p className="text-xs text-[#5B6472] mt-0.5">
                    Your current room: <strong>Room {profile.room.room_number}</strong> ({profile.hostel?.name}).
                    Both students must mutually accept before staff approval.
                  </p>
                </div>
              </div>

              {/* Swap Alerts */}
              {swapError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-xs text-[#991B1B] flex items-center justify-between">
                  <span>{swapError}</span>
                  <button onClick={() => setSwapError(null)} className="font-semibold underline text-[11px]">
                    Dismiss
                  </button>
                </div>
              )}

              {swapSuccess && (
                <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded text-xs text-[#166534] flex items-center justify-between">
                  <span>{swapSuccess}</span>
                  <button onClick={() => setSwapSuccess(null)} className="font-semibold underline text-[11px]">
                    Dismiss
                  </button>
                </div>
              )}

              {/* Request Swap Form */}
              <form onSubmit={handleRequestSwap} className="p-3 bg-[#FBFBFA] border border-[#E4E1DA] rounded space-y-3 text-xs">
                <span className="font-semibold text-[#1C2430] block">Request Room Swap with a Student</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                      Peer Student Roll Number
                    </label>
                    <input
                      type="text"
                      value={swapTargetRoll}
                      onChange={(e) => setSwapTargetRoll(e.target.value)}
                      placeholder="e.g. 211112042"
                      required
                      className="w-full p-2 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                      Optional Note / Reason
                    </label>
                    <input
                      type="text"
                      value={swapNote}
                      onChange={(e) => setSwapNote(e.target.value)}
                      placeholder="e.g. Swapping to study together"
                      className="w-full p-2 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={swapSubmitting}
                    className="px-4 py-1.5 bg-[#26415C] hover:bg-[#1B2E42] text-white rounded font-medium transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 text-xs"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Send Swap Request</span>
                  </button>
                </div>
              </form>

              {/* Swaps List */}
              {mySwaps.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-[#1C2430] block">Your Swap History</span>
                  <div className="divide-y divide-[#E4E1DA] border border-[#E4E1DA] rounded">
                    {mySwaps.map((sw) => {
                      const isIncoming = sw.target_student_id === profile.id;
                      const canAccept = isIncoming && sw.status === 'PENDING_PEER_ACCEPTANCE';

                      return (
                        <div key={sw.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-[#1C2430]">
                              {isIncoming ? (
                                <span>Incoming swap request from {sw.sender_student?.user?.name} (Room {sw.sender_room?.room_number})</span>
                              ) : (
                                <span>Outgoing swap request to {sw.target_student?.user?.name} (Room {sw.target_room?.room_number})</span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#5B6472] mt-0.5">
                              {sw.is_cross_tier && (
                                <span className="text-[#B91C1C] font-medium mr-2">Cross-Tier Swap (Warden Review)</span>
                              )}
                              <span>Requested: {new Date(sw.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                sw.status === 'APPROVED'
                                  ? 'bg-[#2E7D5B] text-white'
                                  : sw.status === 'REJECTED'
                                  ? 'bg-[#FECACA] text-[#991B1B]'
                                  : sw.status === 'ESCALATED_TO_WARDEN'
                                  ? 'bg-[#F3E8FF] text-[#6B21A8]'
                                  : 'bg-[#FEF08A] text-[#854D0E]'
                              }`}
                            >
                              {sw.status.replace(/_/g, ' ')}
                            </span>

                            {canAccept && (
                              <button
                                onClick={() => handleAcceptPeerSwap(sw.id)}
                                disabled={swapSubmitting}
                                className="px-3 py-1 bg-[#2E7D5B] hover:bg-[#25664A] text-white rounded text-xs font-medium transition shadow-sm"
                              >
                                Accept Swap
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentAppPage;
