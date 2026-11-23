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
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

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
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewTransaction,
  netBalance,
  transactionCount,
  projectCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">
                  Personal Accounting
                </span>
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  INR ₹
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Kishore’s Ledger & Project Cost-Center
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>Data & Backup</span>
            </button>
          </nav>

          {/* Quick Stats & New Entry CTA */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50">
              {netBalance >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-600" />
              )}
              <div className="text-right">
                <span className="block text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                  Net Balance
                </span>
                <span
                  className={`text-sm font-bold ${
                    netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatINR(netBalance)}
                </span>
              </div>
            </div>

            <button
              onClick={onOpenNewTransaction}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium text-sm shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Entry</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 px-2 py-1 text-xs font-medium ${
              activeTab === 'dashboard' ? 'text-emerald-600 font-bold' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex flex-col items-center gap-1 px-2 py-1 text-xs font-medium ${
              activeTab === 'transactions' ? 'text-blue-600 font-bold' : 'text-slate-500'
            }`}
          >
            <ReceiptText className="w-4 h-4" />
            <span>Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex flex-col items-center gap-1 px-2 py-1 text-xs font-medium ${
              activeTab === 'projects' ? 'text-indigo-600 font-bold' : 'text-slate-500'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>Projects</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center gap-1 px-2 py-1 text-xs font-medium ${
              activeTab === 'analytics' ? 'text-amber-600 font-bold' : 'text-slate-500'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 px-2 py-1 text-xs font-medium ${
              activeTab === 'settings' ? 'text-slate-800 font-bold' : 'text-slate-500'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
