import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  User,
  Camera,
  Smartphone,
  RefreshCw,
  ShieldCheck,
  LogOut,
  LogIn,
  KeyRound,
} from 'lucide-react';
import { usePWAInstall } from '../utils/pwa';
import type { Project, Transaction } from '../types';
import {
  type UserProfile,
  saveStoredExpenseCategories,
  saveStoredIncomeCategories,
  saveUserProfile,
} from '../utils/storage';
import { parseCSVToTransactions, transactionsToCSV } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

interface SettingsViewProps {
  transactions: Transaction[];
  projects: Project[];
  incomeCategories: string[];
  expenseCategories: string[];
  userProfile: UserProfile;
  onUpdateIncomeCategories: (cats: string[]) => void;
  onUpdateExpenseCategories: (cats: string[]) => void;
  onUpdateUserProfile: (profile: UserProfile) => void;
  onImportTransactions: (imported: Transaction[]) => void;
  onClearAllData: () => void;
  onOpenInstallModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  transactions,
  projects,
  incomeCategories,
  expenseCategories,
  userProfile,
  onUpdateIncomeCategories,
  onUpdateExpenseCategories,
  onUpdateUserProfile,
  onImportTransactions,
  onClearAllData,
  onOpenInstallModal,
}) => {
  const { user, signOut, signInWithGoogle, isConfigured } = useAuth();
  const { isInstalled } = usePWAInstall();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const [newIncomeCat, setNewIncomeCat] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [profileName, setProfileName] = useState(userProfile.name);
  const [avatar, setAvatar] = useState<string | undefined>(userProfile.avatar);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<string | null>(null);

  React.useEffect(() => {
    setProfileName(userProfile.name);
    setAvatar(userProfile.avatar);
  }, [userProfile]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Profile photo size should be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setAvatar(base64);
        const updated = { ...userProfile, name: profileName, avatar: base64 };
        onUpdateUserProfile(updated);
        saveUserProfile(updated);
        showNotification('Profile photo updated');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // CSV Export
  const handleExportCSV = () => {
    const csv = transactionsToCSV(transactions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Personal_Accounting_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showNotification('CSV exported successfully (100% compatible with Google Sheets)');
  };

  // JSON Full Backup
  const handleExportJSON = () => {
    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userProfile,
      projects,
      incomeCategories,
      expenseCategories,
      transactions,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Personal_Accounting_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showNotification('Complete JSON backup downloaded');
  };

  // CSV Import
  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      try {
        const parsed = parseCSVToTransactions(content) as Transaction[];
        if (parsed.length === 0) {
          alert('No valid transactions found in the uploaded CSV.');
          return;
        }
        onImportTransactions(parsed);
        showNotification(`Successfully imported ${parsed.length} transactions from CSV!`);
      } catch (err) {
        alert('Failed to parse CSV: ' + err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // JSON Restore
  const handleJSONFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      try {
        const data = JSON.parse(content);
        if (data.transactions && Array.isArray(data.transactions)) {
          onImportTransactions(data.transactions);
          if (data.incomeCategories) onUpdateIncomeCategories(data.incomeCategories);
          if (data.expenseCategories) onUpdateExpenseCategories(data.expenseCategories);
          if (data.userProfile) onUpdateUserProfile(data.userProfile);
          showNotification('Backup restored successfully!');
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        alert('Invalid JSON file: ' + err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Add Income Cat
  const handleAddIncomeCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncomeCat.trim() || incomeCategories.includes(newIncomeCat.trim())) return;
    const updated = [...incomeCategories, newIncomeCat.trim()];
    onUpdateIncomeCategories(updated);
    saveStoredIncomeCategories(updated);
    setNewIncomeCat('');
    showNotification(`Added income category: ${newIncomeCat}`);
  };

  // Remove Income Cat
  const handleRemoveIncomeCategory = (cat: string) => {
    if (incomeCategories.length <= 1) return;
    const updated = incomeCategories.filter((c) => c !== cat);
    onUpdateIncomeCategories(updated);
    saveStoredIncomeCategories(updated);
  };

  // Add Expense Cat
  const handleAddExpenseCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseCat.trim() || expenseCategories.includes(newExpenseCat.trim())) return;
    const updated = [...expenseCategories, newExpenseCat.trim()];
    onUpdateExpenseCategories(updated);
    saveStoredExpenseCategories(updated);
    setNewExpenseCat('');
    showNotification(`Added expense category: ${newExpenseCat}`);
  };

  // Remove Expense Cat
  const handleRemoveExpenseCategory = (cat: string) => {
    if (expenseCategories.length <= 1) return;
    const updated = expenseCategories.filter((c) => c !== cat);
    onUpdateExpenseCategories(updated);
    saveStoredExpenseCategories(updated);
  };

  // Save Profile Name & Photo
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = { ...userProfile, name: profileName, avatar };
    onUpdateUserProfile(updated);
    saveUserProfile(updated);
    showNotification('Profile updated successfully');
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 animate-fade-in max-w-5xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-fade-in max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
          Data Management & Configuration
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Manage backups, import/export CSV to Google Sheets, and customize transaction categories
        </p>
      </div>

      {/* Cloud Database & Security Status */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Supabase & Google Authentication</span>
                {isConfigured ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Live
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Keys Pending
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                PostgreSQL Database with Row-Level Security (RLS) partition isolation
              </p>
            </div>
          </div>

          <div>
            {user ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Sign out of Google (${user.email})?`)) {
                    signOut();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out ({user.email})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block font-medium">Google OAuth Identity</span>
            <span className="font-semibold text-slate-900 truncate block mt-0.5">
              {user ? user.email : 'Unauthenticated (Offline Demo)'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block font-medium">Row-Level Security (RLS)</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{user ? 'Enforced (auth.uid)' : 'Active on Login'}</span>
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block font-medium">Database Host</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span className="truncate">{isConfigured ? 'Supabase Managed PG' : 'Local Storage Fallback'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Import / Export Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Google Sheets Interoperability & Backup
          </h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          The CSV exporter generates identical columns as your original Google Sheet (`Sl.No`, `Date`, `income/expense`, `type of income/expense`, `Amount`, `Tags`, `Description or Remarks`, `Attachments`, `Notes`).
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 pt-1">
          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="truncate">Export CSV</span>
          </button>

          {/* Import CSV */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span className="truncate">Import CSV</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleCSVFileChange}
            accept=".csv"
            className="hidden"
          />

          {/* Backup JSON */}
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition-all cursor-pointer"
          >
            <Database className="w-4 h-4 shrink-0" />
            <span className="truncate">Backup (JSON)</span>
          </button>

          {/* Restore JSON */}
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span className="truncate">Restore (JSON)</span>
          </button>
          <input
            type="file"
            ref={jsonInputRef}
            onChange={handleJSONFileChange}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>

      {/* Categories Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Income Categories */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Income Categories ({incomeCategories.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Extracted directly from the Google Sheet validation list.
            </p>

            <form onSubmit={handleAddIncomeCategory} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newIncomeCat}
                onChange={(e) => setNewIncomeCat(e.target.value)}
                placeholder="New income category..."
                className="grow px-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                Add
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-1 no-scrollbar">
              {incomeCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveIncomeCategory(cat)}
                    className="p-0.5 hover:text-rose-600 cursor-pointer text-slate-400"
                    aria-label={`Remove category ${cat}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Expense Categories */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Expense Categories ({expenseCategories.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Categories available when logging expense debits.
            </p>

            <form onSubmit={handleAddExpenseCategory} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newExpenseCat}
                onChange={(e) => setNewExpenseCat(e.target.value)}
                placeholder="New expense category..."
                className="grow px-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                Add
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-1 no-scrollbar">
              {expenseCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExpenseCategory(cat)}
                    className="p-0.5 hover:text-rose-600 cursor-pointer text-slate-400"
                    aria-label={`Remove category ${cat}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Progressive Web App & Offline Installation */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white p-4 sm:p-6 rounded-2xl shadow-sm border border-emerald-900/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base tracking-tight">
                  Progressive Web App (PWA)
                </h3>
                {isInstalled ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    Installed (Standalone Mode)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Browser Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                Install this app on your device for standalone window display, offline transaction recording, and home screen / desktop shortcut access with zero network lag.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {!isInstalled && onOpenInstallModal && (
              <button
                type="button"
                onClick={onOpenInstallModal}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Install Web App</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then((regs) => {
                    for (const reg of regs) reg.update();
                    showNotification('Service worker cache refreshed');
                  });
                } else {
                  showNotification('PWA cache active');
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition cursor-pointer border border-white/10"
              title="Check for Service Worker update"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-300" />
              <span>Update Cache</span>
            </button>
          </div>
        </div>
      </div>

      {/* User Identity & Danger Zone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Profile Card */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900">User Profile</h3>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Avatar Photo Section */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative group shrink-0">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={profileName || 'Profile'}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-emerald-500/20 shadow-xs"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-bold shadow-xs">
                    {profileName ? profileName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                  title="Upload Photo"
                  aria-label="Upload Photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                className="hidden"
              />
              <div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 cursor-pointer block py-1"
                >
                  {avatar ? 'Change Photo' : 'Upload Photo'}
                </button>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatar(undefined);
                      const updated = { ...userProfile, name: profileName, avatar: undefined };
                      onUpdateUserProfile(updated);
                      saveUserProfile(updated);
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer py-0.5"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Account Holder Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Currency & Region
              </label>
              <input
                type="text"
                disabled
                value="INR (₹) • Asia/Calcutta"
                className="w-full px-3 py-2.5 text-base sm:text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
            >
              Update Profile
            </button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-rose-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <h3 className="text-sm sm:text-base font-bold text-rose-900">Data Reset & Maintenance</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Permanently purge all offline database tables from this browser. Make sure to download a JSON backup before proceeding.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100 mt-4">
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'DANGER: Are you sure you want to permanently clear all local records? This cannot be undone.'
                  )
                ) {
                  onClearAllData();
                  showNotification('All records cleared');
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Clear All Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
