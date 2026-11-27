import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Transaction } from '../types';
import {
  getStoredTransactions,
  saveStoredTransactions,
} from '../utils/storage';

export interface DbExpenseRow {
  id: string;
  user_id?: string;
  company_id?: string;
  account_id?: string;
  sl_no: number | null;
  date: string;
  type: 'Income' | 'Expense';
  category: string;
  amount: number;
  tag: string | null;
  sub_tag?: string | null;
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
    tag: row.tag || 'General Transactions',
    subTag: row.sub_tag || null,
    description: row.description || '',
    attachments: row.attachments || [],
    notes: row.notes || '',
    createdByUserId: row.user_id || undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

// Convert frontend Transaction data to DB payload
export function mapTransactionToPayload(
  tx: Omit<Transaction, 'id' | 'createdAt'>,
  accountId: string = 'default'
) {
  return {
    sl_no: tx.slNo,
    date: tx.date,
    type: tx.type,
    category: tx.category,
    amount: tx.amount,
    tag: tx.tag || 'General Transactions',
    sub_tag: tx.subTag || null,
    description: tx.description || '',
    notes: tx.notes || '',
    attachments: tx.attachments || [],
    company_id: accountId,
  };
}

const inFlightTempIds = new Set<string>();
let activeGetExpensesPromise: Promise<Transaction[]> | null = null;

export function markTxInFlight(tempId: string): void {
  inFlightTempIds.add(tempId);
}

export function clearTxInFlight(tempId: string): void {
  inFlightTempIds.delete(tempId);
}

/**
 * Fetch user's expenses ordered by date descending.
 * PostgreSQL Row-Level Security automatically filters rows where user_id = auth.uid()
 */
export async function getExpenses(accountId: string = 'default'): Promise<Transaction[]> {
  if (!isSupabaseConfigured) {
    return getStoredTransactions(accountId);
  }

  if (activeGetExpensesPromise) {
    return activeGetExpensesPromise;
  }

  activeGetExpensesPromise = (async () => {
    try {
      // Push only truly stale/offline local transactions (skip any currently being uploaded)
      const localTxs = getStoredTransactions(accountId);
      const pendingLocal = localTxs.filter(
        (t) =>
          (t.id.startsWith('tx-temp-') || t.id.startsWith('tx-')) &&
          !inFlightTempIds.has(t.id)
      );
      if (pendingLocal.length > 0) {
        for (const pending of pendingLocal) {
          inFlightTempIds.add(pending.id);
          try {
            const { id: _id, createdAt: _createdAt, ...payload } = pending;
            await addExpense(payload, accountId);
            // Remove this pending temp item from localStorage immediately so it can't be re-uploaded
            const latestLocal = getStoredTransactions(accountId).filter((t) => t.id !== pending.id);
            saveStoredTransactions(latestLocal, accountId);
          } catch (err) {
            console.warn('Could not sync pending local transaction:', err);
          } finally {
            inFlightTempIds.delete(pending.id);
          }
        }
      }

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .or(`company_id.eq.${accountId},account_id.eq.${accountId}`)
        .order('date', { ascending: false });

      if (error) {
        console.error('Failed to fetch expenses from Supabase:', error.message);
        // Fallback to local storage on error
        return getStoredTransactions(accountId);
      }

      const transactions = (data as DbExpenseRow[]).map(mapRowToTransaction);

      // Preserve any in-flight optimistic transactions not yet returned by Supabase
      // Compound key deduplication prevents temporary transactions from duplicating
      // when a concurrent real-time broadcast arrives before addExpense completes.
      const localStored = getStoredTransactions(accountId);
      const stillInFlight = localStored.filter((local) => {
        if (!inFlightTempIds.has(local.id)) return false;
        // Check if incoming server transactions already contain this transaction by compound key
        const alreadyPresentOnServer = transactions.some(
          (serverTx) =>
            serverTx.date === local.date &&
            serverTx.amount === local.amount &&
            serverTx.type === local.type &&
            serverTx.category === local.category &&
            (local.slNo ? serverTx.slNo === local.slNo : true)
        );
        return !alreadyPresentOnServer;
      });

      const merged = [...stillInFlight, ...transactions];
      // Cache to localStorage for offline fallback
      saveStoredTransactions(merged, accountId);
      return merged;
    } finally {
      activeGetExpensesPromise = null;
    }
  })();

  return activeGetExpensesPromise;
}

/**
 * Insert a new expense row into Supabase.
 * RLS automatically assigns auth.uid() as user_id.
 */
export async function addExpense(
  txData: Omit<Transaction, 'id' | 'createdAt'>,
  accountId: string = 'default'
): Promise<Transaction> {
  if (!isSupabaseConfigured) {
    const localTx: Transaction = {
      ...txData,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
    };
    const current = getStoredTransactions(accountId);
    const updated = [localTx, ...current];
    saveStoredTransactions(updated, accountId);
    return localTx;
  }

  const payload = mapTransactionToPayload(txData, accountId);

  let { data, error } = await supabase
    .from('expenses')
    .insert([payload])
    .select()
    .single();

  if (error && error.message.toLowerCase().includes('sub_tag')) {
    const { sub_tag: _ignored, ...fallbackPayload } = payload;
    const retry = await supabase
      .from('expenses')
      .insert([fallbackPayload])
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

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
  if (updates.subTag !== undefined) payload.sub_tag = updates.subTag || null;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.attachments !== undefined) payload.attachments = updates.attachments;

  let { data, error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error && error.message.toLowerCase().includes('sub_tag')) {
    const { sub_tag: _ignored, ...fallbackPayload } = payload;
    const retry = await supabase
      .from('expenses')
      .update(fallbackPayload)
      .eq('id', id)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

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
