import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  createDefaultProjectsForAccount,
  isGeneralProject,
} from './types';
import {
  type UserProfile,
  buildIndividualUserCode,
  buildIndividualUserLink,
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
import { canModifyTransaction, isUserCompanyAdmin } from './utils/projectPermissions';
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
import { CompanyOnboardingView } from './components/CompanyOnboardingView';
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
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: isAuthLoading, offlineDemoMode } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Sync activeTab with current URL route
  const getTabFromPath = (pathname: string): ActiveTab => {
    if (pathname.includes('/transactions')) return 'transactions';
    if (pathname.includes('/projects')) return 'projects';
    if (pathname.includes('/analytics')) return 'analytics';
    if (pathname.includes('/settings')) return 'settings';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => getTabFromPath(window.location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);
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

            // Ensure company creator is registered in teams for all their owned companies
            let mergedTeams = [...fetchedTeamMembers];
            let teamsModified = false;
            const creatorDisplayName = user.user_metadata?.full_name || userProfile.name || 'Admin';
            fetchedAccounts.forEach((acc) => {
              if (acc.ownerId === currentUserId) {
                const exists = mergedTeams.some(
                  (m) => m.accountId === acc.id && m.userId === currentUserId
                );
                if (!exists) {
                  mergedTeams.push({
                    id: `tm-owner-${acc.id}-${Date.now()}`,
                    accountId: acc.id,
                    userId: currentUserId,
                    userLink: buildIndividualUserLink(currentUserId, creatorDisplayName),
                    name: creatorDisplayName,
                    designation: '',
                    createdAt: Date.now(),
                  });
                  teamsModified = true;
                }
              }
            });

            setTeamMembers(mergedTeams);
            if (teamsModified) {
              saveStoredTeamMembers(mergedTeams);
              void saveTeamMembersToSupabase(mergedTeams);
            }
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

    // Subscribe to Supabase Realtime changes for cross-device updates and company assignments
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let assignmentChannel: ReturnType<typeof supabase.channel> | null = null;
    let codeAssignmentChannel: ReturnType<typeof supabase.channel> | null = null;
    let globalTeamChannel: ReturnType<typeof supabase.channel> | null = null;
    if (isSupabaseConfigured) {
      // Global broadcast channel for instant multi-device team member synchronization
      globalTeamChannel = supabase
        .channel(`team-sync-${activeAccountId}`)
        .on('broadcast', { event: 'team-updated' }, () => {
          getTeamMembersFromSupabase().then((refreshed) => {
            if (isMounted) setTeamMembers(refreshed);
          }).catch(() => {});
        })
        .subscribe();

      const myCode = buildIndividualUserCode(user.id);
      const cleanMyCode = myCode.replace(/[^0-9]/g, '');

      if (cleanMyCode.length === 16) {
        codeAssignmentChannel = supabase
          .channel(`company-assignments-${cleanMyCode}`)
          .on('broadcast', { event: 'company-added' }, (payload: { payload?: { company?: Account } }) => {
            const addedCompany = payload?.payload?.company;
            if (addedCompany && addedCompany.id) {
              setAccounts((prevAccounts) => {
                if (prevAccounts.some((a) => a.id === addedCompany.id)) return prevAccounts;
                const nextAccounts = [...prevAccounts, addedCompany];
                saveStoredAccounts(nextAccounts);
                void saveAccountsToSupabase(nextAccounts);
                return nextAccounts;
              });
              setOnboardingDone(true);
            }
          })
          .subscribe();
      }
      assignmentChannel = supabase
        .channel(`company-assignments-${user.id}`)
        .on('broadcast', { event: 'company-added' }, (payload: { payload?: { company?: Account } }) => {
          const addedCompany = payload?.payload?.company;
          if (addedCompany && addedCompany.id) {
            setAccounts((prevAccounts) => {
              if (prevAccounts.some((a) => a.id === addedCompany.id)) return prevAccounts;
              const nextAccounts = [...prevAccounts, addedCompany];
              saveStoredAccounts(nextAccounts);
              void saveAccountsToSupabase(nextAccounts);
              return nextAccounts;
            });
            setOnboardingDone(true);
          }
        })
        .on('broadcast', { event: 'company-removed' }, (payload: { payload?: { companyId?: string } }) => {
          const removedCompanyId = payload?.payload?.companyId;
          if (removedCompanyId) {
            setAccounts((prevAccounts) => {
              const nextAccounts = prevAccounts.filter((a) => a.id !== removedCompanyId);
              saveStoredAccounts(nextAccounts);
              void saveAccountsToSupabase(nextAccounts);
              return nextAccounts;
            });
            // If the user was currently viewing that removed company, switch back to their primary account
            if (activeAccountId === removedCompanyId) {
              setAccounts((prevAccounts) => {
                const remaining = prevAccounts.filter((a) => a.id !== removedCompanyId);
                const nextActive = remaining[0]?.id || 'default';
                handleSwitchAccount(nextActive);
                return remaining;
              });
            }
          }
        })
        .subscribe();

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

                // Ensure company creator is registered in teams for all their owned companies
                let mergedTeams = [...fetchedTeamMembers];
                let teamsModified = false;
                const creatorDisplayName = user.user_metadata?.full_name || userProfile.name || 'Admin';
                fetchedAccounts.forEach((acc) => {
                  if (acc.ownerId === currentUserId) {
                    const exists = mergedTeams.some(
                      (m) => m.accountId === acc.id && m.userId === currentUserId
                    );
                    if (!exists) {
                      mergedTeams.push({
                        id: `tm-owner-${acc.id}-${Date.now()}`,
                        accountId: acc.id,
                        userId: currentUserId,
                        userLink: buildIndividualUserLink(currentUserId, creatorDisplayName),
                        name: creatorDisplayName,
                        designation: '',
                        role: 'admin',
                        createdAt: Date.now(),
                      });
                      teamsModified = true;
                    }
                  }
                });

                setTeamMembers(mergedTeams);
                if (teamsModified) {
                  saveStoredTeamMembers(mergedTeams);
                  void saveTeamMembersToSupabase(mergedTeams);
                }
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
      if (assignmentChannel) {
        supabase.removeChannel(assignmentChannel);
      }
      if (codeAssignmentChannel) {
        supabase.removeChannel(codeAssignmentChannel);
      }
      if (globalTeamChannel) {
        supabase.removeChannel(globalTeamChannel);
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
          // Compound check: remove duplicates by id OR matching in-flight compound signature
          const withoutDup = prev.filter(
            (t) =>
              t.id !== savedTx.id &&
              !(
                t.id.startsWith('tx-temp-') &&
                t.date === savedTx.date &&
                t.amount === savedTx.amount &&
                t.type === savedTx.type &&
                t.slNo === savedTx.slNo
              )
          );
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
  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];
  const isCompanyAdmin = isUserCompanyAdmin(activeAccount, currentUserId, teamMembers);
  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`company_onboarding_done_${currentUserId}`) === 'true';
    } catch {
      return false;
    }
  });

  const handleDeleteTransaction = async (id: string) => {
    const target = transactions.find((t) => t.id === id);
    if (target && !canModifyTransaction(target, projects, currentUserId, teamMembers, activeAccountId)) return;

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
      return !target || canModifyTransaction(target, projects, currentUserId, teamMembers, activeAccountId);
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
    if (!isCompanyAdmin) return;
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
    if (!isCompanyAdmin) return;
    setProjects((prev) => {
      const updated = prev.map((p) => (p.id === project.id ? project : p));
      saveStoredProjects(updated, activeAccountId);
      return updated;
    });
    void upsertProjectToSupabase(project, activeAccountId);
  };

  const handleDeleteProject = (id: string) => {
    if (!isCompanyAdmin) return;
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
    if (!isCompanyAdmin) return;
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
    navigate('/transactions');
  };

  const handleNavigateToProjects = () => {
    setActiveTab('projects');
    navigate('/projects');
  };

  const handleOpenEdit = (t: Transaction) => {
    if (!canModifyTransaction(t, projects, currentUserId, teamMembers, activeAccountId)) return;
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
    if (!activeAccount?.ownerId || activeAccount.ownerId !== currentUserId) return;
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
    const newAccountId = `acc-${Date.now()}`;
    const newAccount: Account = {
      id: newAccountId,
      name,
      ownerId: currentUserId,
      createdAt: Date.now(),
    };
    const nextAccounts = [...accounts, newAccount];
    setAccounts(nextAccounts);
    saveStoredAccounts(nextAccounts);
    void saveAccountsToSupabase(nextAccounts);

    // Register creator under Company Team
    const creatorName = user?.user_metadata?.full_name || userProfile.name || 'Admin';
    const creatorMember: TeamMember = {
      id: `tm-${Date.now()}`,
      accountId: newAccountId,
      userId: currentUserId,
      userLink: buildIndividualUserLink(currentUserId, creatorName),
      name: creatorName,
      designation: '',
      createdAt: Date.now(),
    };
    const updatedTeamMembers = [...teamMembers, creatorMember];
    setTeamMembers(updatedTeamMembers);
    saveStoredTeamMembers(updatedTeamMembers);
    void saveTeamMembersToSupabase(updatedTeamMembers);

    handleSwitchAccount(newAccount.id);
  };

  const handleRenameAccount = (id: string, name: string) => {
    const target = accounts.find((a) => a.id === id);
    if (!isUserCompanyAdmin(target, currentUserId, teamMembers)) return;
    const nextAccounts = accounts.map((a) => (a.id === id ? { ...a, name } : a));
    setAccounts(nextAccounts);
    saveStoredAccounts(nextAccounts);
    void saveAccountsToSupabase(nextAccounts);
  };

  const handleUpdateAccount = (updatedAccount: Account) => {
    if (!isUserCompanyAdmin(updatedAccount, currentUserId, teamMembers)) return;
    const nextAccounts = accounts.map((a) =>
      a.id === updatedAccount.id ? updatedAccount : a
    );
    setAccounts(nextAccounts);
    saveStoredAccounts(nextAccounts);
    void saveAccountsToSupabase(nextAccounts);
  };

  const handleDeleteAccount = async (id: string) => {
    const target = accounts.find((a) => a.id === id);
    if (!isUserCompanyAdmin(target, currentUserId, teamMembers)) return;

    // Identify all members belonging to this company before removing it
    const companyTeamMembers = teamMembers.filter((m) => m.accountId === id);

    const nextAccounts = accounts.filter((a) => a.id !== id);
    setAccounts(nextAccounts);
    saveStoredAccounts(nextAccounts);

    const remainingRecurring = recurringTransactions.filter((r) => r.accountId !== id);
    setRecurringTransactions(remainingRecurring);
    saveStoredRecurringTransactions(remainingRecurring);

    const remainingTeams = teamMembers.filter((m) => m.accountId !== id);
    setTeamMembers(remainingTeams);
    saveStoredTeamMembers(remainingTeams);

    // Completely purge from Supabase backend across all relational and user tables
    if (isSupabaseConfigured) {
      try {
        await saveAccountsToSupabase(nextAccounts);
        await saveRecurringToSupabase(remainingRecurring);
        await saveTeamMembersToSupabase(remainingTeams);

        if (user) {
          // Delete all company expenses (both account_id and company_id columns supported)
          await supabase.from('expenses').delete().or(`account_id.eq.${id},company_id.eq.${id}`);
          // Delete all company projects and sub-projects
          await supabase.from('projects').delete().or(`account_id.eq.${id},company_id.eq.${id}`);
          // Delete company divisions
          await supabase.from('company_divisions').delete().eq('company_id', id);
          // Delete company members
          await supabase.from('company_members').delete().eq('company_id', id);
          // Delete project members
          await supabase.from('project_members').delete().eq('company_id', id);
          // Delete the company root record
          await supabase.from('companies').delete().eq('id', id);
        }

        // Notify all team members in real-time that this company has been deleted
        companyTeamMembers.forEach((tm) => {
          if (tm.userId && tm.userId !== currentUserId) {
            const memberChannel = supabase.channel(`company-assignments-${tm.userId}`);
            memberChannel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                void memberChannel
                  .send({
                    type: 'broadcast',
                    event: 'company-removed',
                    payload: { companyId: id },
                  })
                  .finally(() => {
                    setTimeout(() => {
                      supabase.removeChannel(memberChannel);
                    }, 2000);
                  });
              }
            });
          }
        });
      } catch (err) {
        console.error('Error deleting company data from Supabase:', err);
      }
    }

    if (nextAccounts.length === 0) {
      try {
        localStorage.removeItem(`company_onboarding_done_${currentUserId}`);
      } catch {
        // ignore storage errors
      }
      setOnboardingDone(false);
      setActiveAccountId(DEFAULT_ACCOUNT_ID);
      saveActiveAccountId(DEFAULT_ACCOUNT_ID);
      setTransactions([]);
      setProjects([]);
      setTxLedgerFilter({});
      return;
    }

    if (activeAccountId === id) {
      const nextActiveId = nextAccounts[0]?.id || DEFAULT_ACCOUNT_ID;
      handleSwitchAccount(nextActiveId);
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

  const handleEditRecurring = (updatedItem: RecurringTransaction) => {
    setRecurringTransactions((prev) => {
      const updated = prev.map((r) => (r.id === updatedItem.id ? updatedItem : r));
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
      void saveTeamMembersToSupabase(updated, activeAccount?.name);
      return updated;
    });

    // Broadcast team-updated event across all devices
    if (isSupabaseConfigured && activeAccount) {
      const syncChannel = supabase.channel(`team-sync-${activeAccountId}`);
      syncChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void syncChannel
            .send({
              type: 'broadcast',
              event: 'team-updated',
              payload: { accountId: activeAccountId },
            })
            .finally(() => {
              setTimeout(() => {
                supabase.removeChannel(syncChannel);
              }, 1500);
            });
        }
      });
    }

    // Notify member via Realtime broadcast so this company is immediately added to their account list
    if (isSupabaseConfigured && activeAccount) {
      const targetUserId = member.userId;
      if (targetUserId) {
        const memberChannel = supabase.channel(`company-assignments-${targetUserId}`);
        memberChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void memberChannel
              .send({
                type: 'broadcast',
                event: 'company-added',
                payload: {
                  company: activeAccount,
                  memberRole: member.role || 'spender',
                },
              })
              .finally(() => {
                setTimeout(() => {
                  supabase.removeChannel(memberChannel);
                }, 2000);
              });
          }
        });
      }
    }
  };

  const handleEditTeamMember = (updatedMember: TeamMember) => {
    setTeamMembers((prev) => {
      const updated = prev.map((m) => (m.id === updatedMember.id ? updatedMember : m));
      saveStoredTeamMembers(updated);
      void saveTeamMembersToSupabase(updated);
      return updated;
    });

    // Broadcast update across devices
    if (isSupabaseConfigured && activeAccount) {
      const syncChannel = supabase.channel(`team-sync-${activeAccountId}`);
      syncChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void syncChannel
            .send({
              type: 'broadcast',
              event: 'team-updated',
              payload: { accountId: activeAccountId },
            })
            .finally(() => {
              setTimeout(() => {
                supabase.removeChannel(syncChannel);
              }, 1500);
            });
        }
      });
    }
  };

  const handleDeleteTeamMember = (id: string) => {
    const memberToDelete = teamMembers.find((m) => m.id === id);

    setTeamMembers((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveStoredTeamMembers(updated);
      void saveTeamMembersToSupabase(updated);
      return updated;
    });

    // Broadcast update across devices
    if (isSupabaseConfigured && activeAccount) {
      const syncChannel = supabase.channel(`team-sync-${activeAccountId}`);
      syncChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void syncChannel
            .send({
              type: 'broadcast',
              event: 'team-updated',
              payload: { accountId: activeAccountId },
            })
            .finally(() => {
              setTimeout(() => {
                supabase.removeChannel(syncChannel);
              }, 1500);
            });
        }
      });

      // Immediately notify the removed member so this company is removed from their account list
      if (memberToDelete?.userId) {
        const targetUserId = memberToDelete.userId;
        const memberChannel = supabase.channel(`company-assignments-${targetUserId}`);
        memberChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void memberChannel
              .send({
                type: 'broadcast',
                event: 'company-removed',
                payload: {
                  companyId: activeAccountId,
                },
              })
              .finally(() => {
                setTimeout(() => {
                  supabase.removeChannel(memberChannel);
                }, 2000);
              });
          }
        });
      }
    }
  };

  // Auto-generate due recurring transactions for the current month
  const handleSaveTransactionRef = useRef(handleSaveTransaction);
  handleSaveTransactionRef.current = handleSaveTransaction;
  const nextSlNoRef = useRef(nextSlNo);
  nextSlNoRef.current = nextSlNo;

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
        const startSlNo = nextSlNoRef.current;
        for (let i = 0; i < dueRules.length; i++) {
          const rule = dueRules[i];
          const effectiveDay = Math.min(rule.dayOfMonth, daysInMonth);
          const dateStr = `${currentMonth}-${String(effectiveDay).padStart(2, '0')}`;
          await handleSaveTransactionRef.current({
            slNo: startSlNo + i,
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
    if (!activeAccount?.ownerId || activeAccount.ownerId !== currentUserId) return;
    const prevProjectIds = projects.map((p) => p.id);
    const defaultProjects = createDefaultProjectsForAccount(activeAccountId);

    setProjects(defaultProjects);
    saveStoredProjects(defaultProjects, activeAccountId);
    setTxLedgerFilter({});

    const remainingTeams = teamMembers.filter((m) => m.accountId !== activeAccountId);
    setTeamMembers(remainingTeams);
    saveStoredTeamMembers(remainingTeams);

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
          await upsertProjectToSupabase(proj, activeAccountId);
        }
        await saveTeamMembersToSupabase(remainingTeams);
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

  // Post-login Company Onboarding: Create a Company (Admin) or Become a member of existing company
  // Show gate if user hasn't completed onboarding or has no companies yet
  const userValidCompanies = accounts.filter(
    (a) => a.id !== DEFAULT_ACCOUNT_ID && !(a.id === 'default' && a.name === 'Demo company')
  );

  if (!isDataLoading && (!onboardingDone || userValidCompanies.length === 0)) {
    const individualUserCode = buildIndividualUserLink(
      currentUserId,
      user?.user_metadata?.full_name || userProfile.name
    );

    return (
      <CompanyOnboardingView
        userName={user?.user_metadata?.full_name || userProfile.name}
        userCode={individualUserCode}
        availableCompanies={userValidCompanies}
        teamMembers={teamMembers}
        currentUserId={currentUserId}
        onCreateCompany={(companyName) => {
          try {
            localStorage.setItem(`company_onboarding_done_${currentUserId}`, 'true');
          } catch {
            // ignore storage quota errors
          }
          setOnboardingDone(true);
          handleAddAccount(companyName);
        }}
        onSelectCompany={(companyId) => {
          try {
            localStorage.setItem(`company_onboarding_done_${currentUserId}`, 'true');
          } catch {
            // ignore storage errors
          }
          setOnboardingDone(true);
          handleSwitchAccount(companyId);
        }}
        onCheckMembership={async () => {
          const verified = await getAccountsFromSupabase();
          const validCompanies = verified.filter(
            (a) => a.id !== DEFAULT_ACCOUNT_ID && !(a.id === 'default' && a.name === 'Demo company')
          );

          if (validCompanies.length > 0) {
            setAccounts(validCompanies);
            if (!validCompanies.some((a) => a.id === activeAccountId)) {
              handleSwitchAccount(validCompanies[0].id);
            }
            return true;
          }
          return false;
        }}
      />
    );
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
        teamMembers={teamMembers}
        activeAccountId={activeAccountId}
        currentUserId={currentUserId}
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
        <Routes>
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/dashboard"
            element={
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
            }
          />
          <Route
            path="/transactions"
            element={
              <TransactionsView
                transactions={transactions}
                projects={activeProjects}
                incomeCategories={incomeCategories}
                expenseCategories={expenseCategories}
                initialFilter={txLedgerFilter}
                currentUserId={currentUserId}
                teamMembers={teamMembers}
                activeAccountId={activeAccountId}
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
            }
          />
          <Route
            path="/projects"
            element={
              <ProjectsView
                projects={projects}
                transactions={transactions}
                teamMembers={teamMembers}
                divisions={activeAccount?.divisions || []}
                currentUserId={currentUserId}
                isCompanyAdmin={isCompanyAdmin}
                onAddProject={handleAddProject}
                onEditProject={handleEditProject}
                onDeleteProject={handleDeleteProject}
                onToggleProjectComplete={handleToggleProjectComplete}
                onViewProjectTransactions={(projectName, subProjectName) =>
                  handleNavigateToTransactions({ tag: projectName, subTag: subProjectName })
                }
              />
            }
          />
          <Route
            path="/analytics"
            element={
              <AnalyticsView transactions={transactions} projects={activeProjects} />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsView
                transactions={transactions}
                projects={projects}
                incomeCategories={incomeCategories}
                expenseCategories={expenseCategories}
                userProfile={userProfile}
                activeAccount={activeAccount}
                isCompanyAdmin={isCompanyAdmin}
                isCompanyCreator={Boolean(activeAccount?.ownerId && activeAccount.ownerId === currentUserId)}
                onUpdateAccount={handleUpdateAccount}
                onDeleteAccount={handleDeleteAccount}
                onUpdateIncomeCategories={(cats) => {
                  if (!isCompanyAdmin) return;
                  setIncomeCategories(cats);
                  saveStoredIncomeCategories(cats);
                  void saveCategoriesToSupabase({ incomeCategories: cats });
                }}
                onUpdateExpenseCategories={(cats) => {
                  if (!isCompanyAdmin) return;
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
                onEditRecurring={handleEditRecurring}
                onDeleteRecurring={handleDeleteRecurring}
                teamMembers={teamMembers.filter((m) => m.accountId === activeAccountId)}
                onAddTeamMember={handleAddTeamMember}
                onEditTeamMember={handleEditTeamMember}
                onDeleteTeamMember={handleDeleteTeamMember}
                onRefreshTeamMembers={() => {
                  getTeamMembersFromSupabase().then((refreshed) => {
                    setTeamMembers(refreshed);
                  }).catch(() => {});
                }}
              />
            }
          />
          <Route
            path="*"
            element={<Navigate to="/dashboard" replace />}
          />
        </Routes>
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
        accountId={activeAccountId}
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
