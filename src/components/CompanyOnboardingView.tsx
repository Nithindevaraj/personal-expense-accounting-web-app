import React, { useEffect, useState } from 'react';
import { Building2, ArrowRight, ShieldCheck, Users, Copy, Check, Loader2 } from 'lucide-react';

interface CompanyOnboardingViewProps {
  userName?: string;
  userCode: string;
  onCreateCompany: (companyName: string) => void;
  onCheckMembership: () => Promise<boolean>;
}

export const CompanyOnboardingView: React.FC<CompanyOnboardingViewProps> = ({
  userName,
  userCode,
  onCreateCompany,
  onCheckMembership,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [copied, setCopied] = useState(false);
  const [isAutoChecking, setIsAutoChecking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = companyName.trim();
    if (!trimmed) return;
    onCreateCompany(trimmed);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback manual copy
      const input = document.createElement('textarea');
      input.value = userCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Periodically check in the background while waiting for admin to add user
  useEffect(() => {
    let isCancelled = false;
    const interval = setInterval(async () => {
      if (isCancelled) return;
      setIsAutoChecking(true);
      try {
        const found = await onCheckMembership();
        if (found && !isCancelled) {
          clearInterval(interval);
        }
      } catch {
        // ignore background poll errors
      } finally {
        if (!isCancelled) setIsAutoChecking(false);
      }
    }, 4000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [onCheckMembership]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {userName ? `Welcome, ${userName}` : 'Choose Workspace Mode'}
          </h1>
          <p className="text-xs text-slate-500">
            Create your own company for full Admin access, or become a member of an existing company.
          </p>
        </div>

        {/* Option 1: Create a Company */}
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900">Create a Company</h2>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Get full <span className="font-semibold text-indigo-700">Admin Access</span> to edit company profile and manage divisions, projects, jobs, teams, and categories.
          </p>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Enter company name..."
            className="w-full px-3 py-2.5 text-base sm:text-xs bg-white border border-indigo-200 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            type="submit"
            disabled={!companyName.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Create Company &amp; Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            or
          </span>
        </div>

        {/* Option 2: Become a member of existing company */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600 shrink-0" />
              <h2 className="text-sm font-bold text-slate-900">
                Become a member of existing company
              </h2>
            </div>
            {isAutoChecking && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Syncing</span>
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            Share your <strong className="text-slate-800">16-Digit Individual User Code</strong> below with your company administrator. Once they enter this code in <strong className="text-slate-800">Teams management</strong>, you will automatically enter their company workspace.
          </p>

          {/* Individual User Code Box */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 block">
              Your 16-Digit Individual User Code
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={userCode}
                className="w-full px-3 py-2 text-sm font-mono font-bold tracking-wider bg-white border border-slate-300 rounded-xl text-indigo-700 focus:outline-hidden select-all text-center"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer"
                title="Copy 16-Digit Code"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Waiting Status Box */}
          <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/90 flex items-center gap-2.5 text-xs text-emerald-900">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
            <p className="text-[11px] leading-relaxed">
              Waiting for a company administrator to add your 16-digit code. This screen will automatically refresh into the workspace as soon as you are added.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
