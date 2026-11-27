import {
  type Account,
  type RecurringTransaction,
  type TeamMember,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_ACCOUNTS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
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
  RECURRING: 'personal_accounting_recurring_v1',
  TEAMS: 'personal_accounting_teams_v1',
  LOCAL_USER_ID: 'personal_accounting_local_user_id_v1',
};

export function getOrCreateLocalUserId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.LOCAL_USER_ID);
    if (existing) return existing;
    const generated = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(STORAGE_KEYS.LOCAL_USER_ID, generated);
    return generated;
  } catch {
    return 'usr-local';
  }
}

export function buildIndividualUserCode(userId: string): string {
  if (!userId) return '0000-0000-0000-0000';
  const clean = userId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash1 = (hash1 * 31 + char) % 100000000;
    hash2 = (hash2 * 37 + char) % 100000000;
  }
  const part1 = String(Math.abs(hash1)).padStart(8, '4');
  const part2 = String(Math.abs(hash2)).padStart(8, '7');
  const raw16 = (part1 + part2).slice(0, 16);
  return `${raw16.slice(0, 4)}-${raw16.slice(4, 8)}-${raw16.slice(8, 12)}-${raw16.slice(12, 16)}`;
}

export function buildIndividualUserLink(userId: string, _name?: string): string {
  return buildIndividualUserCode(userId);
}

export function parseIndividualUserLink(rawInput: string): {
  userId: string;
  name?: string;
  userLink: string;
} {
  const trimmed = rawInput.trim();

  // Case 1: Legacy full URL with query parameters (?member=...&name=...)
  try {
    const url = new URL(trimmed);
    const memberId = url.searchParams.get('member')?.trim();
    const memberName = url.searchParams.get('name')?.trim() || undefined;
    if (memberId) {
      return {
        userId: memberId,
        name: memberName,
        userLink: buildIndividualUserCode(memberId),
      };
    }
  } catch {
    // Not a full URL
  }

  // Case 2: Clean 16-digit code entered by admin (e.g. "2554-5263-7545-2851" or "2554526375452851")
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  if (digitsOnly.length === 16) {
    const formattedCode = `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 8)}-${digitsOnly.slice(8, 12)}-${digitsOnly.slice(12, 16)}`;
    return {
      userId: formattedCode,
      userLink: formattedCode,
    };
  }

  // Case 3: Raw UUID / Alphanumeric user ID (hash it to 16 digits)
  return {
    userId: trimmed,
    userLink: buildIndividualUserCode(trimmed),
  };
}

export function getStoredTeamMembers(): TeamMember[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TEAMS);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredTeamMembers(members: TeamMember[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(members));
  } catch (err) {
    console.error('Error saving team members:', err);
  }
}

export function getStoredRecurringTransactions(): RecurringTransaction[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECURRING);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredRecurringTransactions(items: RecurringTransaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify(items));
  } catch (err) {
    console.error('Error saving recurring transactions:', err);
  }
}

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
    if (!Array.isArray(parsed)) return DEFAULT_ACCOUNTS;
    return parsed.filter(
      (a: Account) => !(a.id === DEFAULT_ACCOUNT_ID && a.name === 'Demo company')
    );
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
