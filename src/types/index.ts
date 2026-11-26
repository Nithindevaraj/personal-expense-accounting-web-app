export type TransactionType = 'Income' | 'Expense';

export interface Transaction {
  id: string;
  slNo: number;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: string;
  amount: number;
  tag: string; // Project Tag (e.g. Project Alpha, Beta, etc.)
  subTag?: string | null; // Optional Sub-project Tag
  description: string;
  attachments?: string[]; // Data URLs or filenames
  notes?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  parentId?: string | null;
  name: string;
  description?: string;
  budget?: number;
  color?: string;
  completed?: boolean;
  completedAt?: number | null;
  createdAt: number;
}

export interface DateFilterRange {
  from: string; // YYYY-MM-DD or empty
  to: string;   // YYYY-MM-DD or empty
}

export const DEFAULT_INCOME_CATEGORIES: string[] = [
  'Salary',
  'Advance',
  'Returns',
  'Refund',
  'Gifts',
  'Borrowing',
  'Borrow Receiving',
];

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Rents',
  'Food',
  'Transport',
  'Utilities',
  'Purchase',
  'Entertainment',
  'Lending',
  'Lends Returning',
];

export interface Account {
  id: string;
  name: string;
  createdAt?: number;
}

export const DEFAULT_ACCOUNT_ID = 'default';
export const DEFAULT_ACCOUNTS: Account[] = [
  { id: DEFAULT_ACCOUNT_ID, name: 'Personal' },
];

export const GENERAL_PROJECT_ID = 'proj-general';
export const GENERAL_PROJECT_NAME = 'General Transactions';

export function isGeneralProject(project: Pick<Project, 'id' | 'name'>): boolean {
  return (
    project.id === GENERAL_PROJECT_ID ||
    project.id.endsWith(`-${GENERAL_PROJECT_ID}`) ||
    project.name === GENERAL_PROJECT_NAME
  );
}

export function createDefaultProjectsForAccount(accountId: string): Project[] {
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return DEFAULT_PROJECTS;
  }
  return DEFAULT_PROJECTS.map((p) => ({
    ...p,
    id: `${accountId}-${p.id}`,
    parentId: p.parentId ? `${accountId}-${p.parentId}` : null,
  }));
}

export const DEFAULT_PROJECTS: Project[] = [
  {
    id: GENERAL_PROJECT_ID,
    name: GENERAL_PROJECT_NAME,
    description: 'General income and expense transactions',
    color: '#64748b',
    createdAt: Date.now() - 60 * 86400000,
  },
  {
    id: 'proj-demo-1',
    name: 'Demo project 1',
    description: 'u can edit the project name or delete it',
    budget: 50000,
    color: '#3b82f6',
    createdAt: Date.now() - 30 * 86400000,
  },
  {
    id: 'proj-demo-job-1',
    parentId: 'proj-demo-1',
    name: 'demo Job 1',
    description: 'each projects can have sub tasks or job',
    budget: 20000,
    color: '#3b82f6',
    createdAt: Date.now() - 25 * 86400000,
  },
  {
    id: 'proj-demo-2',
    name: 'demo project 2',
    description: 'Projects can be archived if done and their transactions will not reflect in dashboard',
    budget: 30000,
    color: '#10b981',
    createdAt: Date.now() - 20 * 86400000,
  },
];
