import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowLeft,
  Repeat,
  Plus,
  FolderKanban,
  Users,
  UserPlus,
} from 'lucide-react';
import type {
  Project,
  RecurringTransaction,
  TeamMember,
  Transaction,
  TransactionType,
} from '../types';
import { formatINR } from '../utils/formatters';
import {
  type UserProfile,
  parseIndividualUserLink,
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
  onResetToDefaults: () => void;
  recurringTransactions: RecurringTransaction[];
  onAddRecurring: (
    item: Omit<RecurringTransaction, 'id' | 'accountId' | 'createdAt' | 'lastGeneratedMonth'>
  ) => void;
  onDeleteRecurring: (id: string) => void;
  teamMembers: TeamMember[];
  onAddTeamMember: (member: Omit<TeamMember, 'id' | 'accountId' | 'createdAt'>) => void;
  onDeleteTeamMember: (id: string) => void;
}

function formatDayOrdinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
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
  onResetToDefaults,
  recurringTransactions,
  onAddRecurring,
  onDeleteRecurring,
  teamMembers,
  onAddTeamMember,
  onDeleteTeamMember,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const [newIncomeCat, setNewIncomeCat] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [showRecurringPage, setShowRecurringPage] = useState(false);
  const [showTeamsPage, setShowTeamsPage] = useState(false);
  const [memberLinkInput, setMemberLinkInput] = useState('');
  const [memberNameInput, setMemberNameInput] = useState('');
  const [memberDesignationInput, setMemberDesignationInput] = useState('');
  const [openSections, setOpenSections] = useState({
    importExport: false,
    incomeCats: false,
    expenseCats: false,
    maintenance: false,
  });

  const groupedRecurring = useMemo(() => {
    const groups = new Map<string, RecurringTransaction[]>();
    for (const item of recurringTransactions) {
      const key = item.tag || 'General Transactions';
      const existing = groups.get(key);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(key, [item]);
      }
    }
    return Array.from(groups.entries());
  }, [recurringTransactions]);

  const topProjects = projects.filter((p) => !p.parentId);
  const [recType, setRecType] = useState<TransactionType>('Expense');
  const [recDay, setRecDay] = useState('7');
  const [recAmount, setRecAmount] = useState('');
  const [recTag, setRecTag] = useState(topProjects[0]?.name || 'General Transactions');
  const [recSubTag, setRecSubTag] = useState<string | null>(null);
  const [recCategory, setRecCategory] = useState(expenseCategories[0] || 'Rents');
  const [recDescription, setRecDescription] = useState('');
  const [recNotes, setRecNotes] = useState('');

  const handleRecTypeChange = (nextType: TransactionType) => {
    setRecType(nextType);
    const list = nextType === 'Income' ? incomeCategories : expenseCategories;
    if (!list.includes(recCategory)) {
      setRecCategory(list[0] || (nextType === 'Income' ? 'Salary' : 'Food'));
    }
  };

  const handleCreateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(recAmount);
    const parsedDay = Math.min(31, Math.max(1, parseInt(recDay, 10) || 1));
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    onAddRecurring({
      type: recType,
      dayOfMonth: parsedDay,
      amount: parsedAmt,
      tag: recTag || topProjects[0]?.name || 'General Transactions',
      subTag: recSubTag || null,
      category: recCategory || (recType === 'Income' ? 'Salary' : 'Food'),
      description: recDescription.trim(),
      notes: recNotes.trim(),
    });

    setRecAmount('');
    setRecDescription('');
    setRecNotes('');
    showNotification(`Recurring ${recType.toLowerCase()} added for ${formatDayOrdinal(parsedDay)} of every month`);
  };

  const handleMemberLinkChange = (value: string) => {
    setMemberLinkInput(value);
    const parsed = parseIndividualUserLink(value);
    if (parsed.name && !memberNameInput.trim()) {
      setMemberNameInput(parsed.name);
    }
  };

  const handleCreateTeamMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberLinkInput.trim() || !memberDesignationInput.trim()) return;
    const parsed = parseIndividualUserLink(memberLinkInput);
    if (!parsed.userId) return;
    onAddTeamMember({
      userId: parsed.userId,
      userLink: parsed.userLink,
      name: memberNameInput.trim() || parsed.name || 'Team Member',
      designation: memberDesignationInput.trim(),
    });
    setMemberLinkInput('');
    setMemberNameInput('');
    setMemberDesignationInput('');
    showNotification('Team member added');
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

      {showRecurringPage ? (
        /* Recurring Transactions Full Page */
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowRecurringPage(false)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <Repeat className="w-5 h-5 text-indigo-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Recurring Transactions
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Auto-generated monthly
            </span>
          </div>

          <div className="space-y-4">
            <form onSubmit={handleCreateRecurring} className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleRecTypeChange('Income')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    recType === 'Income'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => handleRecTypeChange('Expense')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    recType === 'Expense'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Expense
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Day of Month (1–31) *
                  </label>
                  <select
                    value={recDay}
                    onChange={(e) => setRecDay(e.target.value)}
                    className="w-full px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-800"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d)}>
                        {formatDayOrdinal(d)} of every month
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={recAmount}
                    onChange={(e) => setRecAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Project *
                  </label>
                  <select
                    value={recSubTag ? `${recTag}:::${recSubTag}` : recTag}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(':::')) {
                        const [pName, sName] = val.split(':::');
                        setRecTag(pName);
                        setRecSubTag(sName);
                      } else {
                        setRecTag(val);
                        setRecSubTag(null);
                      }
                    }}
                    className="w-full px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-800"
                  >
                    {topProjects.map((p) => {
                      const children = projects.filter((sub) => sub.parentId === p.id);
                      return (
                        <React.Fragment key={p.id}>
                          <option value={p.name}>{p.name}</option>
                          {children.map((sub) => (
                            <option key={sub.id} value={`${p.name}:::${sub.name}`}>
                              ↳ {p.name} / {sub.name}
                            </option>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Category *
                  </label>
                  <select
                    value={recCategory}
                    onChange={(e) => setRecCategory(e.target.value)}
                    className="w-full px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-800"
                  >
                    {(recType === 'Income' ? incomeCategories : expenseCategories).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={recDescription}
                    onChange={(e) => setRecDescription(e.target.value)}
                    placeholder="e.g. Monthly office rent, Salary"
                    className="w-full px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={recNotes}
                    onChange={(e) => setRecNotes(e.target.value)}
                    placeholder="Optional reference notes"
                    className="w-full px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Recurring Transaction</span>
                </button>
              </div>
            </form>

            {groupedRecurring.length > 0 && (
              <div className="space-y-3">
                {groupedRecurring.map(([projectName, items]) => (
                  <div
                    key={projectName}
                    className="rounded-xl border border-slate-200/90 bg-slate-50/60 overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-100/80 border-b border-slate-200/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderKanban className="w-4 h-4 text-indigo-600 shrink-0" />
                        <h3 className="text-xs font-bold text-slate-900 truncate">
                          {projectName}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600 shrink-0">
                        {items.length}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-200/70">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 p-3 bg-white/80 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  item.type === 'Income'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.type}
                              </span>
                              <span className="font-bold text-slate-900">
                                {formatDayOrdinal(item.dayOfMonth)} of every month
                              </span>
                              {item.subTag && (
                                <>
                                  <span className="text-slate-400">•</span>
                                  <span className="font-semibold text-indigo-700">
                                    {item.subTag}
                                  </span>
                                </>
                              )}
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600">{item.category}</span>
                            </div>
                            {(item.description || item.notes) && (
                              <p className="text-[11px] text-slate-500 mt-1 truncate">
                                {item.description}
                                {item.description && item.notes ? ' — ' : ''}
                                {item.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span
                              className={`font-bold ${
                                item.type === 'Income' ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {formatINR(item.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => onDeleteRecurring(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Delete recurring transaction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : showTeamsPage ? (
        /* Teams Full Page */
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowTeamsPage(false)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <Users className="w-5 h-5 text-emerald-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Teams
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Members &amp; Designations
            </span>
          </div>

          {/* Add Team Member Form */}
          <form
            onSubmit={handleCreateTeamMember}
            className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Individual User Link or User ID *
                </label>
                <input
                  type="text"
                  required
                  value={memberLinkInput}
                  onChange={(e) => handleMemberLinkChange(e.target.value)}
                  placeholder="Paste user's individual link or User ID"
                  className="w-full px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Member Name
                </label>
                <input
                  type="text"
                  value={memberNameInput}
                  onChange={(e) => setMemberNameInput(e.target.value)}
                  placeholder="e.g. Ravi Kumar (auto-filled from link)"
                  className="w-full px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Designation *
                </label>
                <input
                  type="text"
                  required
                  value={memberDesignationInput}
                  onChange={(e) => setMemberDesignationInput(e.target.value)}
                  placeholder="e.g. Accountant, Site Manager, Partner"
                  className="w-full px-3 py-2 text-base sm:text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Team Member</span>
              </button>
            </div>
          </form>

          {/* Team Members List */}
          {teamMembers.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              No team members added yet. Paste a member&apos;s individual user link above and assign their designation.
            </div>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{member.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {member.designation}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 mt-1 truncate">
                      {member.userLink || member.userId}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteTeamMember(member.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                    title="Remove team member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Recurring Transactions Navigation Card */}
          <button
            type="button"
            onClick={() => setShowRecurringPage(true)}
            className="w-full bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Repeat className="w-5 h-5 text-indigo-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Recurring Transactions
              </h2>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {/* Teams Navigation Card */}
          <button
            type="button"
            onClick={() => setShowTeamsPage(true)}
            className="w-full bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Teams
              </h2>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {/* Import / Export Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <button
          type="button"
          onClick={() => toggleSection('importExport')}
          aria-expanded={openSections.importExport}
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Import/export
            </h2>
          </div>
          {openSections.importExport ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {openSections.importExport && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 pt-4 mt-3 border-t border-slate-100">
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
        )}
      </div>

      {/* Categories Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
        {/* Income Categories */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={() => toggleSection('incomeCats')}
            aria-expanded={openSections.incomeCats}
            className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
          >
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Income Categories
            </h3>
            {openSections.incomeCats ? (
              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>

          {openSections.incomeCats && (
          <div className="pt-4 mt-3 border-t border-slate-100">
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
          )}
        </div>

        {/* Expense Categories */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={() => toggleSection('expenseCats')}
            aria-expanded={openSections.expenseCats}
            className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
          >
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Expense Categories
            </h3>
            {openSections.expenseCats ? (
              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>

          {openSections.expenseCats && (
          <div className="pt-4 mt-3 border-t border-slate-100">
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
          )}
        </div>
      </div>

      {/* Data Reset & Maintenance */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200 shadow-xs">
        <button
          type="button"
          onClick={() => toggleSection('maintenance')}
          aria-expanded={openSections.maintenance}
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-rose-900">Data Reset & Maintenance</h3>
          </div>
          {openSections.maintenance ? (
            <ChevronUp className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-rose-400 shrink-0" />
          )}
        </button>

        {openSections.maintenance && (
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100 mt-3">
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

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Reset the app (transactions, projects, categories, and theme) back to its initial default state? This cannot be undone.'
                )
              ) {
                onResetToDefaults();
                showNotification('App reset to initial state');
              }
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Reset</span>
          </button>
        </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};
