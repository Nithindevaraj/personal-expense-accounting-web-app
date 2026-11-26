import {
  type Account,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_ACCOUNTS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_PROJECTS,
  createDefaultProjectsForAccount,
  type Project,
  type Transaction,
} from '../types';

const STORAGE_KEYS = {
  TRANSACTIONS: 'personal_accounting_transactions_v2',
  PROJECTS: 'personal_accounting_projects_v1',
  INCOME_CATEGORIES: 'personal_accounting_income_categories_v1',
  EXPENSE_CATEGORIES: 'personal_accounting_expense_categories_v1',
  USER_PROFILE: 'personal_accounting_user_profile_v1',
  ACCOUNTS: 'personal_accounting_accounts_v1',
  ACTIVE_ACCOUNT_ID: 'personal_accounting_active_account_v1',
};

function scopedKey(baseKey: string, accountId: string = DEFAULT_ACCOUNT_ID): string {
  return accountId === DEFAULT_ACCOUNT_ID ? baseKey : `${baseKey}_${accountId}`;
}

export function getStoredAccounts(): Account[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!data) {
      saveStoredAccounts(DEFAULT_ACCOUNTS);
      return DEFAULT_ACCOUNTS;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ACCOUNTS;
  } catch {
    return DEFAULT_ACCOUNTS;
  }
}

export function saveStoredAccounts(accounts: Account[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  } catch (err) {
    console.error('Error saving accounts:', err);
  }
}

export function getActiveAccountId(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID) || DEFAULT_ACCOUNT_ID;
  } catch {
    return DEFAULT_ACCOUNT_ID;
  }
}

export function saveActiveAccountId(accountId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID, accountId);
  } catch (err) {
    console.error('Error saving active account ID:', err);
  }
}

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

export function getStoredTransactions(accountId: string = DEFAULT_ACCOUNT_ID): Transaction[] {
  try {
    const key = scopedKey(STORAGE_KEYS.TRANSACTIONS, accountId);
    const data = localStorage.getItem(key);
    if (!data) {
      if (accountId === DEFAULT_ACCOUNT_ID) {
        // Migrate from v1 if present, stripping out all demo seed items
        const v1Data = localStorage.getItem('personal_accounting_transactions_v1');
        if (v1Data) {
          try {
            const parsedV1 = JSON.parse(v1Data);
            if (Array.isArray(parsedV1)) {
              const userOnly = parsedV1.filter((tx: Transaction) => !tx.id?.startsWith('tx-seed-'));
              saveStoredTransactions(userOnly, accountId);
              localStorage.removeItem('personal_accounting_transactions_v1');
              return userOnly;
            }
          } catch {
            // ignore
          }
        }
      }
      saveStoredTransactions([], accountId);
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    // Ensure any previously seeded demo transactions are cleaned out
    const cleaned = parsed.filter(
      (tx: Transaction) => !tx.id?.startsWith('tx-seed-')
    );
    if (cleaned.length !== parsed.length) {
      saveStoredTransactions(cleaned, accountId);
    }
    return cleaned;
  } catch (err) {
    console.error('Error loading stored transactions:', err);
    return [];
  }
}

export function saveStoredTransactions(
  transactions: Transaction[],
  accountId: string = DEFAULT_ACCOUNT_ID
): void {
  try {
    localStorage.setItem(scopedKey(STORAGE_KEYS.TRANSACTIONS, accountId), JSON.stringify(transactions));
  } catch (err) {
    console.error('Error saving transactions:', err);
  }
}

export function getStoredProjects(accountId: string = DEFAULT_ACCOUNT_ID): Project[] {
  const defaults = createDefaultProjectsForAccount(accountId);
  try {
    const data = localStorage.getItem(scopedKey(STORAGE_KEYS.PROJECTS, accountId));
    if (!data) {
      saveStoredProjects(defaults, accountId);
      return defaults;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults;
  } catch (err) {
    console.error('Error loading stored projects:', err);
    return defaults;
  }
}

export function saveStoredProjects(
  projects: Project[],
  accountId: string = DEFAULT_ACCOUNT_ID
): void {
  try {
    localStorage.setItem(scopedKey(STORAGE_KEYS.PROJECTS, accountId), JSON.stringify(projects));
  } catch (err) {
    console.error('Error saving projects:', err);
  }
}

export function getStoredIncomeCategories(): string[] {
  try {
    if (localStorage.getItem('personal_accounting_cat_version') !== 'v3') {
      saveStoredIncomeCategories(DEFAULT_INCOME_CATEGORIES);
      saveStoredExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
      localStorage.setItem('personal_accounting_cat_version', 'v3');
      return DEFAULT_INCOME_CATEGORIES;
    }
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

export function resetToDefaults(accountId: string = DEFAULT_ACCOUNT_ID): void {
  saveStoredTransactions(SAMPLE_TRANSACTIONS, accountId);
  saveStoredProjects(createDefaultProjectsForAccount(accountId), accountId);
  saveStoredIncomeCategories(DEFAULT_INCOME_CATEGORIES);
  saveStoredExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
  saveUserProfile(DEFAULT_USER_PROFILE);
}
