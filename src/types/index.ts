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
  createdByUserId?: string;
  createdAt: number;
}

export type ProjectAccessRole = 'admin' | 'spender';

export interface ProjectTeamAssignment {
  memberId: string;
  userId: string;
  name: string;
  designation: string;
  role: ProjectAccessRole;
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
  division?: string | null;
  ownerId?: string;
  teamMembers?: ProjectTeamAssignment[];
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
  ownerId?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  divisions?: string[];
  createdAt?: number;
}

export interface RecurringTransaction {
  id: string;
  accountId: string;
  type: TransactionType;
  dayOfMonth: number;
  amount: number;
  tag: string;
  subTag?: string | null;
  category: string;
  description: string;
  notes?: string;
  lastGeneratedMonth?: string;
  createdAt: number;
}

export interface TeamMember {
  id: string;
  accountId: string;
  userId: string;
  userLink: string;
  name: string;
  designation: string;
  role?: 'admin' | 'spender';
  createdAt: number;
}

export const DEFAULT_ACCOUNT_ID = 'default';
export const DEFAULT_ACCOUNTS: Account[] = [];

export function isGeneralProject(_project: Pick<Project, 'id' | 'name'>): boolean {
  return false;
}

export function createDefaultProjectsForAccount(_accountId: string): Project[] {
  return [];
}

export const DEFAULT_PROJECTS: Project[] = [];
