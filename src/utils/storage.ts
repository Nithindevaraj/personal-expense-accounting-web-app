import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_PROJECTS,
  type Project,
  type Transaction,
} from '../types';

const STORAGE_KEYS = {
  TRANSACTIONS: 'personal_accounting_transactions_v1',
  PROJECTS: 'personal_accounting_projects_v1',
  INCOME_CATEGORIES: 'personal_accounting_income_categories_v1',
  EXPENSE_CATEGORIES: 'personal_accounting_expense_categories_v1',
  USER_PROFILE: 'personal_accounting_user_profile_v1',
};

export interface UserProfile {
  name: string;
  currency: string;
  email: string;
  avatar?: string; // Base64 data URL
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Personal',
  currency: 'INR',
  email: 'user@example.com',
};

// Seed realistic sample transactions mirroring personal accounting
export const SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-seed-1',
    slNo: 1,
    date: '2026-11-01',
    type: 'Income',
    category: 'Monthly salary',
    amount: 125000,
    tag: 'Personal',
    description: 'Tech Systems Consulting - November Remuneration',
    attachments: [],
    notes: 'Direct bank deposit after standard TDS deduction',
    createdAt: Date.now() - 22 * 86400000,
  },
  {
    id: 'tx-seed-2',
    slNo: 2,
    date: '2026-11-03',
    type: 'Expense',
    category: 'Housing & Rent',
    amount: 28000,
    tag: 'Personal',
    description: 'Apartment Monthly Lease & Maintenance',
    attachments: [],
    notes: 'Paid via UPI transfer to landlord',
    createdAt: Date.now() - 20 * 86400000,
  },
  {
    id: 'tx-seed-3',
    slNo: 3,
    date: '2026-11-05',
    type: 'Income',
    category: 'freelance payouts',
    amount: 45000,
    tag: 'Project Alpha',
    description: 'Milestone 2 API Architecture Deliverable',
    attachments: [],
    notes: 'Client signed off on GraphQL edge gateway',
    createdAt: Date.now() - 18 * 86400000,
  },
  {
    id: 'tx-seed-4',
    slNo: 4,
    date: '2026-11-07',
    type: 'Expense',
    category: 'Utilities & Bills',
    amount: 4850,
    tag: 'Personal',
    description: 'Electricity, High-speed Fiber Broadband & Mobile bills',
    attachments: [],
    notes: 'Auto-debit verified',
    createdAt: Date.now() - 16 * 86400000,
  },
  {
    id: 'tx-seed-5',
    slNo: 5,
    date: '2026-11-09',
    type: 'Expense',
    category: 'Groceries',
    amount: 8400,
    tag: 'Personal',
    description: 'Monthly Organic pantry & vegetables restock',
    attachments: [],
    notes: 'Blinkit & Nature Basket order',
    createdAt: Date.now() - 14 * 86400000,
  },
  {
    id: 'tx-seed-6',
    slNo: 6,
    date: '2026-11-12',
    type: 'Expense',
    category: 'Transportation & Fuel',
    amount: 5200,
    tag: 'Project Alpha',
    description: 'Client onsite travel & fuel allowance',
    attachments: [],
    notes: 'Reimbursable trip for hardware deployment',
    createdAt: Date.now() - 11 * 86400000,
  },
  {
    id: 'tx-seed-7',
    slNo: 7,
    date: '2026-11-14',
    type: 'Income',
    category: 'business profits',
    amount: 32000,
    tag: 'Project Beta',
    description: 'Hardware prototype testing license',
    attachments: [],
    notes: 'Pilot contract royalty tranche 1',
    createdAt: Date.now() - 9 * 86400000,
  },
  {
    id: 'tx-seed-8',
    slNo: 8,
    date: '2026-11-16',
    type: 'Expense',
    category: 'Food & Dining',
    amount: 3600,
    tag: 'Personal',
    description: 'Weekend dinner with family & friends',
    attachments: [],
    notes: 'The Fatty Bao dinner',
    createdAt: Date.now() - 7 * 86400000,
  },
  {
    id: 'tx-seed-9',
    slNo: 9,
    date: '2026-11-18',
    type: 'Expense',
    category: 'Shopping & Lifestyle',
    amount: 14500,
    tag: 'Project Gamma',
    description: 'Rode PodMic & Studio Boom Arm for streaming setup',
    attachments: [],
    notes: 'Amazon Prime purchase invoice attached',
    createdAt: Date.now() - 5 * 86400000,
  },
  {
    id: 'tx-seed-10',
    slNo: 10,
    date: '2026-11-20',
    type: 'Income',
    category: 'gains',
    amount: 8750,
    tag: 'Personal',
    description: 'Mutual Fund Dividend & Stock Yield',
    attachments: [],
    notes: 'Credited directly to Zerodha linked account',
    createdAt: Date.now() - 3 * 86400000,
  },
  {
    id: 'tx-seed-11',
    slNo: 11,
    date: '2026-11-22',
    type: 'Expense',
    category: 'Education & Learning',
    amount: 4999,
    tag: 'Project Alpha',
    description: 'Cloud Architecture & Kubernetes Certification Prep',
    attachments: [],
    notes: 'Udemy & Cloud Academy renewal',
    createdAt: Date.now() - 1 * 86400000,
  },
];

export function getStoredTransactions(): Transaction[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!data) {
      saveStoredTransactions(SAMPLE_TRANSACTIONS);
      return SAMPLE_TRANSACTIONS;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SAMPLE_TRANSACTIONS;
  } catch (err) {
    console.error('Error loading stored transactions:', err);
    return SAMPLE_TRANSACTIONS;
  }
}

export function saveStoredTransactions(transactions: Transaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  } catch (err) {
    console.error('Error saving transactions:', err);
  }
}

export function getStoredProjects(): Project[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!data) {
      saveStoredProjects(DEFAULT_PROJECTS);
      return DEFAULT_PROJECTS;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROJECTS;
  } catch (err) {
    console.error('Error loading stored projects:', err);
    return DEFAULT_PROJECTS;
  }
}

export function saveStoredProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  } catch (err) {
    console.error('Error saving projects:', err);
  }
}

export function getStoredIncomeCategories(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.INCOME_CATEGORIES);
    if (!data) {
      saveStoredIncomeCategories(DEFAULT_INCOME_CATEGORIES);
      return DEFAULT_INCOME_CATEGORIES;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_INCOME_CATEGORIES;
  } catch (err) {
    console.error('Error loading income categories:', err);
    return DEFAULT_INCOME_CATEGORIES;
  }
}

export function saveStoredIncomeCategories(categories: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INCOME_CATEGORIES, JSON.stringify(categories));
  } catch (err) {
    console.error('Error saving income categories:', err);
  }
}

export function getStoredExpenseCategories(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSE_CATEGORIES);
    if (!data) {
      saveStoredExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
      return DEFAULT_EXPENSE_CATEGORIES;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_EXPENSE_CATEGORIES;
  } catch (err) {
    console.error('Error loading expense categories:', err);
    return DEFAULT_EXPENSE_CATEGORIES;
  }
}

export function saveStoredExpenseCategories(categories: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSE_CATEGORIES, JSON.stringify(categories));
  } catch (err) {
    console.error('Error saving expense categories:', err);
  }
}

export function getUserProfile(): UserProfile {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : DEFAULT_USER_PROFILE;
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  } catch (err) {
    console.error('Error saving user profile:', err);
  }
}

export function resetToDefaults(): void {
  saveStoredTransactions(SAMPLE_TRANSACTIONS);
  saveStoredProjects(DEFAULT_PROJECTS);
  saveStoredIncomeCategories(DEFAULT_INCOME_CATEGORIES);
  saveStoredExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
  saveUserProfile(DEFAULT_USER_PROFILE);
}
