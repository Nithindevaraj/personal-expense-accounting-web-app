import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  getStoredExpenseCategories,
  getStoredIncomeCategories,
  saveStoredExpenseCategories,
  saveStoredIncomeCategories,
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
    if (localStorage.getItem('personal_accounting_cat_cloud_v2') !== '1') {
      await saveCategoriesToSupabase({
        incomeCategories: localIncome,
        expenseCategories: localExpense,
      });
      localStorage.setItem('personal_accounting_cat_cloud_v2', '1');
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
