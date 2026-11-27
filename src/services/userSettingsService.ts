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

  const verifiedMap = new Map<string, Account>();

  // 1. Fetch companies created by the user directly from public.companies
  try {
    const { data: createdCompanies, error: compErr } = await supabase
      .from('companies')
      .select('id, name, company_code, creator_id, created_at')
      .eq('creator_id', user.id);

    if (!compErr && Array.isArray(createdCompanies)) {
      for (const comp of createdCompanies) {
        verifiedMap.set(comp.id, {
          id: comp.id,
          name: comp.name,
          companyCode: comp.company_code,
          ownerId: comp.creator_id,
          createdAt: comp.created_at ? new Date(comp.created_at).getTime() : Date.now(),
        });
      }
    }
  } catch (err) {
    console.error('Error fetching created companies from Supabase:', err);
  }

  // 1b. Load company divisions from public.company_divisions
  try {
    const { data: divRows, error: divErr } = await Promise.race([
      supabase.from('company_divisions').select('company_id, name'),
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 4000)
      ),
    ]);

    if (!divErr && Array.isArray(divRows) && divRows.length > 0) {
      const divisionsByCompany = new Map<string, string[]>();
      for (const row of divRows) {
        if (!row.company_id || !row.name) continue;
        const list = divisionsByCompany.get(row.company_id) || [];
        if (!list.includes(row.name)) {
          list.push(row.name);
          divisionsByCompany.set(row.company_id, list);
        }
      }
      for (const [companyId, divs] of divisionsByCompany.entries()) {
        const existing = verifiedMap.get(companyId);
        if (existing) {
          existing.divisions = divs;
        }
      }
    }
  } catch (err) {
    console.error('Error fetching company divisions from Supabase:', err);
  }

  // 2. Discover participating company memberships from public.company_members
  try {
    const { data: memberRows, error: memberErr } = await supabase
      .from('company_members')
      .select(`
        company_id,
        role,
        companies:company_id (id, name, company_code, creator_id, created_at)
      `)
      .or(`user_id.eq.${user.id},member_code.eq.${currentCode},member_code.eq.${strippedCurrentCode}`);

    if (!memberErr && Array.isArray(memberRows) && memberRows.length > 0) {
      for (const row of memberRows) {
        // Handle joined company row or flat company_id
        const comp = row.companies as unknown as { id: string; name: string; company_code?: string; creator_id?: string; created_at?: string } | null;
        if (comp && comp.id && !verifiedMap.has(comp.id)) {
          verifiedMap.set(comp.id, {
            id: comp.id,
            name: comp.name,
            companyCode: comp.company_code,
            ownerId: comp.creator_id,
            createdAt: comp.created_at ? new Date(comp.created_at).getTime() : Date.now(),
          });
        }
      }
    }
  } catch (err) {
    console.error('Error querying company_members from Supabase:', err);
  }

  // 3. Fallback: Check user_settings table for legacy cached accounts
  try {
    const { data: ownData } = await supabase
      .from('user_settings')
      .select('accounts')
      .eq('user_id', user.id)
      .maybeSingle();

    const ownAccounts = Array.isArray((ownData as { accounts?: unknown } | null)?.accounts)
      ? ((ownData as { accounts: Account[] }).accounts).filter(
          (a) => !(a.id === 'default' && a.name === 'Demo company')
        )
      : [];

    for (const acc of ownAccounts) {
      if (!verifiedMap.has(acc.id) && (!acc.ownerId || acc.ownerId === user.id)) {
        verifiedMap.set(acc.id, acc);
      } else if (verifiedMap.has(acc.id) && Array.isArray(acc.divisions) && (!verifiedMap.get(acc.id)!.divisions || verifiedMap.get(acc.id)!.divisions!.length === 0)) {
        verifiedMap.get(acc.id)!.divisions = acc.divisions;
      }
    }
  } catch {
    // ignore fallback error
  }

  // Merge local accounts (guarantee no locally created companies are dropped)
  const localAccounts = getStoredAccounts();
  for (const loc of localAccounts) {
    if (!verifiedMap.has(loc.id)) {
      if (!loc.ownerId || loc.ownerId === user.id) {
        verifiedMap.set(loc.id, loc);
      }
    } else if (verifiedMap.has(loc.id) && Array.isArray(loc.divisions) && (!verifiedMap.get(loc.id)!.divisions || verifiedMap.get(loc.id)!.divisions!.length === 0)) {
      verifiedMap.get(loc.id)!.divisions = loc.divisions;
    }
  }

  const finalAccounts = Array.from(verifiedMap.values());

  // Only persist back to Supabase if we have valid accounts or verified from ownAccounts
  if (finalAccounts.length > 0) {
    saveStoredAccounts(finalAccounts);
    // Background async sync so we do not block or loop getAccountsFromSupabase caller
    setTimeout(() => {
      void saveAccountsToSupabase(finalAccounts);
    }, 0);
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
            ...(acc.companyCode ? { company_code: acc.companyCode } : {}),
            updated_at: new Date().toISOString(),
          },
        ], { onConflict: 'id' });

        // Sync divisions to public.company_divisions
        if (Array.isArray(acc.divisions)) {
          // Clean removed divisions & upsert active ones
          const { data: existingDivs } = await Promise.race([
            supabase
              .from('company_divisions')
              .select('id, name')
              .eq('company_id', acc.id),
            new Promise<{ data: null }>((resolve) =>
              setTimeout(() => resolve({ data: null }), 3000)
            ),
          ]);

          const existingNames = new Set((existingDivs || []).map((d) => d.name));
          const currentDivs = new Set(acc.divisions);

          // Delete divisions no longer in account
          for (const d of (existingDivs || [])) {
            if (!currentDivs.has(d.name)) {
              await supabase.from('company_divisions').delete().eq('id', d.id);
            }
          }

          // Insert newly added divisions
          for (const divName of acc.divisions) {
            if (!existingNames.has(divName)) {
              await supabase.from('company_divisions').insert([
                {
                  company_id: acc.id,
                  name: divName,
                },
              ]);
            }
          }
        }
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

export async function saveTeamMembersToSupabase(members: TeamMember[], _companyName?: string): Promise<void> {
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
    if (members.length > 0) {
      for (const m of members) {
        const cleanCode = (m.userLink || m.userId).replace(/[\s-]/g, '');
        // Resolve profile id from user_code or member_code
        const { data: matchedProfile } = await supabase
          .from('profiles')
          .select('id, name')
          .or(`user_code.eq.${m.userLink},user_code.eq.${cleanCode},id.eq.${m.userId}`)
          .maybeSingle();

        const resolvedUserId = matchedProfile?.id || (m.userId.includes('-') && m.userId.length === 36 ? m.userId : null);

        if (resolvedUserId) {
          await supabase.from('company_members').upsert([
            {
              company_id: m.accountId,
              user_id: resolvedUserId,
              member_code: cleanCode.length === 16 ? m.userLink || m.userId : m.userId,
              name: m.name || matchedProfile?.name || 'Team Member',
              designation: m.designation || 'Member',
              role: m.role || 'spender',
            },
          ], { onConflict: 'company_id,user_id' });
        }
      }
    }
  } catch (err) {
    console.error('Error syncing company_members to Supabase:', err);
  }
}
