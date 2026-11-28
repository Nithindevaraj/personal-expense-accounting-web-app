import React, { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { Account, TeamMember } from '../types';

export interface CompanyManagerViewProps {
  userName?: string;
  userCode?: string;
  accounts: Account[];
  activeAccountId?: string;
  teamMembers?: TeamMember[];
  currentUserId?: string;
  onSelectCompany: (companyId: string) => void;
  onCreateCompany: (companyName: string) => void;
  onDeleteCompany?: (companyId: string) => void;
  onRefreshCompanies?: () => Promise<boolean>;
  isInsideSettings?: boolean;
  onBack?: () => void;
}

export const CompanyManagerView: React.FC<CompanyManagerViewProps> = ({
  userName: _userName,
  userCode: _userCode,
  accounts,
  activeAccountId,
  teamMembers = [],
  currentUserId,
  onSelectCompany,
  onCreateCompany,
  onDeleteCompany,
  onRefreshCompanies,
  isInsideSettings = false,
  onBack,
}) => {
  const [newCompanyName, setNewCompanyName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(accounts.length === 0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (!onRefreshCompanies || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshCompanies();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-sync polling every 4 seconds to discover if an admin added this user
  useEffect(() => {
    if (!onRefreshCompanies) return;
    let isCancelled = false;

    // Initial check on load
    void onRefreshCompanies();

    const interval = setInterval(async () => {
      if (isCancelled) return;
      try {
        await onRefreshCompanies();
      } catch {
        // ignore background poll errors
      }
    }, 4000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [onRefreshCompanies]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCompanyName.trim();
    if (!trimmed) return;
    onCreateCompany(trimmed);
    setNewCompanyName('');
    setShowCreateForm(false);
  };

  const content = (
    <div className="space-y-6">
      {/* Top Navigation Row */}
      {isInsideSettings && onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              Company Accounts
            </h1>
          </div>
        </div>

        {onRefreshCompanies && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Check for newly assigned companies"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        )}
      </div>

      {/* Available Company Accounts List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <span>Your Company Accounts</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
              {accounts.length}
            </span>
          </h2>
          {!showCreateForm && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New</span>
            </button>
          )}
        </div>

        {accounts.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-1">
            {accounts.map((comp) => {
              const isSelected = comp.id === activeAccountId;
              const isCreator = Boolean(currentUserId && comp.ownerId === currentUserId);
              const memberRole = teamMembers.find(
                (m) => m.accountId === comp.id && m.userId === currentUserId
              )?.role;
              const roleLabel = isCreator ? 'Owner' : memberRole === 'admin' ? 'Admin' : 'Spender';

              return (
                <div
                  key={comp.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {comp.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-semibold text-indigo-600">{roleLabel}</span>
                        {comp.companyCode && (
                          <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {comp.companyCode}
                          </span>
                        )}
                        {comp.taxId && <span>• Tax ID: {comp.taxId}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onDeleteCompany && (isCreator || memberRole === 'admin') && (
                      confirmDeleteId === comp.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              onDeleteCompany(comp.id);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(comp.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          title="Delete company account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectCompany(comp.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <span>{isSelected ? 'Open Workspace' : 'Switch & Open'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 space-y-2">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No Company Account Joined Yet</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
              Create your company below or ask your company administrator to add your user code from your User Profile.
            </p>
          </div>
        )}
      </div>

      {/* Option: Create New Company */}
      {showCreateForm ? (
        <form
          onSubmit={handleCreateSubmit}
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                Create a New Company
              </h3>
            </div>
            {accounts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            As the creator, you will have <strong className="text-indigo-700">Owner Access</strong> to invite members, manage divisions, projects, jobs, and settings.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              required
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Enter company name (e.g. Acme Corp)..."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="submit"
              disabled={!newCompanyName.trim()}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <span>Create Company</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="w-full p-3 rounded-2xl border border-dashed border-slate-300 hover:border-indigo-300 hover:bg-indigo-50/20 text-indigo-600 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Another Company</span>
        </button>
      )}
    </div>
  );

  // If viewed as standalone gate (outside Settings)
  if (!isInsideSettings) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8 animate-fade-in">
          {content}
        </div>
      </div>
    );
  }

  // Inside Settings View (embedded page)
  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
      {content}
    </div>
  );
};
