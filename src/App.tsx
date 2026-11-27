import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import type {
  Account,
  Project,
  RecurringTransaction,
  TeamMember,
  Transaction,
  TransactionType,
} from './types';
import {
  DEFAULT_ACCOUNT_ID,
  DEFAULT_ACCOUNTS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  createDefaultProjectsForAccount,
  isGeneralProject,
} from './types';
import {
  type UserProfile,
  getActiveAccountId,
  getOrCreateLocalUserId,
  getStoredAccounts,
  getStoredExpenseCategories,
  getStoredIncomeCategories,
  getStoredProjects,
  getStoredRecurringTransactions,
  getStoredTeamMembers,
  getStoredTransactions,
  getUserProfile,
  saveActiveAccountId,
  saveStoredAccounts,
  saveStoredExpenseCategories,
  saveStoredIncomeCategories,
  saveStoredProjects,
  saveStoredRecurringTransactions,
  saveStoredTeamMembers,
  saveStoredTransactions,
  saveUserProfile,
} from './utils/storage';
import { canModifyTransaction } from './utils/projectPermissions';
import { Navbar, type ActiveTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { ProjectsView } from './components/ProjectsView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { TransactionModal } from './components/TransactionModal';
import { AttachmentViewerModal } from './components/AttachmentViewerModal';
import { ProfileModal } from './components/ProfileModal';
import { InstallModal } from './components/InstallModal';
import { InstallBanner } from './components/InstallBanner';
import { useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  batchDeleteExpenses,
  markTxInFlight,
  clearTxInFlight,
} from './services/expenseService';
import {
  getProjectsFromSupabase,
  upsertProjectToSupabase,
  deleteProjectFromSupabase,
} from './services/projectService';
import {
  getAccountsFromSupabase,
  getCategoriesFromSupabase,
  getRecurringFromSupabase,
  getTeamMembersFromSupabase,
  saveAccountsToSupabase,
  saveCategoriesToSupabase,
  saveRecurringToSupabase,
  saveTeamMembersToSupabase,
} from './services/userSettingsService';

export const App: React.FC = () => {
  const { user, isLoading: isAuthLoading, offlineDemoMode } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Global State
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (
        tab &&
        ['dashboard', 'transactions', 'projects', 'analytics', 'settings'].includes(tab)
      ) {
        return tab as ActiveTab;
      }
    } catch {
      // ignore
    }
    return 'dashboard';
  });
  const [accounts, setAccounts] = useState<Account[]>(getStoredAccounts);
  const [activeAccountId, setActiveAccountId] = useState<string>(getActiveAccountId);
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    getStoredTransactions(getActiveAccountId())
  );
  const [projects, setProjects] = useState<Project[]>(() =>
    getStoredProjects(getActiveAccountId())
  );

  const activeProjects = useMemo(() => {
    const archivedParentIds = new Set(
      projects.filter((p) => !p.parentId && p.completed).map((p) => p.id)
    );
    return projects.filter(
      (p) => !p.completed && (!p.parentId || !archivedParentIds.has(p.parentId))
    );
  }, [projects]);

  const activeTransactions = useMemo(() => {
    const archivedParentNames = new Set(
      projects.filter((p) => !p.parentId && p.completed).map((p) => p.name)
    );
    const parentById = new Map(projects.map((p) => [p.id, p]));
    const archivedJobKeys = new Set(
      projects
        .filter((p) => p.parentId && p.completed)
        .map((sub) => {
          const parent = sub.parentId ? parentById.get(sub.parentId) : undefined;
          return parent ? `${parent.name}:::${sub.name}` : '';
        })
        .filter(Boolean)
    );
    if (archivedParentNames.size === 0 && archivedJobKeys.size === 0) {
      return transactions;
    }
    return transactions.filter((t) => {
      if (archivedParentNames.has(t.tag)) return false;
      if (t.subTag && archivedJobKeys.has(`${t.tag}:::${t.subTag}`)) return false;
      return true;
    });
  }, [transactions, projects]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>(getStoredIncomeCategories);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(getStoredExpenseCategories);
  const [userProfile, setUserProfile] = useState<UserProfile>(getUserProfile);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>(
    getStoredRecurringTransactions
  );
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(getStoredTeamMembers);
  const processingRecurringRef = useRef(false);

  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('action') === 'new-tx';
    } catch {
      return false;
    }
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [txLedgerFilter, setTxLedgerFilter] = useState<{
    tag?: string;
    subTag?: string;
    type?: TransactionType;
  }>({});

  const [attachmentModal, setAttachmentModal] = useState<{
    isOpen: boolean;
    attachments: string[];
    title: string;
  }>({
    isOpen: false,
    attachments: [],
    title: '',
  });

  // Calculate high-level aggregates
  const { totalIncome, totalExpense, netBalance } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const t of transactions) {
      if (t.type === 'Income') inc += t.amount;
      else exp += t.amount;
    }
    return {
      totalIncome: inc,
      totalExpense: exp,
      netBalance: inc - exp,
    };
  }, [transactions]);

  // Next Sl.No
  const nextSlNo = useMemo(() => {
    if (transactions.length === 0) return 1;
    const maxSl = Math.max(...transactions.map((t) => t.slNo || 0));
    return maxSl + 1;
  }, [transactions]);

  // Keyboard shortcut: Press 'N' to open Add Transaction modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'n' || e.key === 'N') &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) &&
        !isTxModalOpen
      ) {
        e.preventDefault();
        setEditingTransaction(null);
        setIsTxModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTxModalOpen]);

  // Fetch user expenses & projects from Supabase when authenticated, plus Realtime & tab-focus sync
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const syncFromCloud = (showLoader = false) => {
      if (showLoader) setIsDataLoading(true);
      Promise.all([
        getExpenses(activeAccountId),
        getProjectsFromSupabase(activeAccountId),
        getCategoriesFromSupabase(),
        getAccountsFromSupabase(),
        getRecurringFromSupabase(),
        getTeamMembersFromSupabase(),
      ])
        .then(
          ([
            fetchedTx,
            fetchedProjects,
            fetchedCats,
            fetchedAccounts,
            fetchedRecurring,
            fetchedTeamMembers,
          ]) => {
            if (!isMounted) return;
            setTransactions(fetchedTx);
            setProjects(fetchedProjects);
            setIncomeCategories(fetchedCats.incomeCategories);
            setExpenseCategories(fetchedCats.expenseCategories);
            setAccounts(fetchedAccounts);
            setRecurringTransactions(fetchedRecurring);
            setTeamMembers(fetchedTeamMembers);
          }
        )
        .catch((err) => {
          console.error('Error syncing data from Supabase:', err);
        })
        .finally(() => {
          if (showLoader && isMounted) setIsDataLoading(false);
        });
    };

    syncFromCloud(true);

    // Synchronize user profile display with Google metadata
    setUserProfile((prev) => ({
      ...prev,
      name: user.user_metadata?.full_name || prev.name,
      email: user.email || prev.email,
      avatar: user.user_metadata?.avatar_url || prev.avatar,
    }));

    // Re-sync when user switches back to this tab or app window
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncFromCloud(false);
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Subscribe to Supabase Realtime changes for cross-device updates
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel(`sync-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'expenses',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            getExpenses(activeAccountId)
              .then((fetched) => {
                if (isMounted) setTransactions(fetched);
              })
              .catch(() => {});
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            getProjectsFromSupabase(activeAccountId)
              .then((fetched) => {
                if (isMounted) setProjects(fetched);
              })
              .catch(() => {});
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_settings',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            Promise.all([
              getCategoriesFromSupabase(),
              getAccountsFromSupabase(),
              getRecurringFromSupabase(),
              getTeamMembersFromSupabase(),
            ])
              .then(([fetchedCats, fetchedAccounts, fetchedRecurring, fetchedTeamMembers]) => {
                if (!isMounted) return;
                setIncomeCategories(fetchedCats.incomeCategories);
                setExpenseCategories(fetchedCats.expenseCategories);
                setAccounts(fetchedAccounts);
                setRecurringTransactions(fetchedRecurring);
                setTeamMembers(fetchedTeamMembers);
              })
              .catch(() => {});
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, activeAccountId]);

  // Transaction Handlers (Optimistic UI + Background Supabase Sync)
  const handleSaveTransaction = async (
    txData: Omit<Transaction, 'id' | 'createdAt'>,
    editingId?: string
  ) => {
    if (editingId) {
      // 1. Optimistic UI update
      const updated = transactions.map((t) =>
        t.id === editingId
          ? {
              ...t,
              ...txData,
            }
          : t
      );
      setTransactions(updated);
      saveStoredTransactions(updated, activeAccountId);

      // 2. Persist to Supabase
      try {
        await updateExpense(editingId, txData);
      } catch (err) {
        console.error('Error updating expense in Supabase:', err);
      }
    } else {
      // 1. Optimistic UI insert with temporary ID
      const tempId = `tx-temp-${Date.now()}`;
      const currentUserId = user?.id || getOrCreateLocalUserId();
      const tempTx: Transaction = {
        ...txData,
        id: tempId,
        createdByUserId: currentUserId,
        createdAt: Date.now(),
      };
      markTxInFlight(tempId);
      const updated = [tempTx, ...transactions];
      setTransactions(updated);
      saveStoredTransactions(updated, activeAccountId);

      // 2. Persist to Supabase and replace tempId with persistent UUID
      try {
        const savedTx = await addExpense(txData, activeAccountId);
        setTransactions((prev) => {
          const withoutDup = prev.filter((t) => t.id !== savedTx.id);
          const hasTemp = withoutDup.some((t) => t.id === tempId);
          const next = hasTemp
            ? withoutDup.map((t) => (t.id === tempId ? savedTx : t))
            : [savedTx, ...withoutDup];
          saveStoredTransactions(next, activeAccountId);
          return next;
        });
      } catch (err) {
        console.error('Error adding expense to Supabase:', err);
      } finally {
        clearTxInFlight(tempId);
      }
    }
  };

  const currentUserId = user?.id || getOrCreateLocalUserId();

  const handleDeleteTransaction = async (id: string) => {
    const target = transactions.find((t) => t.id === id);
    if (target && !canModifyTransaction(target, projects, currentUserId)) return;

    // 1. Optimistic UI update
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    saveStoredTransactions(updated, activeAccountId);

    // 2. Persist to Supabase
    try {
      await deleteExpense(id);
    } catch (err) {
      console.error('Error deleting expense from Supabase:', err);
    }
  };

  const handleBatchDeleteTransactions = async (ids: string[]) => {
    const allowedIds = ids.filter((id) => {
      const target = transactions.find((t) => t.id === id);
      return !target || canModifyTransaction(target, projects, currentUserId);
    });
    if (allowedIds.length === 0) return;

    // 1. Optimistic UI update
    const idSet = new Set(allowedIds);
    const updated = transactions.filter((t) => !idSet.has(t.id));
    setTransactions(updated);
    saveStoredTransactions(updated, activeAccountId);

    // 2. Persist to Supabase
    try {
      await batchDeleteExpenses(allowedIds);
    } catch (err) {
      console.error('Error batch deleting expenses from Supabase:', err);
    }
  };

  const handleDuplicateTransaction = async (t: Transaction) => {
    const dupTx: Omit<Transaction, 'id' | 'createdAt'> = {
      ...t,
      slNo: nextSlNo,
      description: `${t.description} (Copy)`,
    };
    await handleSaveTransaction(dupTx);
  };

  // Project Handlers
  const handleAddProject = (projectData: Omit<Project, 'id' | 'createdAt'>) => {
    const newProj: Project = {
      ...projectData,
      ownerId: projectData.ownerId || currentUserId,
      id: `proj-${Date.now()}`,
      createdAt: Date.now(),
    };
    setProjects((prev) => {
      const updated = [...prev, newProj];
      saveStoredProjects(updated, activeAccountId);
      return updated;
    });
    void upsertProjectToSupabase(newProj, activeAccountId);
  };

  const handleEditProject = (project: Project) => {
    setProjects((prev) => {
      const updated = prev.map((p) => (p.id === project.id ? project : p));
      saveStoredProjects(updated, activeAccountId);
      return updated;
    });
    void upsertProjectToSupabase(project, activeAccountId);
  };

  const handleDeleteProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    if (target && isGeneralProject(target)) return;
    if (target) {
      const parentProject = target.parentId
        ? projects.find((p) => p.id === target.parentId)
        : null;
      const isMatchingTx = (t: Transaction) =>
        target.parentId
          ? t.tag === parentProject?.name && t.subTag === target.name
          : t.tag === target.name;

      const deletedTxIds = transactions.filter(isMatchingTx).map((t) => t.id);
      if (deletedTxIds.length > 0) {
        const deletedSet = new Set(deletedTxIds);
        setTransactions((prev) => {
          const remaining = prev.filter((t) => !deletedSet.has(t.id));
          saveStoredTransactions(remaining, activeAccountId);
          return remaining;
        });
        void batchDeleteExpenses(deletedTxIds).catch((err) => {
          console.error('Error deleting project transactions from Supabase:', err);
        });
      }
    }

    setProjects((prev) => {
      const targetProj = prev.find((p) => p.id === id);
      const deletedBudget = targetProj?.parentId && targetProj.budget ? targetProj.budget : 0;
      const updated = prev
        .filter((p) => p.id !== id && p.parentId !== id)
        .map((p) => {
          if (targetProj?.parentId && p.id === targetProj.parentId && deletedBudget > 0 && p.budget) {
            const nextBudget = Math.max(0, p.budget - deletedBudget);
            const nextParent = { ...p, budget: nextBudget > 0 ? nextBudget : undefined };
            void upsertProjectToSupabase(nextParent, activeAccountId);
            return nextParent;
          }
          return p;
        });
      saveStoredProjects(updated, activeAccountId);
      return updated;
    });
    void deleteProjectFromSupabase(id);
  };

  const handleToggleProjectComplete = (id: string, completed: boolean) => {
    setProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== id || isGeneralProject(p)) return p;
        const nextProj = { ...p, completed, completedAt: completed ? Date.now() : null };
        void upsertProjectToSupabase(nextProj, activeAccountId);
        return nextProj;
      });
      saveStoredProjects(updated, activeAccountId);
      return updated;
    });
  };

  // Cross-view Navigation
  const handleNavigateToTransactions = (filter?: {
    tag?: string;
    subTag?: string;
    type?: TransactionType;
  }) => {
    if (filter) {
      setTxLedgerFilter(filter);
    } else {
      setTxLedgerFilter({});
    }
    setActiveTab('transactions');
  };

  const handleNavigateToProjects = () => {
    setActiveTab('projects');
  };

  const handleOpenEdit = (t: Transaction) => {
    if (!canModifyTransaction(t, projects, currentUserId)) return;
    setEditingTransaction(t);
    setIsTxModalOpen(true);
  };

  const handleViewAttachment = (attachments: string[], title: string) => {
    setAttachmentModal({
      isOpen: true,
      attachments,
      title,
    });
  };

  const handleImportTransactions = (imported: Transaction[]) => {
    // Re-index slNo sequentially
    const merged = [...imported, ...transactions];
    const uniqueMap = new Map<string, Transaction>();
    for (const t of merged) {
      uniqueMap.set(t.id, t);
    }
    const finalTransactions = Array.from(uniqueMap.values()).map((t, idx) => ({
      ...t,
      slNo: idx + 1,
    }));
    setTransactions(finalTransactions);
    saveStoredTransactions(finalTransactions);
  };

  const handleClearAllData = async () => {
    const prevTxIds = transactions.map((t) => t.id);
    setTransactions([]);
    saveStoredTransactions([], activeAccountId);

    const remainingRecurring = recurringTransactions.filter(
      (r) => r.accountId !== activeAccountId
    );
    setRecurringTransactions(remainingRecurring);
    saveStoredRecurringTransactions(remainingRecurring);

    if (user && isSupabaseConfigured) {
      try {
        if (prevTxIds.length > 0) {
          await batchDeleteExpenses(prevTxIds);
        }
        await saveRecurringToSupabase(remainingRecurring);
      } catch (err) {
        console.error('Error clearing data from Supabase:', err);
      }
    }
  };

  const handleSwitchAccount = (accountId: string) => {
    if (accountId === activeAccountId) return;
    setActiveAccountId(accountId);
    saveActiveAccountId(accountId);
    setTransactions(getStoredTransactions(accountId));
    setProjects(getStoredProjects(accountId));
    setTxLedgerFilter({});
  };

  const handleAddAccount = (name: string) => {
    const newAccount: Account = {
      id: `acc-${Date.now()}`,
      name,
      createdAt: Date.now(),
    };
    const nextAccounts = [...accounts, newAccount];
    setAccounts(nextAccounts);
    saveStoredAccounts(nextAccounts);
    void saveAccountsToSupabase(nextAccounts);
    handleSwitchAccount(newAccount.id);
  };

  const handleRenameAccount = (id: string, name: string) => {
    const nextAccounts = accounts.map((a) => (a.id === id ? { ...a, name } : a));
    setAccounts(nextAccounts);
    saveStoredAccounts(nextAccounts);
    void saveAccountsToSupabase(nextAccounts);
  };

  const handleDeleteAccount = (id: string) => {
    if (id === DEFAULT_ACCOUNT_ID) return;
    const nextAccounts = accounts.filter((a) => a.id !== id);
    setAccounts(nextAccounts);
    saveStoredAccounts(nextAccounts);
    void saveAccountsToSupabase(nextAccounts);
    if (activeAccountId === id) {
      handleSwitchAccount(DEFAULT_ACCOUNT_ID);
    }
  };

  const handleAddRecurring = (
    item: Omit<RecurringTransaction, 'id' | 'accountId' | 'createdAt' | 'lastGeneratedMonth'>
  ) => {
    const newRule: RecurringTransaction = {
      ...item,
      id: `rec-${Date.now()}`,
      accountId: activeAccountId,
      createdAt: Date.now(),
    };
    setRecurringTransactions((prev) => {
      const updated = [...prev, newRule];
      saveStoredRecurringTransactions(updated);
      void saveRecurringToSupabase(updated);
      return updated;
    });
  };

  const handleDeleteRecurring = (id: string) => {
    setRecurringTransactions((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      saveStoredRecurringTransactions(updated);
      void saveRecurringToSupabase(updated);
      return updated;
    });
  };

  const handleAddTeamMember = (
    member: Omit<TeamMember, 'id' | 'accountId' | 'createdAt'>
  ) => {
    const newMember: TeamMember = {
      ...member,
      id: `tm-${Date.now()}`,
      accountId: activeAccountId,
      createdAt: Date.now(),
    };
    setTeamMembers((prev) => {
      const updated = [...prev, newMember];
      saveStoredTeamMembers(updated);
      void saveTeamMembersToSupabase(updated);
      return updated;
    });
  };

  const handleDeleteTeamMember = (id: string) => {
    setTeamMembers((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveStoredTeamMembers(updated);
      void saveTeamMembersToSupabase(updated);
      return updated;
    });
  };

  // Auto-generate due recurring transactions for the current month
  useEffect(() => {
    if (isDataLoading || processingRecurringRef.current) return;
    if (recurringTransactions.length === 0) return;

    const now = new Date();
    const year = now.getFullYear();
    const monthIdx = now.getMonth();
    const currentMonth = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    const dueRules = recurringTransactions.filter((r) => {
      if (r.accountId !== activeAccountId) return false;
      const effectiveDay = Math.min(r.dayOfMonth, daysInMonth);
      return now.getDate() >= effectiveDay && r.lastGeneratedMonth !== currentMonth;
    });

    if (dueRules.length === 0) return;
    processingRecurringRef.current = true;

    const dueIds = new Set(dueRules.map((r) => r.id));
    const updatedRules = recurringTransactions.map((r) =>
      dueIds.has(r.id) ? { ...r, lastGeneratedMonth: currentMonth } : r
    );
    setRecurringTransactions(updatedRules);
    saveStoredRecurringTransactions(updatedRules);
    void saveRecurringToSupabase(updatedRules);

    (async () => {
      try {
        for (let i = 0; i < dueRules.length; i++) {
          const rule = dueRules[i];
          const effectiveDay = Math.min(rule.dayOfMonth, daysInMonth);
          const dateStr = `${currentMonth}-${String(effectiveDay).padStart(2, '0')}`;
          await handleSaveTransaction({
            slNo: nextSlNo + i,
            date: dateStr,
            type: rule.type,
            category: rule.category,
            amount: rule.amount,
            tag: rule.tag,
            subTag: rule.subTag || null,
            description: rule.description,
            notes: rule.notes || '',
            attachments: [],
          });
        }
      } finally {
        processingRecurringRef.current = false;
      }
    })();
  }, [recurringTransactions, activeAccountId, isDataLoading]);

  const handleResetToDefaults = async () => {
    const prevProjectIds = projects.map((p) => p.id);
    const defaultProjects = createDefaultProjectsForAccount(DEFAULT_ACCOUNT_ID);

    setAccounts(DEFAULT_ACCOUNTS);
    saveStoredAccounts(DEFAULT_ACCOUNTS);
    setActiveAccountId(DEFAULT_ACCOUNT_ID);
    saveActiveAccountId(DEFAULT_ACCOUNT_ID);
    setTransactions(getStoredTransactions(DEFAULT_ACCOUNT_ID));
    setProjects(defaultProjects);
    saveStoredProjects(defaultProjects, DEFAULT_ACCOUNT_ID);
    setTxLedgerFilter({});

    setTeamMembers([]);
    saveStoredTeamMembers([]);

    setIncomeCategories(DEFAULT_INCOME_CATEGORIES);
    saveStoredIncomeCategories(DEFAULT_INCOME_CATEGORIES);
    setExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
    saveStoredExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);

    if (user && isSupabaseConfigured) {
      try {
        for (const pid of prevProjectIds) {
          await deleteProjectFromSupabase(pid);
        }
        for (const proj of defaultProjects) {
          await upsertProjectToSupabase(proj, DEFAULT_ACCOUNT_ID);
        }
        await saveAccountsToSupabase(DEFAULT_ACCOUNTS);
        await saveTeamMembersToSupabase([]);
        await saveCategoriesToSupabase({
          incomeCategories: DEFAULT_INCOME_CATEGORIES,
          expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
        });
      } catch (err) {
        console.error('Error resetting settings in Supabase:', err);
      }
    }
  };

  // Auth Gate: Loading State
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
        <p className="text-sm font-medium text-slate-300">Connecting to your private vault...</p>
      </div>
    );
  }

  // Auth Gate: Require 1-Click Google Login unless continuing in Offline Demo Mode
  if (!user && !offlineDemoMode) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Sticky Global Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewTransaction={() => {
          setEditingTransaction(null);
          setIsTxModalOpen(true);
        }}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        netBalance={netBalance}
        transactionCount={transactions.length}
        projectCount={activeProjects.filter((p) => !p.parentId).length}
        userProfile={userProfile}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onSwitchAccount={handleSwitchAccount}
        onAddAccount={handleAddAccount}
        onRenameAccount={handleRenameAccount}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Cloud Sync Status Banner */}
      {isDataLoading && (
        <div className="bg-emerald-50 border-b border-emerald-200 py-1.5 px-4 text-center text-xs text-emerald-800 flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          <span>Syncing with your private Supabase vault...</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="grow max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 sm:pb-12">
        {activeTab === 'dashboard' && (
          <DashboardView
            transactions={activeTransactions}
            projects={activeProjects}
            onOpenNewTransaction={() => {
              setEditingTransaction(null);
              setIsTxModalOpen(true);
            }}
            onNavigateToTransactions={handleNavigateToTransactions}
            onNavigateToProjects={handleNavigateToProjects}
            onEditTransaction={handleOpenEdit}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            projects={activeProjects}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            initialFilter={txLedgerFilter}
            currentUserId={currentUserId}
            onOpenNewTransaction={() => {
              setEditingTransaction(null);
              setIsTxModalOpen(true);
            }}
            onEditTransaction={handleOpenEdit}
            onDeleteTransaction={handleDeleteTransaction}
            onBatchDeleteTransactions={handleBatchDeleteTransactions}
            onDuplicateTransaction={handleDuplicateTransaction}
            onViewAttachment={handleViewAttachment}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsView
            projects={projects}
            transactions={transactions}
            teamMembers={teamMembers}
            currentUserId={currentUserId}
            onAddProject={handleAddProject}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            onToggleProjectComplete={handleToggleProjectComplete}
            onViewProjectTransactions={(projectName, subProjectName) =>
              handleNavigateToTransactions({ tag: projectName, subTag: subProjectName })
            }
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView transactions={transactions} projects={activeProjects} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            transactions={transactions}
            projects={projects}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            userProfile={userProfile}
            onUpdateIncomeCategories={(cats) => {
              setIncomeCategories(cats);
              saveStoredIncomeCategories(cats);
              void saveCategoriesToSupabase({ incomeCategories: cats });
            }}
            onUpdateExpenseCategories={(cats) => {
              setExpenseCategories(cats);
              saveStoredExpenseCategories(cats);
              void saveCategoriesToSupabase({ expenseCategories: cats });
            }}
            onUpdateUserProfile={(prof) => {
              setUserProfile(prof);
              saveUserProfile(prof);
            }}
            onImportTransactions={handleImportTransactions}
            onClearAllData={handleClearAllData}
            onResetToDefaults={handleResetToDefaults}
            recurringTransactions={recurringTransactions.filter(
              (r) => r.accountId === activeAccountId
            )}
            onAddRecurring={handleAddRecurring}
            onDeleteRecurring={handleDeleteRecurring}
            teamMembers={teamMembers.filter((m) => m.accountId === activeAccountId)}
            onAddTeamMember={handleAddTeamMember}
            onDeleteTeamMember={handleDeleteTeamMember}
          />
        )}
      </main>

      {/* Mobile Floating Action Button (FAB) */}
      <button
        onClick={() => {
          setEditingTransaction(null);
          setIsTxModalOpen(true);
        }}
        className="sm:hidden fixed bottom-18 right-4 z-30 w-13 h-13 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-90 text-white flex items-center justify-center shadow-xl shadow-emerald-600/40 border-2 border-white transition-all cursor-pointer"
        aria-label="Add Transaction"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Add / Edit Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        editingTransaction={editingTransaction}
        projects={activeProjects}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        nextSlNo={nextSlNo}
      />

      {/* Lightbox Attachment Viewer Modal */}
      <AttachmentViewerModal
        isOpen={attachmentModal.isOpen}
        onClose={() => setAttachmentModal({ isOpen: false, attachments: [], title: '' })}
        attachments={attachmentModal.attachments}
        title={attachmentModal.title}
      />

      {/* User Profile & Photo Edit Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userProfile={userProfile}
        onSaveProfile={(updatedProfile) => {
          setUserProfile(updatedProfile);
          saveUserProfile(updatedProfile);
        }}
      />

      {/* PWA Floating Install Prompt Banner */}
      <InstallBanner onOpenModal={() => setIsInstallModalOpen(true)} />

      {/* PWA Install Guide & Native Prompt Modal */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
};

export default App;
