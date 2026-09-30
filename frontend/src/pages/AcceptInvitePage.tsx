import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import {
  ShieldCheck,
  Building2,
  Utensils,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const tokenParam = searchParams.get('token') || '';
  const [tokenInput, setTokenInput] = useState<string>(tokenParam);
  const [verifiedInvite, setVerifiedInvite] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(Boolean(tokenParam));
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAccepted, setIsAccepted] = useState<boolean>(false);
  const [acceptedRole, setAcceptedRole] = useState<string>('');

  const verifyToken = async (tok: string) => {
    if (!tok.trim()) return;
    try {
      setIsVerifying(true);
      setVerifyError(null);
      const res = await api.get('/staff/invites/verify', {
        params: { token: tok.trim() },
      });
      setVerifiedInvite(res.data.invite);
      setAcceptedRole(res.data.invite.role);
    } catch (err: any) {
      setVerifyError(err.response?.data?.error || 'Invalid or expired invitation token.');
      setVerifiedInvite(null);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (tokenParam) {
      verifyToken(tokenParam);
    }
  }, [tokenParam]);

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      verifyToken(tokenInput.trim());
    }
  };

  const handleAcceptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setSubmitError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await api.post('/staff/invites/accept', {
        token: tokenInput.trim() || tokenParam.trim(),
        password,
      });

      setIsAccepted(true);
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Failed to activate staff account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 sm:px-6">
      {/* Institutional Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-[#26415C] border border-[#E4E1DA] text-xs font-medium mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-[#26415C]" />
          <span>Council of Wardens (COW) • Staff Onboarding</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#1C2430]">
          Staff Account Activation
        </h1>
        <p className="text-xs text-[#5B6472] mt-1.5">
          Accept your official appointment and create your secure password to access HOSTEL360.
        </p>
      </div>

      {isAccepted ? (
        <div className="bg-white border border-[#E4E1DA] rounded-lg p-8 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#EBF5EE] text-[#2E7D5B] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-xl font-medium text-[#1C2430]">
            Appointment Activated Successfully!
          </h2>
          <p className="text-xs text-[#5B6472] max-w-md mx-auto leading-relaxed">
            Your official account as <strong>{acceptedRole}</strong> has been configured with active campus assignments.
            You can now sign in using your email address and password.
          </p>
          <div className="pt-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded bg-[#26415C] hover:bg-[#1B2E42] text-white text-xs font-medium transition shadow-sm"
            >
              <span>Proceed to Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E4E1DA] rounded-lg p-6 sm:p-8 shadow-sm space-y-6 text-xs">
          {/* Token verification input if token not in URL or needs manual entry */}
          {!verifiedInvite && (
            <form onSubmit={handleManualVerify} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                  Invitation Token
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste 64-character token"
                    required
                    className="flex-1 p-2.5 border border-[#D5D2CA] rounded font-mono text-xs text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="px-4 py-2 bg-[#26415C] hover:bg-[#1B2E42] text-white rounded font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Verify'}
                  </button>
                </div>
              </div>

              {verifyError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-[#991B1B] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}
            </form>
          )}

          {/* Verified Invitation Details */}
          {verifiedInvite && (
            <div className="space-y-6">
              <div className="bg-[#FAF9F6] border border-[#E4E1DA] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E4E1DA]">
                  <span className="text-[11px] font-semibold text-[#5B6472] uppercase tracking-wide">
                    Official Appointment Details
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#26415C] text-white">
                    {verifiedInvite.role}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#5B6472] block text-[11px]">Appointee Name:</span>
                    <span className="font-medium text-[#1C2430]">{verifiedInvite.name}</span>
                  </div>
                  <div>
                    <span className="text-[#5B6472] block text-[11px]">Employee ID:</span>
                    <span className="font-mono text-[#1C2430]">{verifiedInvite.employee_id}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#5B6472] block text-[11px]">Registered Email:</span>
                    <span className="font-mono text-[#1C2430]">{verifiedInvite.email}</span>
                  </div>
                </div>

                {/* Assigned Hostels or Messes */}
                {verifiedInvite.hostels?.length > 0 && (
                  <div className="pt-2 border-t border-[#E4E1DA]">
                    <span className="text-[#5B6472] block text-[11px] mb-1">Assigned Hostel(s):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {verifiedInvite.hostels.map((h: any) => (
                        <span
                          key={h.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#E4E1DA] font-medium text-[#1C2430]"
                        >
                          <Building2 className="w-3 h-3 text-[#26415C]" />
                          <span>{h.name} ({h.code})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {verifiedInvite.messes?.length > 0 && (
                  <div className="pt-2 border-t border-[#E4E1DA]">
                    <span className="text-[#5B6472] block text-[11px] mb-1">Assigned Dining Hall(s):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {verifiedInvite.messes.map((m: any) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#E4E1DA] font-medium text-[#1C2430]"
                        >
                          <Utensils className="w-3 h-3 text-[#26415C]" />
                          <span>{m.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Password Setting Form */}
              <form onSubmit={handleAcceptSubmit} className="space-y-4">
                <span className="font-serif text-sm font-medium text-[#1C2430] block">
                  Set Your Secure Password
                </span>

                <div>
                  <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                    Password (min 6 characters)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full p-2.5 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                    />
                    <Lock className="w-4 h-4 text-[#5B6472] absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#5B6472] mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full p-2.5 border border-[#D5D2CA] rounded text-[#1C2430] focus:outline-none focus:border-[#26415C]"
                  />
                </div>

                {submitError && (
                  <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-[#991B1B] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 bg-[#26415C] hover:bg-[#1B2E42] text-white rounded font-medium transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Activating Appointment...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Activate Staff Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AcceptInvitePage;
