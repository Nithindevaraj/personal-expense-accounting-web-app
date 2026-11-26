import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  FolderPlus,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { isGeneralProject, type Project, type Transaction } from '../types';
import { formatINR } from '../utils/formatters';

interface ProjectsViewProps {
  projects: Project[];
  transactions: Transaction[];
  onAddProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onToggleProjectComplete: (id: string, completed: boolean) => void;
  onViewProjectTransactions: (projectName: string, subProjectName?: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  transactions,
  onAddProject,
  onEditProject,
  onDeleteProject,
  onToggleProjectComplete,
  onViewProjectTransactions,
}) => {
  // Replicating Google Sheet Cells B2 and C2: "Date Range - From - To"
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'active' | 'archive'>('active');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [parentForNewSub, setParentForNewSub] = useState<Project | null>(null);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [budgetPrompt, setBudgetPrompt] = useState<{
    parentBudget: number;
    otherSubTotal: number;
    newSubBudget: number;
    totalSubBudget: number;
    excess: number;
  } | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const topLevelProjects = useMemo(
    () => projects.filter((p) => !p.parentId),
    [projects]
  );

  const activeTopLevelProjects = useMemo(
    () => topLevelProjects.filter((p) => !p.completed),
    [topLevelProjects]
  );

  // Exact Google Sheet SUMIFS formula replication for each project + sub-project roll-up:
  const { calculatedProjects, archivedItems } = useMemo(() => {
    const computeMetrics = (
      proj: Project,
      matcher: (t: Transaction) => boolean
    ) => {
      let income = 0;
      let expense = 0;
      let txCount = 0;

      for (const t of transactions) {
        if (!matcher(t)) continue;
        if (fromDate && t.date < fromDate) continue;
        if (toDate && t.date > toDate) continue;

        txCount++;
        if (t.type === 'Income') {
          income += t.amount;
        } else {
          expense += t.amount;
        }
      }

      const balance = income - expense;
      const margin = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
      const budgetProgress =
        proj.budget && proj.budget > 0
          ? Math.min(100, Math.round((expense / proj.budget) * 100))
          : 0;

      return {
        ...proj,
        income,
        expense,
        balance,
        margin,
        txCount,
        budgetProgress,
      };
    };

    const activeList = activeTopLevelProjects.map((p) => {
      const children = projects.filter((sub) => sub.parentId === p.id && !sub.completed);
      const calculatedSubs = children.map((sub) =>
        computeMetrics(sub, (t) => t.tag === p.name && t.subTag === sub.name)
      );
      // Parent rolls up all transactions tagged to p.name (direct + sub-projects)
      const parentMetrics = computeMetrics(p, (t) => t.tag === p.name);

      return {
        ...parentMetrics,
        subProjects: calculatedSubs,
      };
    });

    const archivedTop = topLevelProjects
      .filter((p) => p.completed)
      .map((p) => {
        const children = projects.filter((sub) => sub.parentId === p.id);
        const calculatedSubs = children.map((sub) =>
          computeMetrics(sub, (t) => t.tag === p.name && t.subTag === sub.name)
        );
        const parentMetrics = computeMetrics(p, (t) => t.tag === p.name);
        return {
          ...parentMetrics,
          parentName: null as string | null,
          subProjects: calculatedSubs,
        };
      });

    const archivedSubs = projects
      .filter((sub) => {
        if (!sub.parentId || !sub.completed) return false;
        const parent = topLevelProjects.find((p) => p.id === sub.parentId);
        return parent && !parent.completed;
      })
      .map((sub) => {
        const parent = topLevelProjects.find((p) => p.id === sub.parentId)!;
        const metrics = computeMetrics(
          sub,
          (t) => t.tag === parent.name && t.subTag === sub.name
        );
        return {
          ...metrics,
          parentName: parent.name as string | null,
          subProjects: [] as ReturnType<typeof computeMetrics>[],
        };
      });

    return {
      calculatedProjects: activeList,
      archivedItems: [...archivedTop, ...archivedSubs].sort(
        (a, b) => (b.completedAt || 0) - (a.completedAt || 0)
      ),
    };
  }, [projects, topLevelProjects, activeTopLevelProjects, transactions, fromDate, toDate]);

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
    setParentForNewSub(null);
    setName('');
    setDescription('');
    setBudget('');
    setColor('#3b82f6');
    setBudgetPrompt(null);
    setBudgetError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenAddSubProject = (parent: Project) => {
    setEditingProject(null);
    setParentForNewSub(parent);
    setName('');
    setDescription('');
    setBudget('');
    setColor(parent.color || '#3b82f6');
    setBudgetPrompt(null);
    setBudgetError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Project) => {
    setEditingProject(p);
    setParentForNewSub(
      p.parentId ? topLevelProjects.find((parent) => parent.id === p.parentId) || null : null
    );
    setName(p.name);
    setDescription(p.description || '');
    setBudget(p.budget ? String(p.budget) : '');
    setColor(p.color || '#3b82f6');
    setBudgetPrompt(null);
    setBudgetError(null);
    setIsAddModalOpen(true);
  };

  const toggleSubProjects = (parentId: string) => {
    setCollapsedParents((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const saveSubOrProject = (parsedBudget: number | undefined) => {
    if (editingProject) {
      onEditProject({
        ...editingProject,
        name: name.trim(),
        description: description.trim(),
        budget: parsedBudget,
        color,
      });
    } else {
      onAddProject({
        parentId: parentForNewSub ? parentForNewSub.id : null,
        name: name.trim(),
        description: description.trim(),
        budget: parsedBudget,
        color,
      });
    }

    setIsAddModalOpen(false);
    setParentForNewSub(null);
    setBudgetPrompt(null);
    setBudgetError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBudgetError(null);

    const parsedBudget = budget ? parseFloat(budget) : undefined;

    if (parentForNewSub) {
      const newSubBudget = parsedBudget && parsedBudget > 0 ? parsedBudget : 0;
      const parentBudget = parentForNewSub.budget || 0;
      const otherSubTotal = projects
        .filter((p) => p.parentId === parentForNewSub.id && p.id !== editingProject?.id)
        .reduce((sum, p) => sum + (p.budget || 0), 0);
      const totalSubBudget = otherSubTotal + newSubBudget;

      if (newSubBudget > 0 && totalSubBudget > parentBudget) {
        setBudgetPrompt({
          parentBudget,
          otherSubTotal,
          newSubBudget,
          totalSubBudget,
          excess: totalSubBudget - parentBudget,
        });
        return;
      }
    } else if (editingProject) {
      const subTotal = projects
        .filter((p) => p.parentId === editingProject.id)
        .reduce((sum, p) => sum + (p.budget || 0), 0);
      const newParentBudget = parsedBudget && parsedBudget > 0 ? parsedBudget : 0;

      if (subTotal > 0 && newParentBudget < subTotal) {
        setBudgetError(
          `Jobs total ${formatINR(subTotal, false)}. Project budget cannot be less than the sum of its jobs.`
        );
        return;
      }
    }

    saveSubOrProject(parsedBudget);
  };

  const handleConfirmBudgetAdjustment = () => {
    if (!parentForNewSub || !budgetPrompt) return;
    const parsedBudget = budget ? parseFloat(budget) : undefined;
    onEditProject({
      ...parentForNewSub,
      budget: budgetPrompt.totalSubBudget,
    });
    saveSubOrProject(parsedBudget);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 animate-fade-in">
      {/* Top Header & Date Range Controls (Matching Sheet Cells A1:C2) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Projects
            </h1>
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('active')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  viewMode === 'active'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Active ({calculatedProjects.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('archive')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  viewMode === 'archive'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive ({archivedItems.length})</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto sm:justify-between lg:justify-end">
            {/* Date Range B2 & C2 Filter */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs w-full sm:w-auto min-w-0">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider px-1 shrink-0">
                Dates
              </span>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  placeholder="From"
                  className="flex-1 min-w-0 w-full sm:w-auto px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium"
                />
                <span className="text-xs text-slate-400 shrink-0">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  placeholder="To"
                  className="flex-1 min-w-0 w-full sm:w-auto px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium"
                />
              </div>
              {(fromDate || toDate) && (
                <button
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 px-1 cursor-pointer shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Add Project CTA */}
            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-sm shadow-indigo-600/30 transition-all cursor-pointer shrink-0 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Aggregate Rollup Summary Banner (Active Projects Only) */}
        {viewMode === 'active' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                Total Projects Inflow
              </span>
              <span className="text-sm font-bold text-emerald-700">
                {formatINR(aggregate.income)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                Total Projects Outflow
              </span>
              <span className="text-sm font-bold text-rose-700">
                {formatINR(aggregate.expense)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
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
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
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
        )}
      </div>

      {viewMode === 'active' ? (
        <>
          {calculatedProjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
              <p className="text-sm font-semibold text-slate-700 mb-1">
                No active projects
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Create a new project or retrieve one from your Archive.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                </button>
                {archivedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setViewMode('archive')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs cursor-pointer"
                  >
                    <Archive className="w-4 h-4" />
                    <span>View Archive ({archivedItems.length})</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Project Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100">
                    {!isGeneralProject(p) && (
                      <label
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-emerald-50 text-[11px] font-semibold text-slate-500 hover:text-emerald-700 cursor-pointer select-none transition-colors"
                        title="Mark completed and move to Archive"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(p.completed)}
                          onChange={(e) => onToggleProjectComplete(p.id, e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                          aria-label={`Mark ${p.name} as completed`}
                        />
                        <span>Done</span>
                      </label>
                    )}
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Edit project"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!isGeneralProject(p) && activeTopLevelProjects.length > 1 && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${p.name}"${p.subProjects.length > 0 ? ` and its ${p.subProjects.length} job(s)` : ''}? All respective transactions will also be deleted.`
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

                {/* Sub-projects Section + Add Sub-project Button */}
                <div className="mt-3.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => p.subProjects.length > 0 && toggleSubProjects(p.id)}
                      className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${
                        p.subProjects.length > 0 ? 'hover:text-slate-800 cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {p.subProjects.length > 0 &&
                        (collapsedParents[p.id] ? (
                          <ChevronRight className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ))}
                      <span>Jobs ({p.subProjects.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenAddSubProject(p)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] transition-colors cursor-pointer"
                      title={`Add job under ${p.name}`}
                    >
                      <FolderPlus className="w-3 h-3" />
                      <span>+ Job</span>
                    </button>
                  </div>

                  {p.subProjects.length > 0 && !collapsedParents[p.id] && (
                    <div className="space-y-2">
                      {p.subProjects.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px]"
                        >
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <button
                              type="button"
                              onClick={() => onViewProjectTransactions(p.name, sub.name)}
                              className="flex items-center gap-1.5 font-bold text-slate-800 hover:text-indigo-700 truncate cursor-pointer text-left"
                              title={`View transactions for ${p.name} / ${sub.name}`}
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: sub.color || p.color || '#3b82f6' }}
                              />
                              <span className="truncate">{sub.name}</span>
                            </button>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(sub)}
                                className="p-1 hover:bg-white rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Edit job"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Delete job "${sub.name}"? All respective transactions under "${sub.name}" will also be deleted.`
                                    )
                                  ) {
                                    onDeleteProject(sub.id);
                                  }
                                }}
                                className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Delete job"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>
                              In: <strong className="text-emerald-700">{formatINR(sub.income, false)}</strong>
                            </span>
                            <span>
                              Out: <strong className="text-rose-700">{formatINR(sub.expense, false)}</strong>
                            </span>
                            <span>{sub.txCount} tx</span>
                          </div>

                          {sub.budget && sub.budget > 0 && (
                            <div className="mt-1.5">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                                <span>Budget: {formatINR(sub.budget, false)}</span>
                                <span className="font-bold text-slate-700">{sub.budgetProgress}%</span>
                              </div>
                              <div className="w-full h-1 bg-slate-200/80 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    sub.budgetProgress > 90 ? 'bg-rose-500' : 'bg-indigo-500'
                                  }`}
                                  style={{ width: `${sub.budgetProgress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
              Project Ledger Matrix
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                <th className="p-3">Project</th>
                <th className="p-3 text-right">Total Income</th>
                <th className="p-3 text-right">Total Expense</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3 text-center">Net Margin</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {calculatedProjects.map((p) => (
                <React.Fragment key={p.id}>
                  <tr className="hover:bg-slate-50/80 transition-colors">
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
                  {p.subProjects.map((sub) => (
                    <tr key={sub.id} className="bg-slate-50/40 hover:bg-slate-50 transition-colors">
                      <td className="p-3 pl-7">
                        <div className="flex items-center gap-2">
                          <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: sub.color || p.color || '#3b82f6' }}
                          />
                          <span className="font-semibold text-slate-700">{sub.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right text-emerald-600 font-semibold">
                        {formatINR(sub.income)}
                      </td>
                      <td className="p-3 text-right text-rose-600 font-semibold">
                        {formatINR(sub.expense)}
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-semibold text-xs ${
                            sub.balance >= 0
                              ? 'bg-emerald-50/80 text-emerald-700'
                              : 'bg-rose-50/80 text-rose-700'
                          }`}
                        >
                          {formatINR(sub.balance)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[11px] font-semibold ${
                            sub.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {sub.margin}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onViewProjectTransactions(p.name, sub.name)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          View Ledger
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
            </>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                Archived projects are excluded from Dashboard, Analytics, and Transaction selectors. Uncheck or click <strong>Retrieve</strong> to restore a project to active use.
              </span>
            </div>
          </div>

          {archivedItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
              <Archive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 mb-1">
                No archived projects
              </p>
              <p className="text-xs text-slate-500">
                Mark any active project as completed using its checkbox to move it here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {archivedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 opacity-75"
                          style={{ backgroundColor: item.color || '#3b82f6' }}
                        />
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-800 text-base tracking-tight truncate">
                            {item.name}
                          </h3>
                          {item.parentName && (
                            <span className="text-[10px] font-semibold text-slate-500">
                              Job of {item.parentName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <label
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 cursor-pointer select-none"
                          title="Uncheck to retrieve project"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(item.completed)}
                            onChange={(e) =>
                              onToggleProjectComplete(item.id, e.target.checked)
                            }
                            className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                            aria-label={`Completed status for ${item.name}`}
                          />
                          <span>Done</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Permanently delete archived project "${item.name}"? Existing transactions will retain their tag label.`
                              )
                            ) {
                              onDeleteProject(item.id);
                            }
                          }}
                          className="p-1 hover:bg-rose-50 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete archived project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] mb-3">
                      {item.description || 'No description provided.'}
                    </p>

                    {item.completedAt && (
                      <p className="text-[11px] text-slate-400 font-medium mb-3">
                        Completed on{' '}
                        {new Date(item.completedAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}

                    <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Income:</span>
                        <span className="font-bold text-emerald-700">
                          {formatINR(item.income)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Expense:</span>
                        <span className="font-bold text-rose-700">
                          {formatINR(item.expense)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60 font-semibold">
                        <span className="text-slate-700">Final Balance:</span>
                        <span
                          className={`font-bold ${
                            item.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatINR(item.balance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleProjectComplete(item.id, false)}
                      className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retrieve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        item.parentName
                          ? onViewProjectTransactions(item.parentName, item.name)
                          : onViewProjectTransactions(item.name)
                      }
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="View historical transactions"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Project Modal (Portaled to document.body to avoid ancestor transform containing blocks) */}
      {isAddModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 pb-20 sm:pb-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 sm:p-6 animate-fade-in max-h-[85dvh] overflow-y-auto">
            <h3 className={`text-base sm:text-lg font-bold text-slate-900 ${parentForNewSub ? 'mb-1' : 'mb-4'}`}>
              {editingProject
                ? parentForNewSub
                  ? 'Edit Job'
                  : 'Edit Project'
                : parentForNewSub
                  ? 'Create Job'
                  : 'Create New Project'}
            </h3>
            {parentForNewSub && (
              <p className="text-xs text-slate-500 mb-4">
                Under parent project{' '}
                <span className="font-bold text-slate-800">{parentForNewSub.name}</span>
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {parentForNewSub ? 'Job Name *' : 'Project Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Project Delta, Marketing, etc."
                  className="w-full px-3 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
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
                  className="w-full px-3 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Budget (₹ Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={budget}
                  onChange={(e) => {
                    setBudget(e.target.value);
                    setBudgetPrompt(null);
                    setBudgetError(null);
                  }}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
                {parentForNewSub && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Project budget: {formatINR(parentForNewSub.budget || 0, false)} · Allocated to other jobs:{' '}
                    {formatINR(
                      projects
                        .filter((p) => p.parentId === parentForNewSub.id && p.id !== editingProject?.id)
                        .reduce((sum, p) => sum + (p.budget || 0), 0),
                      false
                    )}
                  </p>
                )}
                {budgetError && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2">
                    {budgetError}
                  </p>
                )}
                {budgetPrompt && parentForNewSub && (
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Job budgets total{' '}
                      <span className="font-bold">{formatINR(budgetPrompt.totalSubBudget, false)}</span>, which exceeds{' '}
                      <span className="font-bold">{parentForNewSub.name}</span>&apos;s budget (
                      {formatINR(budgetPrompt.parentBudget, false)}) by{' '}
                      <span className="font-bold">{formatINR(budgetPrompt.excess, false)}</span>. Add{' '}
                      <span className="font-bold">{formatINR(budgetPrompt.excess, false)}</span> adjustment to the
                      project budget?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setBudgetPrompt(null)}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmBudgetAdjustment}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        Add {formatINR(budgetPrompt.excess, false)} & Save
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Badge Color
                </label>
                <div className="flex items-center gap-2.5 flex-wrap">
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
                      className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full transition-transform cursor-pointer ${
                        color === c ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 pb-2 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {editingProject
                    ? 'Save Changes'
                    : parentForNewSub
                      ? 'Create Job'
                      : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
