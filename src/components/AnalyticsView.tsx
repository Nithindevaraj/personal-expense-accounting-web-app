import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Layers,
  Award,
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

interface AnalyticsViewProps {
  transactions: Transaction[];
  projects: Project[];
}

const PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#84cc16',
];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ transactions, projects }) => {
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Available Years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const t of transactions) {
      if (t.date) years.add(t.date.substring(0, 4));
    }
    return Array.from(years).sort().reverse();
  }, [transactions]);

  // Filtered by year
  const yearFiltered = useMemo(() => {
    if (selectedYear === 'all') return transactions;
    return transactions.filter((t) => t.date.startsWith(selectedYear));
  }, [transactions, selectedYear]);

  // Monthly Cashflow data
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; Income: number; Expense: number; Net: number }>();
    const sorted = [...yearFiltered].sort((a, b) => a.date.localeCompare(b.date));

    for (const t of sorted) {
      if (!t.date) continue;
      const key = t.date.substring(0, 7);
      if (!map.has(key)) {
        const [y, m] = key.split('-');
        const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        map.set(key, {
          month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
          Income: 0,
          Expense: 0,
          Net: 0,
        });
      }
      const entry = map.get(key)!;
      if (t.type === 'Income') entry.Income += t.amount;
      else entry.Expense += t.amount;
      entry.Net = entry.Income - entry.Expense;
    }

    return Array.from(map.values());
  }, [yearFiltered]);

  // Expense Categories Breakdown
  const expenseCatData = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const t of yearFiltered) {
      if (t.type === 'Expense') {
        map.set(t.category, (map.get(t.category) || 0) + t.amount);
        total += t.amount;
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [yearFiltered]);

  // Income Sources Breakdown
  const incomeCatData = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const t of yearFiltered) {
      if (t.type === 'Income') {
        map.set(t.category, (map.get(t.category) || 0) + t.amount);
        total += t.amount;
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [yearFiltered]);

  // Project P&L Comparison Data for BarChart (rolled up to top-level projects)
  const projectComparisonData = useMemo(() => {
    return projects
      .filter((p) => !p.parentId)
      .map((p) => {
      let inc = 0;
      let exp = 0;
      for (const t of yearFiltered) {
        if (t.tag === p.name) {
          if (t.type === 'Income') inc += t.amount;
          else exp += t.amount;
        }
      }
      return {
        name: p.name,
        Income: inc,
        Expense: exp,
        Net: inc - exp,
      };
    });
  }, [projects, yearFiltered]);

  // Top 5 Largest Transactions
  const topTransactions = useMemo(() => {
    return [...yearFiltered]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [yearFiltered]);

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 animate-fade-in">
      {/* Analytics Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Cashflow Intelligence & Metrics
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Multi-period financial velocity, category distributions, and project efficiency
          </p>
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto justify-between sm:justify-start">
          <span className="text-xs font-semibold text-slate-500">Year:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-base sm:text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-hidden"
          >
            <option value="all">All Available History</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Monthly Cashflow & Net Margin Progression */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Net Surplus & Monthly Trajectory
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Comparative visualization of Inflow vs Outflow with Net Cashflow delta
            </p>
          </div>
        </div>

        <div className="h-60 sm:h-80 w-full">
          {monthlyData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              No historical data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  width={38}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  formatter={(val: any) => [formatINR(Number(val) || 0), '']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '0.75rem',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Two Column: Expense Distribution & Income Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Expense Category Breakdown */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <PieIcon className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Expense Category Distribution
              </h2>
            </div>

            <div className="h-52 sm:h-60 w-full">
              {expenseCatData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  No expenses recorded
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCatData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {expenseCatData.map((_, i) => (
                        <Cell key={`exp-${i}`} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatINR(Number(val) || 0), 'Spent']}
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

            {/* Category Percentages Progress List */}
            <div className="space-y-2 mt-2 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto no-scrollbar">
              {expenseCatData.map((item, idx) => (
                <div key={item.name} className="text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-700 truncate max-w-[140px] sm:max-w-[200px]">
                      {item.name}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatINR(item.value)} ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: PALETTE[idx % PALETTE.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Income Sources Breakdown */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Revenue & Inflow Streams
              </h2>
            </div>

            <div className="h-52 sm:h-60 w-full">
              {incomeCatData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  No income entries recorded
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeCatData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {incomeCatData.map((_, i) => (
                        <Cell key={`inc-${i}`} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatINR(Number(val) || 0), 'Earned']}
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

            {/* Income Streams List */}
            <div className="space-y-2 mt-2 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto no-scrollbar">
              {incomeCatData.map((item, idx) => (
                <div key={item.name} className="text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-700 truncate max-w-[140px] sm:max-w-[200px]">
                      {item.name}
                    </span>
                    <span className="font-bold text-emerald-700">
                      {formatINR(item.value)} ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: PALETTE[idx % PALETTE.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Project Profitability Comparison & High Value Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Project Comparison Bar Chart */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Project Net P&L Breakdown
            </h2>
          </div>

          <div className="h-60 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={projectComparisonData}
                layout="vertical"
                margin={{ top: 10, right: 15, left: 10, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                <Tooltip
                  formatter={(val: any) => [formatINR(Number(val) || 0), '']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '0.75rem',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Income" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Expense" fill="#f43f5e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Largest Transactions Leaderboard */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Highest-Value Transactions
            </h2>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {topTransactions.map((t, idx) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate max-w-[120px] xs:max-w-[180px] sm:max-w-[200px]">
                      {t.description || t.category}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 block truncate">
                      {formatDate(t.date)} • {t.tag}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-xs sm:text-sm font-bold block ${
                      t.type === 'Income' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {t.type === 'Income' ? '+' : '-'}
                    {formatINR(t.amount)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {t.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
