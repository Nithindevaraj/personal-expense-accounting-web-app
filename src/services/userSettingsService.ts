import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  type Account,
  type RecurringTransaction,
  type TeamMember,
} from '../types';
import {
  getStoredAccounts,
  getStoredExpenseCategories,
  getStoredIncomeCategories,
  getStoredRecurringTransactions,
  getStoredTeamMembers,
  saveStoredAccounts,
  saveStoredExpenseCategories,
  saveStoredIncomeCategories,
  saveStoredRecurringTransactions,
  saveStoredTeamMembers,
} from '../utils/storage';

interface DbUserSettingsRow {
  user_id: string;
  income_categories: string[] | null;
  expense_categories: string[] | null;
}

export interface CloudCategories {
  incomeCategories: string[];
  expenseCategories: string[];
}

export async function getCategoriesFromSupabase(): Promise<CloudCategories> {
  const localIncome = getStoredIncomeCategories();
  const localExpense = getStoredExpenseCategories();

  if (!isSupabaseConfigured) {
    return { incomeCategories: localIncome, expenseCategories: localExpense };
  }

  try {
    if (localStorage.getItem('personal_accounting_cat_cloud_v3') !== '1') {
      await saveCategoriesToSupabase({
        incomeCategories: localIncome,
        expenseCategories: localExpense,
      });
      localStorage.setItem('personal_accounting_cat_cloud_v3', '1');
      return { incomeCategories: localIncome, expenseCategories: localExpense };
    }
  } catch {
    // ignore storage errors
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id, income_categories, expense_categories')
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user_settings from Supabase:', error.message);
    return { incomeCategories: localIncome, expenseCategories: localExpense };
  }

  const row = data as DbUserSettingsRow | null;
  const cloudIncome = Array.isArray(row?.income_categories) ? row.income_categories : [];
  const cloudExpense = Array.isArray(row?.expense_categories) ? row.expense_categories : [];

  if (!row || (cloudIncome.length === 0 && cloudExpense.length === 0)) {
    await saveCategoriesToSupabase({
      incomeCategories: localIncome,
      expenseCategories: localExpense,
    });
    return { incomeCategories: localIncome, expenseCategories: localExpense };
  }

  const finalIncome = cloudIncome.length > 0 ? cloudIncome : localIncome;
  const finalExpense = cloudExpense.length > 0 ? cloudExpense : localExpense;

  saveStoredIncomeCategories(finalIncome);
  saveStoredExpenseCategories(finalExpense);

  return {
    incomeCategories: finalIncome,
    expenseCategories: finalExpense,
  };
}

export async function saveCategoriesToSupabase(updates: {
  incomeCategories?: string[];
  expenseCategories?: string[];
}): Promise<void> {
  if (!isSupabaseConfigured) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const payload: Record<string, unknown> = {
    user_id: user.id,
  };
  if (updates.incomeCategories !== undefined) {
    payload.income_categories = updates.incomeCategories;
  }
  if (updates.expenseCategories !== undefined) {
    payload.expense_categories = updates.expenseCategories;
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert([payload], { onConflict: 'user_id' });

  if (error) {
    console.error('Failed to save categories to Supabase:', error.message);
  }
}

export async function getAccountsFromSupabase(): Promise<Account[]> {
  if (!isSupabaseConfigured) return getStoredAccounts();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return getStoredAccounts();

  // 1. Fetch current user's own settings (contains companies they created/own)
  const { data: ownData, error: ownError } = await supabase
    .from('user_settings')
    .select('accounts')
    .eq('user_id', user.id)
    .maybeSingle();

  if (ownError) {
    console.error('Failed to fetch accounts from Supabase:', ownError.message);
  }

  const ownAccounts = Array.isArray((ownData as { accounts?: unknown } | null)?.accounts)
    ? ((ownData as { accounts: Account[] }).accounts).filter(
        (a) => !(a.id === 'default' && a.name === 'Demo company')
      )
    : [];

  const verifiedMap = new Map<string, Account>();
  for (const acc of ownAccounts) {
    if (!acc.ownerId || acc.ownerId === user.id) {
      verifiedMap.set(acc.id, acc);
    }
  }

  // 2. Discover all companies across Supabase where this user is actively listed as a team member
  try {
    const { data: allSettings, error: allErr } = await supabase
      .from('user_settings')
      .select('user_id, accounts, team_members');

    if (!allErr && Array.isArray(allSettings)) {
      for (const row of allSettings) {
        // Skip user's own row as it was handled above
        if (row.user_id === user.id) continue;

        const ownerTeams = Array.isArray(row.team_members) ? (row.team_members as TeamMember[]) : [];
        const ownerAccounts = Array.isArray(row.accounts) ? (row.accounts as Account[]) : [];

        // Check if any team member entry matches the current user
        const memberships = ownerTeams.filter(
          (m) => m.userId === user.id || (m.userLink && m.userLink.includes(user.id))
        );

        for (const membership of memberships) {
          const matchingCompany = ownerAccounts.find((a) => a.id === membership.accountId);
          if (matchingCompany && !verifiedMap.has(matchingCompany.id)) {
            verifiedMap.set(matchingCompany.id, matchingCompany);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error discovering company memberships from Supabase:', err);
  }

  const finalAccounts = Array.from(verifiedMap.values());

  // Save the verified list to local storage and sync to user's settings row
  saveStoredAccounts(finalAccounts);
  void saveAccountsToSupabase(finalAccounts);

  return finalAccounts;
}

export async function saveAccountsToSupabase(accounts: Account[]): Promise<void> {
  if (!isSupabaseConfigured) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('user_settings')
    .upsert([{ user_id: user.id, accounts }], { onConflict: 'user_id' });

  if (error) {
    console.error('Failed to save accounts to Supabase:', error.message);
  }
}

export async function getRecurringFromSupabase(): Promise<RecurringTransaction[]> {
  const localRecurring = getStoredRecurringTransactions();
  if (!isSupabaseConfigured) return localRecurring;

  const { data, error } = await supabase
    .from('user_settings')
    .select('recurring_transactions')
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch recurring transactions from Supabase:', error.message);
    return localRecurring;
  }

  const cloudRecurring = Array.isArray(
    (data as { recurring_transactions?: unknown } | null)?.recurring_transactions
  )
    ? ((data as { recurring_transactions: RecurringTransaction[] }).recurring_transactions)
    : [];

  if (cloudRecurring.length === 0 && localRecurring.length > 0) {
    await saveRecurringToSupabase(localRecurring);
    return localRecurring;
  }

  saveStoredRecurringTransactions(cloudRecurring);
  return cloudRecurring;
}

export async function saveRecurringToSupabase(items: RecurringTransaction[]): Promise<void> {
  if (!isSupabaseConfigured) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('user_settings')
    .upsert([{ user_id: user.id, recurring_transactions: items }], {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Failed to save recurring transactions to Supabase:', error.message);
  }
}

export async function getTeamMembersFromSupabase(): Promise<TeamMember[]> {
  if (!isSupabaseConfigured) return getStoredTeamMembers();

  const { data, error } = await supabase
    .from('user_settings')
    .select('team_members')
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch team members from Supabase:', error.message);
    return getStoredTeamMembers();
  }

  const cloudMembers = Array.isArray(
    (data as { team_members?: unknown } | null)?.team_members
  )
    ? ((data as { team_members: TeamMember[] }).team_members)
    : [];

  // Supabase is the single source of truth for team members
  saveStoredTeamMembers(cloudMembers);
  return cloudMembers;
}

export async function saveTeamMembersToSupabase(members: TeamMember[]): Promise<void> {
  if (!isSupabaseConfigured) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('user_settings')
    .upsert([{ user_id: user.id, team_members: members }], {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Failed to save team members to Supabase:', error.message);
  }
}
