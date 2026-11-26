import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  FolderKanban,
  Receipt,
  PieChart as PieIcon,
  BarChart2,
  ExternalLink,
} from 'lucide-react';
import type { Project, Transaction } from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardViewProps {
  transactions: Transaction[];
  projects: Project[];
  onOpenNewTransaction: () => void;
  onNavigateToTransactions: (filter?: { tag?: string; type?: 'Income' | 'Expense' }) => void;
  onNavigateToProjects: (projectId?: string) => void;
  onEditTransaction: (t: Transaction) => void;
}

const CATEGORY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#84cc16',
  '#e11d48', '#64748b'
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  projects,
  onNavigateToTransactions,
  onNavigateToProjects,
  onEditTransaction,
}) => {
  const [timeRange, setTimeRange] = useState<'all' | 'this_year' | 'this_month' | 'last_30_days'>('all');

  // Filtered transactions based on selected range
  const filteredTransactions = useMemo(() => {
    if (timeRange === 'all') return transactions;

    const now = new Date();
    if (timeRange === 'this_year') {
      const currentYear = String(now.getFullYear());
      return transactions.filter((t) => t.date.startsWith(currentYear));
    }

    if (timeRange === 'this_month') {
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `${currentYear}-${currentMonth}`;
      return transactions.filter((t) => t.date.startsWith(prefix));
    }

    if (timeRange === 'last_30_days') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      return transactions.filter((t) => t.date >= cutoffStr);
    }

    return transactions;
  }, [transactions, timeRange]);

  // Aggregate Key Metrics
  const metrics = useMemo(() => {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const t of filteredTransactions) {
      if (t.type === 'Income') {
        income += t.amount;
        incomeCount++;
      } else {
        expense += t.amount;
        expenseCount++;
      }
    }

    const net = income - expense;
    const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

    return {
      income,
      expense,
      net,
      incomeCount,
      expenseCount,
      savingsRate,
    };
  }, [filteredTransactions]);

  // Monthly Trend Data for Chart
  const monthlyTrendData = useMemo(() => {
    const map = new Map<string, { month: string; Income: number; Expense: number }>();

    // Sort by date ascending
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

    for (const t of sorted) {
      if (!t.date) continue;
      const key = t.date.substring(0, 7); // YYYY-MM
      if (!map.has(key)) {
        const [year, month] = key.split('-');
        const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        const label = dateObj.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        map.set(key, { month: label, Income: 0, Expense: 0 });
      }

      const entry = map.get(key)!;
      if (t.type === 'Income') {
        entry.Income += t.amount;
      } else {
        entry.Expense += t.amount;
      }
    }

    return Array.from(map.values()).slice(-6); // last 6 active months
  }, [transactions]);

  // Expense by Category Data
  const expenseByCategoryData = useMemo(() => {
    const map = new Map<string, number>();

    for (const t of filteredTransactions) {
      if (t.type === 'Expense') {
        map.set(t.category, (map.get(t.category) || 0) + t.amount);
      }
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // Project P&L Summary (mirroring Projects sheet formula, rolled up to top-level projects)
  const projectSummaries = useMemo(() => {
    return projects
      .filter((p) => !p.parentId)
      .map((p) => {
      let pIncome = 0;
      let pExpense = 0;
      let count = 0;

      for (const t of filteredTransactions) {
        if (t.tag === p.name) {
          count++;
          if (t.type === 'Income') pIncome += t.amount;
          else pExpense += t.amount;
        }
      }

      return {
        ...p,
        income: pIncome,
        expense: pExpense,
        balance: pIncome - pExpense,
        txCount: count,
      };
    });
  }, [projects, filteredTransactions]);

  // Recent 6 transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      .slice(0, 6);
  }, [transactions]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner / Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Dashboard
          </h1>
        </div>

        {/* Range Buttons (Smooth horizontal scroll on mobile) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar w-full sm:w-auto">
          <button
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              timeRange === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setTimeRange('this_year')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              timeRange === 'this_year'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Year
          </button>
          <button
            onClick={() => setTimeRange('this_month')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              timeRange === 'this_month'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setTimeRange('last_30_days')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              timeRange === 'last_30_days'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* 4 Hero Metric Cards (2x2 Grid on Mobile for high visual density) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Income */}
        <div
          onClick={() => onNavigateToTransactions({ type: 'Income' })}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-emerald-100 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 truncate">
                Inflow
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <ArrowDownRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 truncate">
              {formatINR(metrics.income)}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50 text-[10px] sm:text-xs text-slate-500">
            <span className="truncate">{metrics.incomeCount} credits</span>
            <span className="text-emerald-600 font-semibold flex items-center gap-0.5 shrink-0">
              View <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </span>
          </div>
        </div>

        {/* Total Expense */}
        <div
          onClick={() => onNavigateToTransactions({ type: 'Expense' })}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-rose-100 shadow-xs hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60 truncate">
                Outflow
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 truncate">
              {formatINR(metrics.expense)}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50 text-[10px] sm:text-xs text-slate-500">
            <span className="truncate">{metrics.expenseCount} debits</span>
            <span className="text-rose-600 font-semibold flex items-center gap-0.5 shrink-0">
              View <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </span>
          </div>
        </div>

        {/* Net Balance */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 truncate">
                Net Capital
              </span>
              <div
                className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  metrics.net >= 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {metrics.net >= 0 ? (
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                ) : (
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                )}
              </div>
            </div>
            <div
              className={`text-base sm:text-2xl font-bold truncate ${
                metrics.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatINR(metrics.net)}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50 text-[10px] sm:text-xs text-slate-500">
            <span className="truncate">
              {metrics.net >= 0 ? 'Surplus' : 'Deficit'}
            </span>
            <span
              className={`font-semibold shrink-0 ${
                metrics.savingsRate >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {metrics.savingsRate}%
            </span>
          </div>
        </div>

        {/* Active Projects Hub */}
        <div
          onClick={() => onNavigateToProjects()}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-indigo-100 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60 truncate">
                Projects
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <FolderKanban className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2]" />
              </div>
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 truncate">
              {projects.length} Active
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50 text-[10px] sm:text-xs text-slate-500">
            <span className="truncate">Cost Centers</span>
            <span className="text-indigo-600 font-semibold flex items-center gap-0.5 shrink-0">
              Explore <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Charts Section: Monthly Trend & Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Monthly Income vs Expense Bar Chart */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Monthly Cashflow Progression
              </h2>
            </div>
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">Inflow vs Outflow</span>
          </div>

          <div className="h-60 sm:h-72 w-full">
            {monthlyTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No monthly transactions recorded yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    width={38}
                    tickFormatter={(val) => `₹${val / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatINR(Number(value) || 0), '']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '0.75rem',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expense Category Donut Chart */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Expense Categories
              </h2>
            </div>
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">Breakdown</span>
          </div>

          <div className="h-48 sm:h-52 w-full">
            {expenseByCategoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No expense entries to visualize
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategoryData.slice(0, 7)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseByCategoryData.slice(0, 7).map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [formatINR(Number(value) || 0), 'Amount']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '0.75rem',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top 4 Categories List */}
          <div className="mt-auto space-y-2 pt-2 border-t border-slate-100">
            {expenseByCategoryData.slice(0, 4).map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                  />
                  <span className="text-slate-700 font-medium truncate max-w-[140px]">
                    {item.name}
                  </span>
                </div>
                <span className="font-semibold text-slate-900">
                  {formatINR(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Project Cost-Center & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Projects / Cost Center Quick Table */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Project Accounting Summary
                </h2>
              </div>
              <button
                onClick={() => onNavigateToProjects()}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                View All <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs min-w-[280px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="pb-2">Project</th>
                    <th className="pb-2 text-right">Income</th>
                    <th className="pb-2 text-right">Expense</th>
                    <th className="pb-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium">
                  {projectSummaries.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => onNavigateToTransactions({ tag: p.name })}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.color || '#3b82f6' }}
                          />
                          <span className="font-semibold text-slate-800 truncate max-w-[100px] sm:max-w-none">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-emerald-700 font-semibold">
                        {formatINR(p.income)}
                      </td>
                      <td className="py-2.5 text-right text-rose-700 font-semibold">
                        {formatINR(p.expense)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            p.balance >= 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {formatINR(p.balance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Recent Entries
                </h2>
              </div>
              <button
                onClick={() => onNavigateToTransactions()}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                View Full Ledger <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {recentTransactions.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onEditTransaction(t)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    t.type === 'Income'
                      ? 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-300'
                      : 'bg-rose-50/40 border-rose-100 hover:border-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        t.type === 'Income'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {t.type === 'Income' ? (
                        <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[260px]">
                        {t.tag}
                      </div>
                      {t.subTag && (
                        <div className="text-[11px] font-semibold text-indigo-700 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[260px]">
                          {t.subTag}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500">
                        <span>{formatDate(t.date)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs sm:text-sm font-bold ${
                        t.type === 'Income' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {t.type === 'Income' ? '+' : '-'}
                      {formatINR(t.amount)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {t.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-between mt-3">
            <span className="text-[11px] sm:text-xs text-slate-400">
              Showing last {recentTransactions.length} of {transactions.length} entries
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
