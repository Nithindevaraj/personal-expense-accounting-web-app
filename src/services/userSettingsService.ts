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

  const { data, error } = await supabase
    .from('user_settings')
    .select('accounts')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch accounts from Supabase:', error.message);
    return getStoredAccounts();
  }

  const cloudAccounts = Array.isArray((data as { accounts?: unknown } | null)?.accounts)
    ? ((data as { accounts: Account[] }).accounts).filter(
        (a) => !(a.id === 'default' && a.name === 'Demo company')
      )
    : [];

  // Reconcile and validate non-owned company memberships:
  // If this user does not own a company, verify that the company's owner still lists them in team_members
  const verifiedAccounts: Account[] = [];
  let accountsPruned = false;

  for (const acc of cloudAccounts) {
    // If the user is the creator/owner, they always retain their company
    if (!acc.ownerId || acc.ownerId === user.id) {
      verifiedAccounts.push(acc);
      continue;
    }

    // Check if the company owner still has this user in their team_members roster
    try {
      const { data: ownerSettings } = await supabase
        .from('user_settings')
        .select('team_members')
        .eq('user_id', acc.ownerId)
        .maybeSingle();

      const ownerTeams = Array.isArray(
        (ownerSettings as { team_members?: unknown } | null)?.team_members
      )
        ? ((ownerSettings as { team_members: TeamMember[] }).team_members)
        : [];

      const stillMember = ownerTeams.some(
        (m) => m.accountId === acc.id && (m.userId === user.id || m.userLink.includes(user.id))
      );

      if (stillMember) {
        verifiedAccounts.push(acc);
      } else {
        // Membership was revoked by the admin!
        accountsPruned = true;
      }
    } catch {
      // If network fails to verify, keep account to avoid spurious removal
      verifiedAccounts.push(acc);
    }
  }

  if (accountsPruned) {
    void saveAccountsToSupabase(verifiedAccounts);
  }

  saveStoredAccounts(verifiedAccounts);
  return verifiedAccounts;
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
