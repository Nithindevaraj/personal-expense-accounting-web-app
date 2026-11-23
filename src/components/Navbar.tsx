import React from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  FolderKanban,
  BarChart3,
  Settings,
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  User,
} from 'lucide-react';
import { formatINR } from '../utils/formatters';
import type { UserProfile } from '../utils/storage';

export type ActiveTab = 'dashboard' | 'transactions' | 'projects' | 'analytics' | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTransaction: () => void;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
  projectCount: number;
  userProfile: UserProfile;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewTransaction,
  netBalance,
  transactionCount,
  projectCount,
  userProfile,
  onOpenProfile,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* Top Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Personal Accounting
              </span>
              {/* Profile Icon / Photo Button */}
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center gap-1.5 p-0.5 pr-2 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 transition-all cursor-pointer group shadow-2xs"
                title="Edit User Profile & Photo"
              >
                {userProfile.avatar ? (
                  <img
                    src={userProfile.avatar}
                    alt={userProfile.name || 'User'}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-emerald-500/30"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-bold">
                    {userProfile.name ? (
                      userProfile.name.charAt(0).toUpperCase()
                    ) : (
                      <User className="w-3.5 h-3.5" />
                    )}
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 truncate max-w-[90px]">
                  {userProfile.name || 'Profile'}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Net Balance & Add Entry */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50">
              {netBalance >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-600" />
              )}
              <div className="text-right">
                <span className="hidden sm:block text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                  Net Balance
                </span>
                <span
                  className={`text-xs sm:text-sm font-bold ${
                    netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatINR(netBalance)}
                </span>
              </div>
            </div>

            <button
              onClick={onOpenNewTransaction}
              className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium text-xs sm:text-sm shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Entry</span>
            </button>
          </div>
        </div>
      </div>

      {/* Permanently Docked Navigation Chips (Top Row 2) */}
      <div className="border-t border-slate-200/80 bg-slate-50/70 py-2 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-2xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-emerald-600" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'transactions'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <ReceiptText className="w-4 h-4 text-blue-600" />
              <span>Transactions</span>
              <span className="text-[11px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full font-bold">
                {transactionCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'projects'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <FolderKanban className="w-4 h-4 text-indigo-600" />
              <span>Projects</span>
              <span className="text-[11px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full font-bold">
                {projectCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-amber-600" />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>Data & Backup</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
