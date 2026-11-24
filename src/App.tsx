import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import type { Project, Transaction, TransactionType } from './types';
import {
  type UserProfile,
  getStoredExpenseCategories,
  getStoredIncomeCategories,
  getStoredProjects,
  getStoredTransactions,
  getUserProfile,
  saveStoredExpenseCategories,
  saveStoredIncomeCategories,
  saveStoredProjects,
  saveStoredTransactions,
  saveUserProfile,
} from './utils/storage';
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
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  batchDeleteExpenses,
} from './services/expenseService';

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
  const [transactions, setTransactions] = useState<Transaction[]>(getStoredTransactions);
  const [projects, setProjects] = useState<Project[]>(getStoredProjects);
  const [incomeCategories, setIncomeCategories] = useState<string[]>(getStoredIncomeCategories);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(getStoredExpenseCategories);
  const [userProfile, setUserProfile] = useState<UserProfile>(getUserProfile);

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
    type?: TransactionType;
  }>({});

  const [attachmentModal, setAttachmentModal] = useState<{
    isOpen: boolean;
    url: string | null;
    title: string;
  }>({
    isOpen: false,
    url: null,
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

  // Fetch user expenses from Supabase when authenticated
  useEffect(() => {
    if (user) {
      setIsDataLoading(true);
      getExpenses()
        .then((fetched) => {
          setTransactions(fetched);
        })
        .catch((err) => {
          console.error('Error fetching expenses from Supabase:', err);
        })
        .finally(() => {
          setIsDataLoading(false);
        });

      // Synchronize user profile display with Google metadata
      setUserProfile((prev) => ({
        ...prev,
        name: user.user_metadata?.full_name || prev.name,
        email: user.email || prev.email,
        avatar: user.user_metadata?.avatar_url || prev.avatar,
      }));
    }
  }, [user]);

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
      saveStoredTransactions(updated);

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
        createdAt: Date.now(),
      };
      const updated = [tempTx, ...transactions];
      setTransactions(updated);
      saveStoredTransactions(updated);

      // 2. Persist to Supabase and replace tempId with persistent UUID
      try {
        const savedTx = await addExpense(txData);
        setTransactions((prev) =>
          prev.map((t) => (t.id === tempId ? savedTx : t))
        );
      } catch (err) {
        console.error('Error adding expense to Supabase:', err);
      }
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    // 1. Optimistic UI update
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    saveStoredTransactions(updated);

    // 2. Persist to Supabase
    try {
      await deleteExpense(id);
    } catch (err) {
      console.error('Error deleting expense from Supabase:', err);
    }
  };

  const handleBatchDeleteTransactions = async (ids: string[]) => {
    // 1. Optimistic UI update
    const idSet = new Set(ids);
    const updated = transactions.filter((t) => !idSet.has(t.id));
    setTransactions(updated);
    saveStoredTransactions(updated);

    // 2. Persist to Supabase
    try {
      await batchDeleteExpenses(ids);
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
      id: `proj-${Date.now()}`,
      createdAt: Date.now(),
    };
    const updated = [...projects, newProj];
    setProjects(updated);
    saveStoredProjects(updated);
  };

  const handleEditProject = (project: Project) => {
    const updated = projects.map((p) => (p.id === project.id ? project : p));
    setProjects(updated);
    saveStoredProjects(updated);
  };

  const handleDeleteProject = (id: string) => {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    saveStoredProjects(updated);
  };

  // Cross-view Navigation
  const handleNavigateToTransactions = (filter?: {
    tag?: string;
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
    setEditingTransaction(t);
    setIsTxModalOpen(true);
  };

  const handleViewAttachment = (url: string, title: string) => {
    setAttachmentModal({
      isOpen: true,
      url,
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

  const handleClearAllData = () => {
    setTransactions([]);
    saveStoredTransactions([]);
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
        projectCount={projects.length}
        userProfile={userProfile}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
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
            transactions={transactions}
            projects={projects}
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
            projects={projects}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            initialFilter={txLedgerFilter}
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
            onAddProject={handleAddProject}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            onViewProjectTransactions={(projectName) =>
              handleNavigateToTransactions({ tag: projectName })
            }
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView transactions={transactions} projects={projects} />
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
            }}
            onUpdateExpenseCategories={(cats) => {
              setExpenseCategories(cats);
              saveStoredExpenseCategories(cats);
            }}
            onUpdateUserProfile={(prof) => {
              setUserProfile(prof);
              saveUserProfile(prof);
            }}
            onImportTransactions={handleImportTransactions}
            onClearAllData={handleClearAllData}
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

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 mt-auto text-center text-xs text-slate-400 mb-16 sm:mb-0">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Personal Accounting & Cost Center Engine</span>
          <span className="hidden sm:flex items-center gap-1 font-mono text-[11px] text-slate-500">
            Press <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 font-bold">N</kbd> anytime to log an entry
          </span>
          <span>100% Offline & Private Local Storage</span>
        </div>
      </footer>

      {/* Add / Edit Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        editingTransaction={editingTransaction}
        projects={projects}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        nextSlNo={nextSlNo}
      />

      {/* Lightbox Attachment Viewer Modal */}
      <AttachmentViewerModal
        isOpen={attachmentModal.isOpen}
        onClose={() => setAttachmentModal({ isOpen: false, url: null, title: '' })}
        imageUrl={attachmentModal.url}
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
