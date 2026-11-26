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

// Default Project Tags from the Google Sheet
export const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'proj-alpha',
    name: 'Project Alpha',
    description: 'Primary software engineering project & client deliverables',
    budget: 150000,
    color: '#3b82f6', // blue
    createdAt: Date.now() - 30 * 86400000,
  },
  {
    id: 'proj-beta',
    name: 'Project Beta',
    description: 'Hardware prototype research & development',
    budget: 75000,
    color: '#10b981', // emerald
    createdAt: Date.now() - 20 * 86400000,
  },
  {
    id: 'proj-gamma',
    name: 'Project Gamma',
    description: 'Personal media studio & content creation',
    budget: 50000,
    color: '#8b5cf6', // purple
    createdAt: Date.now() - 10 * 86400000,
  },
  {
    id: 'proj-personal',
    name: 'Personal',
    description: 'General household and individual living expenses',
    budget: 40000,
    color: '#f59e0b', // amber
    createdAt: Date.now() - 60 * 86400000,
  },
];
