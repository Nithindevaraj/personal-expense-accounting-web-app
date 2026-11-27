import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  type Account,
  type RecurringTransaction,
  type TeamMember,
} from '../types';
import {
  buildIndividualUserCode,
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

  const currentCode = buildIndividualUserCode(user.id);
  const strippedCurrentCode = currentCode.replace(/[^0-9]/g, '');

  // 1. Fetch current user's own settings (contains companies they created/own)
  const { data: ownData, error: ownError } = await supabase
    .from('user_settings')
    .select('accounts')
    .eq('user_id', user.id)
    .maybeSingle();

  if (ownError) {
    console.error('Failed to fetch accounts from Supabase:', ownError.message);
    // CRITICAL FIX: If there is an error querying Supabase (network or RLS), NEVER overwrite with empty list!
    // Return the preserved local accounts.
    const localFallback = getStoredAccounts();
    if (localFallback.length > 0) {
      return localFallback;
    }
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

  // 2. Discover company memberships from public.company_members registry
  try {
    const { data: memberRows, error: memberErr } = await supabase
      .from('company_members')
      .select('*')
      .or(`member_code.eq.${currentCode},member_code.eq.${strippedCurrentCode},member_code.eq.${user.id}`);

    if (!memberErr && Array.isArray(memberRows) && memberRows.length > 0) {
      for (const row of memberRows) {
        if (!verifiedMap.has(row.company_id)) {
          verifiedMap.set(row.company_id, {
            id: row.company_id,
            name: row.company_name || 'Assigned Company',
            ownerId: row.owner_id,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          });
        }
      }
    }
  } catch {
    // If company_members table not yet migrated, fall back below
  }

  // 3. Fallback: Discover all companies across user_settings rows
  try {
    const { data: allSettings, error: allErr } = await supabase
      .from('user_settings')
      .select('user_id, accounts, team_members');

    if (!allErr && Array.isArray(allSettings)) {
      for (const row of allSettings) {
        if (row.user_id === user.id) continue;

        const ownerTeams = Array.isArray(row.team_members) ? (row.team_members as TeamMember[]) : [];
        const ownerAccounts = Array.isArray(row.accounts) ? (row.accounts as Account[]) : [];

        const memberships = ownerTeams.filter((m) => {
          const mUserId = (m.userId || '').trim();
          const mUserLink = (m.userLink || '').trim();
          const strippedMUser = mUserId.replace(/[^0-9]/g, '');
          const strippedMLink = mUserLink.replace(/[^0-9]/g, '');

          return (
            mUserId === user.id ||
            mUserId === currentCode ||
            (strippedMUser.length === 16 && strippedMUser === strippedCurrentCode) ||
            mUserLink === currentCode ||
            (strippedMLink.length === 16 && strippedMLink === strippedCurrentCode) ||
            mUserLink.includes(user.id)
          );
        });

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

  // Merge local accounts (guarantee no locally created companies are ever dropped)
  const localAccounts = getStoredAccounts();
  for (const loc of localAccounts) {
    if (!verifiedMap.has(loc.id)) {
      if (!loc.ownerId || loc.ownerId === user.id) {
        verifiedMap.set(loc.id, loc);
      }
    }
  }

  const finalAccounts = Array.from(verifiedMap.values());

  // Only persist back to Supabase if we have valid accounts or verified from ownAccounts
  if (finalAccounts.length > 0) {
    saveStoredAccounts(finalAccounts);
    void saveAccountsToSupabase(finalAccounts);
  } else if (localAccounts.length > 0) {
    return localAccounts;
  }

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

  // Also sync to public.companies table if table exists
  try {
    for (const acc of accounts) {
      if (acc.ownerId === user.id) {
        await supabase.from('companies').upsert([
          {
            id: acc.id,
            name: acc.name,
            creator_id: user.id,
            updated_at: new Date().toISOString(),
          },
        ], { onConflict: 'id' });
      }
    }
  } catch {
    // ignore if table not migrated yet
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

export async function saveTeamMembersToSupabase(members: TeamMember[], companyName?: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // 1. Save to user_settings
  const { error } = await supabase
    .from('user_settings')
    .upsert([{ user_id: user.id, team_members: members }], {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Failed to save team members to Supabase:', error.message);
  }

  // 2. Also register in public.company_members registry for cross-user discovery
  try {
    // Delete existing entries for this user's companies in company_members
    await supabase.from('company_members').delete().eq('owner_id', user.id);

    if (members.length > 0) {
      const rows = members.map((m) => {
        const cleanCode = (m.userLink || m.userId).replace(/[\s-]/g, '');
        return {
          company_id: m.accountId,
          company_name: companyName || '',
          owner_id: user.id,
          member_code: (cleanCode.length === 16 ? m.userLink || m.userId : m.userId),
          member_name: m.name || 'Team Member',
          role: m.role || 'spender',
        };
      });
      await supabase.from('company_members').insert(rows);
    }
  } catch {
    // Graceful fallback if company_members is pending SQL execution
  }
}
