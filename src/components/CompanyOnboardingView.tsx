import React, { useState } from 'react';
import { Building2, ArrowRight, ShieldCheck, Users, AlertCircle, Loader2 } from 'lucide-react';

interface CompanyOnboardingViewProps {
  userName?: string;
  onCreateCompany: (companyName: string) => void;
  onJoinAsMember: () => Promise<boolean> | boolean;
}

export const CompanyOnboardingView: React.FC<CompanyOnboardingViewProps> = ({
  userName,
  onCreateCompany,
  onJoinAsMember,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [isCheckingMember, setIsCheckingMember] = useState(false);
  const [membershipError, setMembershipError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = companyName.trim();
    if (!trimmed) return;
    onCreateCompany(trimmed);
  };

  const handleMemberClick = async () => {
    setMembershipError(null);
    setIsCheckingMember(true);
    try {
      const hasMembership = await Promise.resolve(onJoinAsMember());
      if (!hasMembership) {
        setMembershipError(
          'You are not a part of any existing company yet. Please ask your company administrator to add your user link in Teams management, or create your own company above.'
        );
      }
    } catch {
      setMembershipError('Failed to verify company membership. Please try again.');
    } finally {
      setIsCheckingMember(false);
    }
  };

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
            Create your own company for full Admin access, or continue as a member of an existing company.
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
            onChange={(e) => {
              setCompanyName(e.target.value);
              if (membershipError) setMembershipError(null);
            }}
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

        {/* Option 2: Member of existing company */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900">Member of existing company</h2>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Continue as a member. If an administrator has assigned you to their company, your assigned companies and projects will automatically sync.
          </p>

          {/* Membership Error / Warning Alert */}
          {membershipError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/90 text-rose-800 text-xs flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Not a part of any existing company</p>
                <p className="text-[11px] text-rose-700 leading-relaxed font-normal">
                  {membershipError}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleMemberClick}
            disabled={isCheckingMember}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 border border-slate-300 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isCheckingMember ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                <span>Checking company membership...</span>
              </>
            ) : (
              <>
                <span>Continue as Member</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
