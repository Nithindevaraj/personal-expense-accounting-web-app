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
  Filter,
  LayoutList,
  TableProperties,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Project, Transaction, TransactionType } from '../types';
import { formatINR, formatDate, transactionsToCSV } from '../utils/formatters';

interface TransactionsViewProps {
  transactions: Transaction[];
  projects: Project[];
  incomeCategories: string[];
  expenseCategories: string[];
  initialFilter?: { tag?: string; subTag?: string; type?: TransactionType };
  onOpenNewTransaction: () => void;
  onEditTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onBatchDeleteTransactions: (ids: string[]) => void;
  onDuplicateTransaction: (t: Transaction) => void;
  onViewAttachment: (attachments: string[], title: string) => void;
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
  const [tagFilter, setTagFilter] = useState<string>(
    initialFilter?.tag
      ? initialFilter.subTag
        ? `${initialFilter.tag}:::${initialFilter.subTag}`
        : initialFilter.tag
      : 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortField, setSortField] = useState<'slNo' | 'date' | 'amount'>('slNo');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== 'all') count++;
    if (tagFilter !== 'all') count++;
    if (categoryFilter !== 'all') count++;
    if (fromDate) count++;
    if (toDate) count++;
    return count;
  }, [typeFilter, tagFilter, categoryFilter, fromDate, toDate]);

  // Combined categories for the filter dropdown
  const allCategories = useMemo(() => {
    return Array.from(new Set([...incomeCategories, ...expenseCategories])).sort();
  }, [incomeCategories, expenseCategories]);

  // Filtering Logic
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // Type
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      // Tag (supports "Parent" or "Parent:::SubProject")
      if (tagFilter !== 'all') {
        if (tagFilter.includes(':::')) {
          const [parentName, subName] = tagFilter.split(':::');
          if (t.tag !== parentName || t.subTag !== subName) return false;
        } else if (t.tag !== tagFilter) {
          return false;
        }
      }
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
        const inSubTag = (t.subTag || '').toLowerCase().includes(query);
        const inAmount = String(t.amount).includes(query);
        if (!inDesc && !inNotes && !inCat && !inTag && !inSubTag && !inAmount) return false;
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Ledger
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          {/* View Mode Switcher (Cards vs Table) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Cards View (Optimized for Mobile)"
            >
              <LayoutList className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Spreadsheet Table View"
            >
              <TableProperties className="w-3.5 h-3.5 text-blue-600" />
              <span>Table</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedIds.size})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer"
              title="Download CSV matching Google Sheet format"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={onOpenNewTransaction}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Search Row & Mobile Filter Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description, notes, amount..."
              className="w-full pl-9 pr-8 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-800"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              isFiltersOpen || activeFilterCount > 0
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {isFiltersOpen ? (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>
        </div>

        {/* Quick Type Filter Chips (Mobile & Desktop) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Type:
          </span>
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Types
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('Income')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              typeFilter === 'Income'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            Income Only
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('Expense')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              typeFilter === 'Expense'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
            }`}
          >
            Expense Only
          </button>
        </div>

        {/* Detailed Filters (Collapsible on mobile, permanent on desktop) */}
        <div className={`${isFiltersOpen ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100`}>
          {/* Project Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Project
            </label>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-700"
            >
              <option value="all">All Projects</option>
              {projects
                .filter((p) => !p.parentId)
                .map((p) => {
                  const subs = projects.filter((s) => s.parentId === p.id);
                  if (subs.length === 0) {
                    return (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    );
                  }
                  return (
                    <optgroup key={p.id} label={p.name}>
                      <option value={p.name}>{p.name} (All)</option>
                      {subs.map((sub) => (
                        <option key={sub.id} value={`${p.name}:::${sub.name}`}>
                          ↳ {sub.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-700"
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
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Date Range
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                title="From date"
                className="w-1/2 px-2 py-2 text-base sm:text-[11px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-700"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                title="To date"
                className="w-1/2 px-2 py-2 text-base sm:text-[11px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-medium text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Filter Summary & Mobile Rollup Cards */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          {/* 3 Metric Cards for quick totals */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100 text-center">
              <span className="text-[10px] text-emerald-800 font-semibold uppercase tracking-wider block">
                Inflow
              </span>
              <span className="text-xs sm:text-sm font-bold text-emerald-700 truncate block">
                {formatINR(filteredStats.income)}
              </span>
            </div>

            <div className="bg-rose-50/60 p-2 rounded-xl border border-rose-100 text-center">
              <span className="text-[10px] text-rose-800 font-semibold uppercase tracking-wider block">
                Outflow
              </span>
              <span className="text-xs sm:text-sm font-bold text-rose-700 truncate block">
                {formatINR(filteredStats.expense)}
              </span>
            </div>

            <div className={`p-2 rounded-xl border text-center ${
              filteredStats.balance >= 0
                ? 'bg-emerald-50/40 border-emerald-200/80'
                : 'bg-rose-50/40 border-rose-200/80'
            }`}>
              <span className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider block">
                Net Delta
              </span>
              <span className={`text-xs sm:text-sm font-bold truncate block ${
                filteredStats.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {formatINR(filteredStats.balance)}
              </span>
            </div>
          </div>

          {(searchTerm ||
            typeFilter !== 'all' ||
            tagFilter !== 'all' ||
            categoryFilter !== 'all' ||
            fromDate ||
            toDate) && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer py-0.5"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Select All Bar (when in Card View) */}
      {viewMode === 'cards' && sorted.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-600">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 hover:text-slate-900"
          >
            {selectedIds.size > 0 && selectedIds.size === sorted.length ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {selectedIds.size === sorted.length
                ? 'Deselect All'
                : `Select All (${sorted.length})`}
            </span>
          </button>
          {selectedIds.size > 0 && (
            <span className="font-semibold text-emerald-700">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      )}

      {/* 1. Mobile-Optimized Card Presentation */}
      {viewMode === 'cards' && (
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 space-y-3">
              <p className="text-sm">No transactions match your current filters.</p>
              <button
                type="button"
                onClick={onOpenNewTransaction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Record New Transaction</span>
              </button>
            </div>
          ) : (
            sorted.map((t) => {
              const isIncome = t.type === 'Income';
              const isSelected = selectedIds.has(t.id);

              return (
                <div
                  key={t.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    isIncome
                      ? 'bg-gradient-to-r from-emerald-50/70 via-white to-white border-emerald-200/90 shadow-2xs'
                      : 'bg-gradient-to-r from-rose-50/60 via-white to-white border-rose-200/90 shadow-2xs'
                  } ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}
                >
                  {/* Card Top: Checkbox, Sl.No, Date, Type Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectOne(t.id);
                        }}
                        className="p-1 -m-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        aria-label="Select transaction"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                        #{t.slNo}
                      </span>
                      <span className="text-xs text-slate-600 font-medium">
                        {formatDate(t.date)}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        isIncome
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/80'
                          : 'bg-rose-100 text-rose-800 border border-rose-300/80'
                      }`}
                    >
                      {t.type}
                    </span>
                  </div>

                  {/* Card Middle: Project.Job & Amount */}
                  <div
                    className="flex items-start justify-between gap-3 my-1 cursor-pointer"
                    onClick={() => onEditTransaction(t)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 leading-snug break-words">
                        {t.tag}
                      </div>
                      {t.subTag && (
                        <div className="text-xs font-semibold text-indigo-700 leading-snug break-words">
                          {t.subTag}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-xs font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                          {t.category}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-base sm:text-lg font-extrabold tracking-tight ${
                          isIncome ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatINR(t.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Card Description (if any) */}
                  {t.description && (
                    <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200/60 italic line-clamp-2">
                      {t.description}
                    </p>
                  )}

                  {/* Card Footer: Attachments & Actions */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-200/60">
                    <div>
                      {t.attachments && t.attachments.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            onViewAttachment(
                              t.attachments!,
                              `${t.description || t.category} Receipt`
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>
                            {t.attachments.length} Receipt{t.attachments.length > 1 ? 's' : ''}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">No receipt</span>
                      )}
                    </div>

                    {/* Action buttons with touch targets */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditTransaction(t)}
                        className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                        title="Edit entry"
                        aria-label="Edit entry"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDuplicateTransaction(t)}
                        className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                        title="Duplicate entry"
                        aria-label="Duplicate entry"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(t.id)}
                        className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                        title="Delete entry"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. Spreadsheet Table Presentation */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              {/* Table Header matching the 9 Sheet Columns + Actions */}
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="p-3 w-10 text-center">
                    <button
                      type="button"
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

                  <th className="p-3 w-32">Projects</th>
                  <th className="p-3 w-32">Jobs</th>
                  <th className="p-3 min-w-[180px]">Description</th>
                  <th className="p-3 w-24 text-center">Attachments</th>
                  <th className="p-3 min-w-[150px]">Notes</th>
                  <th className="p-3 w-24 text-center">Actions</th>
                </tr>
              </thead>

              {/* Table Body with Conditional Formatting: Green for Income, Rose for Expense */}
              <tbody className="divide-y divide-slate-200/60 font-medium">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      No transactions
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
                            type="button"
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
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 border border-slate-300/80 text-[11px] font-bold text-slate-800 shadow-2xs whitespace-nowrap">
                            <Tag className="w-3 h-3 text-indigo-600" />
                            {t.tag}
                          </span>
                        </td>

                        {/* Sub-project Tag */}
                        <td className="p-3">
                          {t.subTag ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50/90 border border-indigo-200/80 text-[11px] font-semibold text-indigo-800 shadow-2xs whitespace-nowrap">
                              {t.subTag}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Description */}
                        <td className="p-3 text-slate-800 font-normal">
                          {t.description || '-'}
                        </td>

                        {/* Attachments */}
                        <td className="p-3 text-center">
                          {t.attachments && t.attachments.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                onViewAttachment(
                                  t.attachments!,
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
                              type="button"
                              onClick={() => onEditTransaction(t)}
                              className="p-1 rounded-lg hover:bg-white text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDuplicateTransaction(t)}
                              className="p-1 rounded-lg hover:bg-white text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                              title="Duplicate"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
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
      )}
    </div>
  );
};
