import React, { useMemo, useState } from 'react';
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Layers,
  ExternalLink,
  Target,
} from 'lucide-react';
import type { Project, Transaction } from '../types';
import { formatINR } from '../utils/formatters';

interface ProjectsViewProps {
  projects: Project[];
  transactions: Transaction[];
  onAddProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onViewProjectTransactions: (projectName: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  transactions,
  onAddProject,
  onEditProject,
  onDeleteProject,
  onViewProjectTransactions,
}) => {
  // Replicating Google Sheet Cells B2 and C2: "Date Range - From - To"
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [color, setColor] = useState('#3b82f6');

  // Exact Google Sheet SUMIFS formula replication for each project:
  // Income: SUMIFS(Transactions!Amount, Tags=Project, Type="Income", Date >= From, Date <= To)
  // Expense: SUMIFS(Transactions!Amount, Tags=Project, Type="Expense", Date >= From, Date <= To)
  // Balance: Income - Expense
  const calculatedProjects = useMemo(() => {
    return projects.map((p) => {
      let income = 0;
      let expense = 0;
      let txCount = 0;

      for (const t of transactions) {
        if (t.tag === p.name) {
          // Date bounds check (exact replica of B2 / C2 check)
          if (fromDate && t.date < fromDate) continue;
          if (toDate && t.date > toDate) continue;

          txCount++;
          if (t.type === 'Income') {
            income += t.amount;
          } else {
            expense += t.amount;
          }
        }
      }

      const balance = income - expense;
      const margin = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
      const budgetProgress =
        p.budget && p.budget > 0 ? Math.min(100, Math.round((expense / p.budget) * 100)) : 0;

      return {
        ...p,
        income,
        expense,
        balance,
        margin,
        txCount,
        budgetProgress,
      };
    });
  }, [projects, transactions, fromDate, toDate]);

  // Totals across all projects
  const aggregate = useMemo(() => {
    let totInc = 0;
    let totExp = 0;
    for (const cp of calculatedProjects) {
      totInc += cp.income;
      totExp += cp.expense;
    }
    return {
      income: totInc,
      expense: totExp,
      balance: totInc - totExp,
    };
  }, [calculatedProjects]);

  const handleOpenAdd = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setBudget('');
    setColor('#3b82f6');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Project) => {
    setEditingProject(p);
    setName(p.name);
    setDescription(p.description || '');
    setBudget(p.budget ? String(p.budget) : '');
    setColor(p.color || '#3b82f6');
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingProject) {
      onEditProject({
        ...editingProject,
        name: name.trim(),
        description: description.trim(),
        budget: budget ? parseFloat(budget) : undefined,
        color,
      });
    } else {
      onAddProject({
        name: name.trim(),
        description: description.trim(),
        budget: budget ? parseFloat(budget) : undefined,
        color,
      });
    }

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header & Date Range Controls (Matching Sheet Cells A1:C2) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Project Accounting & Cost Centers
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {projects.length} Tagged Projects
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Track income, expenses, and net profit margins across active projects
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Date Range B2 & C2 Filter */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
                Date Range
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  placeholder="From"
                  className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  placeholder="To"
                  className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium"
                />
              </div>
              {(fromDate || toDate) && (
                <button
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 px-1.5 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Add Project CTA */}
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Aggregate Rollup Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                Total Projects Inflow
              </span>
              <span className="text-sm font-bold text-emerald-700">
                {formatINR(aggregate.income)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                Total Projects Outflow
              </span>
              <span className="text-sm font-bold text-rose-700">
                {formatINR(aggregate.expense)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                aggregate.balance >= 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {aggregate.balance >= 0 ? (
                <TrendingUp className="w-4 h-4 stroke-[2.5]" />
              ) : (
                <TrendingDown className="w-4 h-4 stroke-[2.5]" />
              )}
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                Combined Net Balance
              </span>
              <span
                className={`text-sm font-bold ${
                  aggregate.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatINR(aggregate.balance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {calculatedProjects.map((p) => {
          return (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: p.color || '#3b82f6' }}
                    />
                    <h3 className="font-bold text-slate-900 text-base tracking-tight truncate max-w-[150px]">
                      {p.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Edit project"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {projects.length > 1 && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${p.name}"? Transactions with this tag will retain their tag label.`
                            )
                          ) {
                            onDeleteProject(p.id);
                          }
                        }}
                        className="p-1 hover:bg-rose-50 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] mb-4">
                  {p.description || 'No description provided.'}
                </p>

                {/* Financial Metrics */}
                <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Income:</span>
                    <span className="font-bold text-emerald-700">
                      {formatINR(p.income)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Expense:</span>
                    <span className="font-bold text-rose-700">
                      {formatINR(p.expense)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 font-semibold">
                    <span className="text-slate-700">Balance:</span>
                    <span
                      className={`font-bold ${
                        p.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatINR(p.balance)}
                    </span>
                  </div>
                </div>

                {/* Budget Progress (if set) */}
                {p.budget && p.budget > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span className="flex items-center gap-1 font-medium">
                        <Target className="w-3 h-3 text-indigo-500" /> Budget:{' '}
                        {formatINR(p.budget, false)}
                      </span>
                      <span className="font-bold text-slate-700">
                        {p.budgetProgress}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p.budgetProgress > 90 ? 'bg-rose-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${p.budgetProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer: Drill down into ledger */}
              <button
                onClick={() => onViewProjectTransactions(p.name)}
                className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>View {p.txCount} Transactions</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Spreadsheet Master Table (Replicating Projects!A3:D100) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Project Ledger Matrix (Google Sheet Projects Grid)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            SUMIFS(Transactions!$E$2:$E, Transactions!$F$2:$F, $A...)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                <th className="p-3">Project Tags (Col A)</th>
                <th className="p-3 text-right">Total Income (Col B)</th>
                <th className="p-3 text-right">Total Expense (Col C)</th>
                <th className="p-3 text-right">Balance (Col D = B - C)</th>
                <th className="p-3 text-center">Net Margin</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {calculatedProjects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.color || '#3b82f6' }}
                      />
                      <span className="font-bold text-slate-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-emerald-700 font-bold">
                    {formatINR(p.income)}
                  </td>
                  <td className="p-3 text-right text-rose-700 font-bold">
                    {formatINR(p.expense)}
                  </td>
                  <td className="p-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs ${
                        p.balance >= 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {formatINR(p.balance)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-[11px] font-bold ${
                        p.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {p.margin}%
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => onViewProjectTransactions(p.name)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      View Ledger
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Project Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 animate-fade-in">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingProject ? 'Edit Project Tag' : 'Create New Project Tag'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Project tags dynamically link to the Transactions Ledger and calculate P&L.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Project Delta, Marketing, etc."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Purpose or deliverable details"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Budget Allocation (₹ Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Badge Color
                </label>
                <div className="flex items-center gap-2">
                  {[
                    '#3b82f6',
                    '#10b981',
                    '#8b5cf6',
                    '#f59e0b',
                    '#ec4899',
                    '#06b6d4',
                    '#64748b',
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                        color === c ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
