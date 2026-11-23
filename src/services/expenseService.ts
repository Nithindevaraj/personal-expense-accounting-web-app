import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Transaction } from '../types';
import {
  getStoredTransactions,
  saveStoredTransactions,
} from '../utils/storage';

export interface DbExpenseRow {
  id: string;
  user_id?: string;
  sl_no: number | null;
  date: string;
  type: 'Income' | 'Expense';
  category: string;
  amount: number;
  tag: string | null;
  description: string;
  notes: string | null;
  attachments: string[] | null;
  created_at: string;
  updated_at?: string;
}

// Convert DB row to frontend Transaction object
export function mapRowToTransaction(row: DbExpenseRow): Transaction {
  return {
    id: row.id,
    slNo: row.sl_no ?? 1,
    date: row.date,
    type: row.type,
    category: row.category,
    amount: Number(row.amount),
    tag: row.tag || 'Personal',
    description: row.description || '',
    attachments: row.attachments || [],
    notes: row.notes || '',
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

// Convert frontend Transaction data to DB payload
export function mapTransactionToPayload(tx: Omit<Transaction, 'id' | 'createdAt'>) {
  return {
    sl_no: tx.slNo,
    date: tx.date,
    type: tx.type,
    category: tx.category,
    amount: tx.amount,
    tag: tx.tag || 'Personal',
    description: tx.description || '',
    notes: tx.notes || '',
    attachments: tx.attachments || [],
  };
}

/**
 * Fetch user's expenses ordered by date descending.
 * PostgreSQL Row-Level Security automatically filters rows where user_id = auth.uid()
 */
export async function getExpenses(): Promise<Transaction[]> {
  if (!isSupabaseConfigured) {
    return getStoredTransactions();
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Failed to fetch expenses from Supabase:', error.message);
    // Fallback to local storage on error
    return getStoredTransactions();
  }

  const transactions = (data as DbExpenseRow[]).map(mapRowToTransaction);
  // Cache to localStorage for offline fallback
  saveStoredTransactions(transactions);
  return transactions;
}

/**
 * Insert a new expense row into Supabase.
 * RLS automatically assigns auth.uid() as user_id.
 */
export async function addExpense(
  txData: Omit<Transaction, 'id' | 'createdAt'>
): Promise<Transaction> {
  if (!isSupabaseConfigured) {
    const localTx: Transaction = {
      ...txData,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
    };
    const current = getStoredTransactions();
    const updated = [localTx, ...current];
    saveStoredTransactions(updated);
    return localTx;
  }

  const payload = mapTransactionToPayload(txData);

  const { data, error } = await supabase
    .from('expenses')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Failed to add expense to Supabase:', error.message);
    throw new Error(error.message);
  }

  return mapRowToTransaction(data as DbExpenseRow);
}

/**
 * Update an existing expense row by ID in Supabase.
 */
export async function updateExpense(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
): Promise<Transaction | null> {
  if (!isSupabaseConfigured) {
    const current = getStoredTransactions();
    const updated = current.map((t) => (t.id === id ? { ...t, ...updates } : t));
    saveStoredTransactions(updated);
    return updated.find((t) => t.id === id) || null;
  }

  const payload: Record<string, unknown> = {};
  if (updates.slNo !== undefined) payload.sl_no = updates.slNo;
  if (updates.date !== undefined) payload.date = updates.date;
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.tag !== undefined) payload.tag = updates.tag;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.attachments !== undefined) payload.attachments = updates.attachments;

  const { data, error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update expense in Supabase:', error.message);
    throw new Error(error.message);
  }

  return mapRowToTransaction(data as DbExpenseRow);
}

/**
 * Delete an expense by ID in Supabase.
 */
export async function deleteExpense(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const current = getStoredTransactions();
    const updated = current.filter((t) => t.id !== id);
    saveStoredTransactions(updated);
    return true;
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete expense from Supabase:', error.message);
    throw new Error(error.message);
  }

  return true;
}

/**
 * Batch delete multiple expenses by IDs in Supabase.
 */
export async function batchDeleteExpenses(ids: string[]): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const idSet = new Set(ids);
    const current = getStoredTransactions();
    const updated = current.filter((t) => !idSet.has(t.id));
    saveStoredTransactions(updated);
    return true;
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('Failed to batch delete expenses from Supabase:', error.message);
    throw new Error(error.message);
  }

  return true;
}
