import React, { useState } from 'react';
import { Building2, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';

interface CompanyOnboardingViewProps {
  userName?: string;
  onCreateCompany: (companyName: string) => void;
  onDirectLogin: () => void;
}

export const CompanyOnboardingView: React.FC<CompanyOnboardingViewProps> = ({
  userName,
  onCreateCompany,
  onDirectLogin,
}) => {
  const [companyName, setCompanyName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = companyName.trim();
    if (!trimmed) return;
    onCreateCompany(trimmed);
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
            Create your own company for full Admin access, or continue with Direct Login.
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

        {/* Option 2: Direct Login */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-slate-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900">Direct Login</h2>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Enter without Company Admin access. You can still create a company anytime from the top <span className="font-semibold text-slate-700">Companies</span> menu to gain Admin access for it.
          </p>
          <button
            type="button"
            onClick={onDirectLogin}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Continue with Direct Login
          </button>
        </div>
      </div>
    </div>
  );
};
