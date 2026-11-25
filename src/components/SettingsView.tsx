import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import type { Project, Transaction } from '../types';
import {
  type UserProfile,
  saveStoredExpenseCategories,
  saveStoredIncomeCategories,
} from '../utils/storage';
import {
  exportTransactionsToPDF,
  parseCSVToTransactions,
  transactionsToCSV,
} from '../utils/formatters';

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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const [newIncomeCat, setNewIncomeCat] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // PDF Export
  const handleExportPDF = () => {
    if (transactions.length === 0) {
      alert('No transactions available to export as PDF.');
      return;
    }
    exportTransactionsToPDF(transactions, userProfile);
    showNotification('Preparing PDF statement...');
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

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 animate-fade-in max-w-5xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-fade-in max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Import / Export Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Import/export
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 pt-1">
          {/* Export as PDF */}
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="truncate">export as PDF</span>
          </button>

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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Income Categories ({incomeCategories.length})
              </h3>
            </div>

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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Expense Categories ({expenseCategories.length})
              </h3>
            </div>

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

      {/* Data Reset & Maintenance */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-rose-200 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-rose-900">Data Reset & Maintenance</h3>
          </div>
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
  );
};
