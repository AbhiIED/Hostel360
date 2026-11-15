import React, { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import {
  Shield,
  User as UserIcon,
  Mail,
  Lock,
  Building,
  GraduationCap,
  Sparkles,
  AlertCircle,
  Loader2,
  ArrowRight,
  CheckCircle2,
  HeartPulse,
} from 'lucide-react';

interface HostelOption {
  id: string;
  code: string;
  name: string;
  type: 'BOYS' | 'GIRLS';
  location: string;
  total_capacity: number;
  has_blocks: boolean;
  _count?: {
    students: number;
    rooms: number;
  };
}

export const RegisterPage: React.FC = () => {
  const { user, isAuthenticated, registerStudent } = useAuth();
  const navigate = useNavigate();

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [year, setYear] = useState<number>(1);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [accessibilityNeeds, setAccessibilityNeeds] = useState(false);
  const [accessibilityDetails, setAccessibilityDetails] = useState('');

  // UI State
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect straight to role console
  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'STUDENT' ? '/app' : '/dashboard'} replace />;
  }

  // Load registration options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoadingOptions(true);
        const res = await api.get('/auth/registration-options');
        const loadedHostels: HostelOption[] = res.data.hostels || [];
        setHostels(loadedHostels);

        if (res.data.departments && res.data.departments.length > 0) {
          setDepartments(res.data.departments);
          setDepartment(res.data.departments[0]);
        }

        // Auto-select first matching hostel for default gender
        const defaultMatch = loadedHostels.find((h) => h.type === 'BOYS');
        if (defaultMatch) {
          setSelectedHostelId(defaultMatch.id);
        }
      } catch (err) {
        console.error('Failed to load registration options:', err);
        setError('Failed to connect to backend server. Please verify your connection.');
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  // When gender changes, update selected hostel to matching hostel
  const handleGenderChange = (newGender: 'MALE' | 'FEMALE' | 'OTHER') => {
    setGender(newGender);
    const targetType = newGender === 'FEMALE' ? 'GIRLS' : 'BOYS';
    const match = hostels.find((h) => h.type === targetType);
    if (match) {
      setSelectedHostelId(match.id);
    }
  };

  const filteredHostels = hostels.filter((h) => {
    if (gender === 'FEMALE') return h.type === 'GIRLS';
    if (gender === 'MALE') return h.type === 'BOYS';
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password || !rollNumber || !selectedHostelId) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await registerStudent({
        name,
        email,
        password,
        roll_number: rollNumber,
        gender,
        department,
        year,
        hostel_id: selectedHostelId,
        accessibility_needs: accessibilityNeeds,
        accessibility_details: accessibilityNeeds ? accessibilityDetails : null,
      });

      // Directly route to student console on successful registration
      navigate('/app', { replace: true });
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { error?: string }; status?: number };
        code?: string;
      };

      if (axiosError.response?.data?.error) {
        setError(axiosError.response.data.error);
      } else if (axiosError.code === 'ERR_NETWORK' || !axiosError.response) {
        setError('Cannot connect to backend server. The server may still be deploying or waking up.');
      } else {
        setError('Student registration failed. Please review your details and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] py-8 sm:py-12 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        <div className="bg-white border border-[#E4E1DA] rounded-xl shadow-sm p-6 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#E4E1DA] text-[#26415C] text-xs font-medium mb-3">
              <Shield className="w-3.5 h-3.5 text-[#26415C]" />
              <span>Council of Wardens • MANIT Bhopal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C2430] tracking-tight">
              Student Admission & Room Lottery
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6472] mt-1.5 max-w-lg mx-auto">
              Register your institutional profile and automatically enter the academic semester batch room allocation lottery.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded bg-[#B3432B]/10 border border-[#B3432B]/30 text-[#B3432B] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B3432B]" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Personal Credentials */}
            <div className="border border-[#E4E1DA] rounded-lg p-4 sm:p-5 bg-[#FAF9F6]">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#E4E1DA]">
                <UserIcon className="w-4 h-4 text-[#26415C]" />
                <h2 className="text-xs font-semibold text-[#1C2430] uppercase tracking-wider">
                  1. Student Identity & Credentials
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#5B6472]/60 focus:outline-none focus:border-[#26415C] transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Scholar / Roll Number *
                  </label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. 241112045"
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#5B6472]/60 focus:outline-none focus:border-[#26415C] transition uppercase"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Institutional Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="scholar@manit.ac.in"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#5B6472]/60 focus:outline-none focus:border-[#26415C] transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Create Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#5B6472]/60 focus:outline-none focus:border-[#26415C] transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#5B6472]/60 focus:outline-none focus:border-[#26415C] transition"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Academic Program & Profile */}
            <div className="border border-[#E4E1DA] rounded-lg p-4 sm:p-5 bg-[#FAF9F6]">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#E4E1DA]">
                <GraduationCap className="w-4 h-4 text-[#26415C]" />
                <h2 className="text-xs font-semibold text-[#1C2430] uppercase tracking-wider">
                  2. Academic Department & Gender
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Gender Selection */}
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Gender *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenderChange('MALE')}
                      className={`py-2 px-3 text-xs font-medium rounded border transition ${
                        gender === 'MALE'
                          ? 'bg-[#26415C] text-white border-[#26415C]'
                          : 'bg-white text-[#1C2430] border-[#E4E1DA] hover:border-[#26415C]'
                      }`}
                    >
                      Male (Boys)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenderChange('FEMALE')}
                      className={`py-2 px-3 text-xs font-medium rounded border transition ${
                        gender === 'FEMALE'
                          ? 'bg-[#26415C] text-white border-[#26415C]'
                          : 'bg-white text-[#1C2430] border-[#E4E1DA] hover:border-[#26415C]'
                      }`}
                    >
                      Female (Girls)
                    </button>
                  </div>
                </div>

                {/* Department Selection */}
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Department / Branch *
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  >
                    {departments.length > 0 ? (
                      departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                        <option value="Electronics & Communication">Electronics & Communication</option>
                        <option value="Electrical Engineering">Electrical Engineering</option>
                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                        <option value="Civil Engineering">Civil Engineering</option>
                        <option value="Chemical Engineering">Chemical Engineering</option>
                        <option value="Architecture & Planning">Architecture & Planning</option>
                        <option value="Master of Computer Applications">MCA</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Academic Year */}
                <div>
                  <label className="block text-xs font-medium text-[#1C2430] mb-1">
                    Year of Study *
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C] transition"
                  >
                    <option value={1}>1st Year (Fresher)</option>
                    <option value={2}>2nd Year (Sophomore)</option>
                    <option value={3}>3rd Year (Junior)</option>
                    <option value={4}>4th Year (Senior)</option>
                    <option value={5}>5th Year / Dual Degree / PhD</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Hostel Selection & Lottery Enrollment */}
            <div className="border border-[#E4E1DA] rounded-lg p-4 sm:p-5 bg-[#FAF9F6]">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#E4E1DA]">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#26415C]" />
                  <h2 className="text-xs font-semibold text-[#1C2430] uppercase tracking-wider">
                    3. Hostel Admission & Room Lottery
                  </h2>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white border border-[#E4E1DA] text-[#26415C]">
                  {gender === 'FEMALE' ? 'Girls Hostels' : 'Boys Hostels'}
                </span>
              </div>

              {loadingOptions ? (
                <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#5B6472]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#26415C]" />
                  <span>Loading available MANIT hostels...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#1C2430] mb-1.5">
                      Select Target Hostel for Admission *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                      {filteredHostels.map((h) => {
                        const isSelected = selectedHostelId === h.id;
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setSelectedHostelId(h.id)}
                            className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                              isSelected
                                ? 'bg-white border-[#26415C] ring-2 ring-[#26415C]/20 shadow-sm'
                                : 'bg-white border-[#E4E1DA] hover:border-[#26415C]/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="font-semibold text-xs text-[#1C2430]">
                                {h.code} — {h.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-[#26415C] shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-[#5B6472]">
                              <span>{h.location}</span>
                              <span className="font-mono text-[#26415C]">Cap: {h.total_capacity}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Accessibility & Medical Accommodations */}
                  <div className="pt-3 border-t border-[#E4E1DA]">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={accessibilityNeeds}
                        onChange={(e) => setAccessibilityNeeds(e.target.checked)}
                        className="mt-0.5 rounded border-[#E4E1DA] text-[#26415C] focus:ring-[#26415C]"
                      />
                      <div className="text-xs">
                        <span className="font-medium text-[#1C2430] flex items-center gap-1.5">
                          <HeartPulse className="w-3.5 h-3.5 text-[#B3432B]" />
                          Physical Accessibility / Medical Placement Accommodation
                        </span>
                        <p className="text-[#5B6472] text-[11px] mt-0.5">
                          Check this if you require ground floor room placement due to physical disability or documented medical condition.
                        </p>
                      </div>
                    </label>

                    {accessibilityNeeds && (
                      <div className="mt-2.5 pl-6">
                        <textarea
                          value={accessibilityDetails}
                          onChange={(e) => setAccessibilityDetails(e.target.value)}
                          placeholder="Please briefly detail your mobility, medical, or ground-floor requirement for verification by the Chief Warden..."
                          rows={2}
                          className="w-full p-2 bg-white border border-[#E4E1DA] rounded text-xs text-[#1C2430] placeholder-[#5B6472]/60 focus:outline-none focus:border-[#26415C] transition"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Lottery Mechanics Explainer Banner */}
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-[#E4E1DA] text-xs text-[#5B6472] space-y-2">
              <div className="flex items-center gap-1.5 text-[#26415C] font-semibold text-xs">
                <Sparkles className="w-4 h-4 text-[#26415C]" />
                <span>How the HOSTEL360 Batch Room Lottery Works:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                <li>
                  <strong className="text-[#1C2430]">Deterministic Seeded Draw:</strong> Eliminates human bias and allocation race conditions using an auditable cryptographic shuffle.
                </li>
                <li>
                  <strong className="text-[#1C2430]">Accessibility Pre-Pass:</strong> Students with verified accessibility requirements receive reserved ground floor rooms prior to lottery draws.
                </li>
                <li>
                  <strong className="text-[#1C2430]">Floor-Year Mapping:</strong> Students are clustered by academic year onto allocated floors.
                </li>
                <li>
                  <strong className="text-[#1C2430]">Instant Portal Access:</strong> Once registered, you can track your lottery status, review proposed allocations, and request peer room swaps directly in your student console.
                </li>
              </ul>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || loadingOptions}
                className="w-full py-3 bg-[#26415C] hover:bg-[#1e344a] text-white font-medium rounded-lg text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering Account & Enrolling in Room Lottery...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Admission & Enter Room Lottery</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Navigation */}
          <div className="mt-8 pt-5 border-t border-[#E4E1DA] text-center text-xs text-[#5B6472]">
            <span>Already have an institutional student or staff account? </span>
            <Link
              to="/login"
              className="text-[#26415C] font-semibold hover:underline transition"
            >
              Sign in here →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
