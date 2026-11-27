import {
  type Account,
  type RecurringTransaction,
  type TeamMember,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  createDefaultProjectsForAccount,
  type Project,
  type Transaction,
} from '../types';

export interface UserProfile {
  name: string;
  currency: string;
  avatar?: string;
  email?: string;
  bio?: string;
}

// In-Memory cache (zero localStorage - all persistence backed by Supabase Cloud)
const memoryCache = {
  accounts: [] as Account[],
  activeAccountId: '',
  transactions: new Map<string, Transaction[]>(),
  projects: new Map<string, Project[]>(),
  incomeCategories: [...DEFAULT_INCOME_CATEGORIES],
  expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
  userProfile: {
    name: '',
    currency: 'INR',
    email: '',
  } as UserProfile,
  recurring: [] as RecurringTransaction[],
  teams: [] as TeamMember[],
};

export function getOrCreateLocalUserId(): string {
  return 'usr-anon';
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
  const part1 = String(Math.abs(hash1)).padStart(8, '0');
  const part2 = String(Math.abs(hash2)).padStart(8, '0');
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

  // Case 2: Clean 16-digit code (e.g. "2554-5263-7545-2851" or "2554526375452851")
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
  return memoryCache.teams;
}

export function saveStoredTeamMembers(members: TeamMember[]): void {
  memoryCache.teams = members;
}

export function getStoredRecurringTransactions(): RecurringTransaction[] {
  return memoryCache.recurring;
}

export function saveStoredRecurringTransactions(recurring: RecurringTransaction[]): void {
  memoryCache.recurring = recurring;
}

const ACCOUNTS_STORAGE_KEY = 'accounting_stored_accounts_cache';

export function getStoredAccounts(): Account[] {
  if (memoryCache.accounts && memoryCache.accounts.length > 0) {
    return memoryCache.accounts;
  }
  try {
    const saved = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache.accounts = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore localStorage errors in private browsing
  }
  return memoryCache.accounts;
}

export function saveStoredAccounts(accounts: Account[]): void {
  memoryCache.accounts = accounts;
  try {
    if (accounts && accounts.length > 0) {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    } else {
      localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

const ACTIVE_ACCOUNT_KEY = 'accounting_active_account_id';

export function getActiveAccountId(): string {
  if (memoryCache.activeAccountId) return memoryCache.activeAccountId;
  try {
    const saved = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (saved) {
      memoryCache.activeAccountId = saved;
      return saved;
    }
  } catch {
    // ignore localStorage errors in private browsing
  }
  return '';
}

export function saveActiveAccountId(accountId: string): void {
  memoryCache.activeAccountId = accountId;
  try {
    if (accountId) {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    } else {
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    }
  } catch {
    // ignore
  }
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: '',
  currency: 'INR',
  email: '',
};

export const SAMPLE_TRANSACTIONS: Transaction[] = [];

export function getStoredTransactions(accountId: string = ''): Transaction[] {
  return memoryCache.transactions.get(accountId) || [];
}

export function saveStoredTransactions(
  transactions: Transaction[],
  accountId: string = ''
): void {
  memoryCache.transactions.set(accountId, transactions);
}

export function getStoredProjects(accountId: string = ''): Project[] {
  if (!memoryCache.projects.has(accountId)) {
    const def = createDefaultProjectsForAccount(accountId);
    memoryCache.projects.set(accountId, def);
    return def;
  }
  return memoryCache.projects.get(accountId) || [];
}

export function saveStoredProjects(
  projects: Project[],
  accountId: string = ''
): void {
  memoryCache.projects.set(accountId, projects);
}

export function getStoredIncomeCategories(): string[] {
  return memoryCache.incomeCategories;
}

export function saveStoredIncomeCategories(categories: string[]): void {
  memoryCache.incomeCategories = categories;
}

export function getStoredExpenseCategories(): string[] {
  return memoryCache.expenseCategories;
}

export function saveStoredExpenseCategories(categories: string[]): void {
  memoryCache.expenseCategories = categories;
}

export function getUserProfile(): UserProfile {
  return memoryCache.userProfile;
}

export function saveUserProfile(profile: UserProfile): void {
  memoryCache.userProfile = profile;
}

export function resetToDefaults(accountId: string = ''): void {
  memoryCache.transactions.set(accountId, []);
  memoryCache.projects.set(accountId, createDefaultProjectsForAccount(accountId));
  memoryCache.incomeCategories = [...DEFAULT_INCOME_CATEGORIES];
  memoryCache.expenseCategories = [...DEFAULT_EXPENSE_CATEGORIES];
  memoryCache.userProfile = { ...DEFAULT_USER_PROFILE };
}
