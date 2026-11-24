import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_PROJECTS,
  type Project,
  type Transaction,
} from '../types';

const STORAGE_KEYS = {
  TRANSACTIONS: 'personal_accounting_transactions_v2',
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

// Initial default transactions (empty by default)
export const SAMPLE_TRANSACTIONS: Transaction[] = [];

export function getStoredTransactions(): Transaction[] {
  try {
    let data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!data) {
      // Migrate from v1 if present, stripping out all demo seed items
      const v1Data = localStorage.getItem('personal_accounting_transactions_v1');
      if (v1Data) {
        try {
          const parsedV1 = JSON.parse(v1Data);
          if (Array.isArray(parsedV1)) {
            const userOnly = parsedV1.filter((tx: Transaction) => !tx.id?.startsWith('tx-seed-'));
            saveStoredTransactions(userOnly);
            localStorage.removeItem('personal_accounting_transactions_v1');
            return userOnly;
          }
        } catch {
          // ignore
        }
      }
      saveStoredTransactions([]);
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    // Ensure any previously seeded demo transactions are cleaned out
    const cleaned = parsed.filter(
      (tx: Transaction) => !tx.id?.startsWith('tx-seed-')
    );
    if (cleaned.length !== parsed.length) {
      saveStoredTransactions(cleaned);
    }
    return cleaned;
  } catch (err) {
    console.error('Error loading stored transactions:', err);
    return [];
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
