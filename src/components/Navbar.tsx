import React, { useEffect, useRef, useState } from 'react';
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
  LogIn,
  Sun,
  Moon,
  ChevronDown,
  Building2,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Account } from '../types';
import { DEFAULT_ACCOUNT_ID } from '../types';
import { formatINR } from '../utils/formatters';
import type { UserProfile } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { isUserCompanyAdmin } from '../utils/projectPermissions';
import {
  applyTheme,
  getStoredTheme,
  getSystemPrefersDark,
  type ThemePreference,
} from '../utils/theme';

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
  accounts: Account[];
  activeAccountId: string;
  currentUserId?: string;
  onSwitchAccount: (id: string) => void;
  onAddAccount: (name: string) => void;
  onRenameAccount: (id: string, name: string) => void;
  onDeleteAccount: (id: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewTransaction,
  netBalance,
  userProfile,
  onOpenProfile,
  accounts,
  activeAccountId,
  currentUserId,
  onSwitchAccount,
  onAddAccount,
  onRenameAccount,
  onDeleteAccount,
}) => {
  const { user, signInWithGoogle } = useAuth();
  const [theme, setTheme] = useState<ThemePreference>(() => getStoredTheme());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    getSystemPrefersDark()
  );
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountName, setEditingAccountName] = useState('');
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
        setEditingAccountId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAccountMenuOpen]);

  const activeAccount =
    accounts.find((a) => a.id === activeAccountId) || accounts[0] || { id: DEFAULT_ACCOUNT_ID, name: 'Personal' };

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'color-scheme') {
        const next = getStoredTheme();
        setTheme(next);
        applyTheme(next);
      }
    };
    mq?.addEventListener('change', handleMediaChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      mq?.removeEventListener('change', handleMediaChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark);

  const handleToggleTheme = () => {
    const target: 'light' | 'dark' = isDark ? 'light' : 'dark';
    const systemScheme: 'light' | 'dark' = systemPrefersDark ? 'dark' : 'light';
    const nextPref: ThemePreference = target === systemScheme ? 'system' : target;
    setTheme(nextPref);
    applyTheme(nextPref);
  };

  const userAvatar = user?.user_metadata?.avatar_url || userProfile.avatar;
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || userProfile.name || 'User';

  return (
    <>
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-15 gap-2">
            {/* Logo, Account/Company Switcher & Profile */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="relative flex items-center gap-2 min-w-0" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                  aria-expanded={isAccountMenuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 px-2 py-1 -ml-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer min-w-0 group"
                  title="Switch or manage companies"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight truncate max-w-[115px] sm:max-w-[200px]">
                    {activeAccount.name}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Accounts / Company Switcher Dropdown */}
                {isAccountMenuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2.5 z-50 animate-fade-in">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Companies
                    </div>

                    <div className="space-y-1 max-h-56 overflow-y-auto my-1">
                      {accounts.length === 0 && (
                        <p className="px-2 py-2 text-[11px] text-slate-400">
                          No companies yet. Create one below.
                        </p>
                      )}
                      {accounts.map((acc) => {
                        const isActive = acc.id === activeAccountId;
                        const isEditing = editingAccountId === acc.id;
                        return (
                          <div
                            key={acc.id}
                            className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl text-xs transition-colors ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            {isEditing ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (editingAccountName.trim()) {
                                    onRenameAccount(acc.id, editingAccountName.trim());
                                  }
                                  setEditingAccountId(null);
                                }}
                                className="flex items-center gap-1 flex-1 min-w-0"
                              >
                                <input
                                  type="text"
                                  value={editingAccountName}
                                  onChange={(e) => setEditingAccountName(e.target.value)}
                                  autoFocus
                                  className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                                />
                                <button
                                  type="submit"
                                  className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold cursor-pointer shrink-0"
                                >
                                  Save
                                </button>
                              </form>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSwitchAccount(acc.id);
                                    setIsAccountMenuOpen(false);
                                  }}
                                  className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                                >
                                  <Building2 className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                                  <span className="truncate">{acc.name}</span>
                                  {isActive && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-auto" />}
                                </button>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {isUserCompanyAdmin(acc, currentUserId) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingAccountId(acc.id);
                                        setEditingAccountName(acc.name);
                                      }}
                                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                      title="Rename company"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                  {acc.id !== DEFAULT_ACCOUNT_ID && isUserCompanyAdmin(acc, currentUserId) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`Delete company "${acc.name}"?`)) {
                                          onDeleteAccount(acc.id);
                                        }
                                      }}
                                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                      title="Delete company"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newAccountName.trim()) return;
                        onAddAccount(newAccountName.trim());
                        setNewAccountName('');
                        setIsAccountMenuOpen(false);
                      }}
                      className="flex items-center gap-1.5 pt-2 mt-1.5 border-t border-slate-100"
                    >
                      <input
                        type="text"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder="New company / account..."
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shrink-0"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 min-w-0">

                {/* Profile Icon / Photo Button */}
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-1.5 p-0.5 sm:pr-2 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 transition-all cursor-pointer group shadow-2xs shrink-0"
                  title={user?.email ? `Signed in as ${user.email} (Click to view profile)` : 'Edit User Profile & Photo'}
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={displayName}
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-emerald-500/30"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden md:inline text-xs font-semibold text-slate-700 group-hover:text-slate-900 truncate max-w-[80px]">
                    {displayName}
                  </span>
                </button>
              </div>
            </div>

            {/* Right: Net Balance & Add Entry */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-slate-50">
                {netBalance >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 shrink-0" />
                )}
                <div className="text-right leading-none sm:leading-normal">
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
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-sm shadow-sm shadow-emerald-600/30 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Entry</span>
              </button>

              {/* Theme Toggle (Light / Dark) */}
              <button
                type="button"
                onClick={handleToggleTheme}
                className="p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all cursor-pointer shrink-0"
                title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>

              {/* Sign In Button (when signed out) */}
              {!user && (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
                  title="Sign in with Google"
                >
                  <LogIn className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Navigation Chips (Hidden on mobile) */}
        <div className="hidden sm:block border-t border-slate-200/80 bg-slate-50/70 py-2 px-4 sm:px-6 lg:px-8">
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
                <span>Home</span>
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
                <span>Ledger</span>
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
                <span>Project</span>
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
                <span>Insights</span>
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
                <span>Settings</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-[0_-4px_25px_rgba(0,0,0,0.07)] pb-safe">
        <div className="grid grid-cols-5 h-14 items-center px-1">
          {/* Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 transition-all ${
              activeTab === 'dashboard'
                ? 'text-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-emerald-50' : ''}`}>
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Home</span>
          </button>

          {/* Transactions */}
          <button
            onClick={() => setActiveTab('transactions')}
            className={`relative flex flex-col items-center justify-center py-1 transition-all ${
              activeTab === 'transactions'
                ? 'text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${activeTab === 'transactions' ? 'bg-blue-50' : ''}`}>
              <ReceiptText className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Ledger</span>
          </button>

          {/* Projects */}
          <button
            onClick={() => setActiveTab('projects')}
            className={`relative flex flex-col items-center justify-center py-1 transition-all ${
              activeTab === 'projects'
                ? 'text-indigo-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${activeTab === 'projects' ? 'bg-indigo-50' : ''}`}>
              <FolderKanban className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Project</span>
          </button>

          {/* Analytics */}
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center justify-center py-1 transition-all ${
              activeTab === 'analytics'
                ? 'text-amber-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-amber-50' : ''}`}>
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Insights</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center py-1 transition-all ${
              activeTab === 'settings'
                ? 'text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-slate-100' : ''}`}>
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Settings</span>
          </button>
        </div>
      </nav>
    </>
  );
};
