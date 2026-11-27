import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  type Account,
  type RecurringTransaction,
  type TeamMember,
  DEFAULT_ACCOUNTS,
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
  const localAccounts = getStoredAccounts();
  if (!isSupabaseConfigured) return localAccounts;

  const { data, error } = await supabase
    .from('user_settings')
    .select('accounts')
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch accounts from Supabase:', error.message);
    return localAccounts;
  }

  const cloudAccounts = Array.isArray((data as { accounts?: unknown } | null)?.accounts)
    ? ((data as { accounts: Account[] }).accounts)
    : [];

  if (cloudAccounts.length === 0) {
    await saveAccountsToSupabase(localAccounts.length > 0 ? localAccounts : DEFAULT_ACCOUNTS);
    return localAccounts;
  }

  saveStoredAccounts(cloudAccounts);
  return cloudAccounts;
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
  const localMembers = getStoredTeamMembers();
  if (!isSupabaseConfigured) return localMembers;

  const { data, error } = await supabase
    .from('user_settings')
    .select('team_members')
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch team members from Supabase:', error.message);
    return localMembers;
  }

  const cloudMembers = Array.isArray(
    (data as { team_members?: unknown } | null)?.team_members
  )
    ? ((data as { team_members: TeamMember[] }).team_members)
    : [];

  if (cloudMembers.length === 0 && localMembers.length > 0) {
    await saveTeamMembersToSupabase(localMembers);
    return localMembers;
  }

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
