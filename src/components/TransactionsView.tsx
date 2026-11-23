import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Trash2,
  Plus,
  Paperclip,
  Tag,
  ArrowUpDown,
  Edit2,
  Copy,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { Project, Transaction, TransactionType } from '../types';
import { formatINR, formatDate, transactionsToCSV } from '../utils/formatters';

interface TransactionsViewProps {
  transactions: Transaction[];
  projects: Project[];
  incomeCategories: string[];
  expenseCategories: string[];
  initialFilter?: { tag?: string; type?: TransactionType };
  onOpenNewTransaction: () => void;
  onEditTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onBatchDeleteTransactions: (ids: string[]) => void;
  onDuplicateTransaction: (t: Transaction) => void;
  onViewAttachment: (attachmentUrl: string, title: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  projects,
  incomeCategories,
  expenseCategories,
  initialFilter,
  onOpenNewTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onBatchDeleteTransactions,
  onDuplicateTransaction,
  onViewAttachment,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(initialFilter?.type || 'all');
  const [tagFilter, setTagFilter] = useState<string>(initialFilter?.tag || 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortField, setSortField] = useState<'slNo' | 'date' | 'amount'>('slNo');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Combined categories for the filter dropdown
  const allCategories = useMemo(() => {
    return Array.from(new Set([...incomeCategories, ...expenseCategories])).sort();
  }, [incomeCategories, expenseCategories]);

  // Filtering Logic
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // Type
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      // Tag
      if (tagFilter !== 'all' && t.tag !== tagFilter) return false;
      // Category
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      // Date Range
      if (fromDate && t.date < fromDate) return false;
      if (toDate && t.date > toDate) return false;
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const inDesc = (t.description || '').toLowerCase().includes(query);
        const inNotes = (t.notes || '').toLowerCase().includes(query);
        const inCat = (t.category || '').toLowerCase().includes(query);
        const inTag = (t.tag || '').toLowerCase().includes(query);
        const inAmount = String(t.amount).includes(query);
        if (!inDesc && !inNotes && !inCat && !inTag && !inAmount) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, tagFilter, categoryFilter, fromDate, toDate, searchTerm]);

  // Sorting Logic
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'slNo') {
        cmp = (a.slNo || 0) - (b.slNo || 0);
      } else if (sortField === 'date') {
        cmp = a.date.localeCompare(b.date);
      } else if (sortField === 'amount') {
        cmp = a.amount - b.amount;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortField, sortAsc]);

  // Totals for filtered records
  const filteredStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of sorted) {
      if (t.type === 'Income') income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }, [sorted]);

  // Handle Select All
  const handleToggleSelectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((t) => t.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (
      window.confirm(
        `Are you sure you want to permanently delete ${selectedIds.size} transaction(s)?`
      )
    ) {
      onBatchDeleteTransactions(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const csvData = transactionsToCSV(sorted);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Personal_Accounting_Export_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset Filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setTagFilter('all');
    setCategoryFilter('all');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Transactions Ledger
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {sorted.length} / {transactions.length} rows
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Replicating the Google Sheet ledger with conditional formatting, attachments & search
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer"
            title="Download CSV matching Google Sheet format"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenNewTransaction}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description, notes, amount..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-700"
            >
              <option value="all">All Types (Income & Expense)</option>
              <option value="Income">Income Only</option>
              <option value="Expense">Expense Only</option>
            </select>
          </div>

          {/* Project Tag Filter */}
          <div>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-700"
            >
              <option value="all">All Project Tags</option>
              {projects.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-700"
            >
              <option value="all">All Categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              title="From date"
              className="w-1/2 px-2 py-2 text-[11px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-700"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              title="To date"
              className="w-1/2 px-2 py-2 text-[11px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-700"
            />
          </div>
        </div>

        {/* Filter Summary & Reset Pill */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          <div className="flex items-center gap-4 text-slate-600">
            <span>
              Inflow:{' '}
              <strong className="text-emerald-700 font-bold">
                {formatINR(filteredStats.income)}
              </strong>
            </span>
            <span>
              Outflow:{' '}
              <strong className="text-rose-700 font-bold">
                {formatINR(filteredStats.expense)}
              </strong>
            </span>
            <span>
              Net:{' '}
              <strong
                className={`font-bold ${
                  filteredStats.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatINR(filteredStats.balance)}
              </strong>
            </span>
          </div>

          {(searchTerm ||
            typeFilter !== 'all' ||
            tagFilter !== 'all' ||
            categoryFilter !== 'all' ||
            fromDate ||
            toDate) && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table: The Google Sheet Replica */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            {/* Table Header matching the 9 Sheet Columns + Actions */}
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="p-3 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAll}
                    className="cursor-pointer text-slate-400 hover:text-slate-700"
                  >
                    {selectedIds.size > 0 && selectedIds.size === sorted.length ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>

                <th
                  onClick={() => {
                    if (sortField === 'slNo') setSortAsc(!sortAsc);
                    else {
                      setSortField('slNo');
                      setSortAsc(true);
                    }
                  }}
                  className="p-3 w-16 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Sl.No</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th
                  onClick={() => {
                    if (sortField === 'date') setSortAsc(!sortAsc);
                    else {
                      setSortField('date');
                      setSortAsc(true);
                    }
                  }}
                  className="p-3 w-28 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th className="p-3 w-24">Type</th>
                <th className="p-3 w-40">Category</th>

                <th
                  onClick={() => {
                    if (sortField === 'amount') setSortAsc(!sortAsc);
                    else {
                      setSortField('amount');
                      setSortAsc(false);
                    }
                  }}
                  className="p-3 w-32 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Amount</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th className="p-3 w-32">Tags (Project)</th>
                <th className="p-3 min-w-[180px]">Description / Remarks</th>
                <th className="p-3 w-24 text-center">Attachments</th>
                <th className="p-3 min-w-[150px]">Notes</th>
                <th className="p-3 w-24 text-center">Actions</th>
              </tr>
            </thead>

            {/* Table Body with Conditional Formatting: Green for Income, Rose for Expense */}
            <tbody className="divide-y divide-slate-200/60 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No transactions match the selected criteria.
                  </td>
                </tr>
              ) : (
                sorted.map((t) => {
                  const isIncome = t.type === 'Income';
                  const isSelected = selectedIds.has(t.id);

                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors border-l-4 ${
                        isIncome
                          ? 'bg-[#edf7ee]/60 hover:bg-[#e2f2e4] border-l-[#34a853]'
                          : 'bg-[#fdf2f2]/60 hover:bg-[#fae4e4] border-l-[#ea4335]'
                      } ${isSelected ? 'ring-2 ring-emerald-500/30' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleSelectOne(t.id)}
                          className="cursor-pointer text-slate-400 hover:text-slate-700"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Sl.No */}
                      <td className="p-3 font-mono text-slate-500 font-bold">
                        {t.slNo}
                      </td>

                      {/* Date */}
                      <td className="p-3 text-slate-700 whitespace-nowrap">
                        {formatDate(t.date)}
                      </td>

                      {/* Income / Expense Badge */}
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isIncome
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="p-3 text-slate-900 font-semibold truncate max-w-[160px]">
                        {t.category}
                      </td>

                      {/* Amount */}
                      <td
                        className={`p-3 text-right font-bold text-sm whitespace-nowrap ${
                          isIncome ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatINR(t.amount)}
                      </td>

                      {/* Project Tag */}
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 border border-slate-300/80 text-[11px] font-bold text-slate-800 shadow-2xs">
                          <Tag className="w-3 h-3 text-indigo-600" />
                          {t.tag}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="p-3 text-slate-800 font-normal">
                        {t.description || '-'}
                      </td>

                      {/* Attachments */}
                      <td className="p-3 text-center">
                        {t.attachments && t.attachments.length > 0 ? (
                          <button
                            onClick={() =>
                              onViewAttachment(
                                t.attachments![0],
                                `${t.description || t.category} Receipt`
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-indigo-600 hover:text-indigo-800 hover:border-indigo-300 font-semibold text-[11px] transition-all cursor-pointer shadow-2xs"
                            title="Click to view attachment"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>{t.attachments.length}</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-center">-</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="p-3 text-slate-500 text-[11px] truncate max-w-[180px]">
                        {t.notes || '-'}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEditTransaction(t)}
                            className="p-1 rounded-lg hover:bg-white text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDuplicateTransaction(t)}
                            className="p-1 rounded-lg hover:bg-white text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteTransaction(t.id)}
                            className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
