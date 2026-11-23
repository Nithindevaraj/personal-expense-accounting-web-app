import type { Transaction } from '../types';

/**
 * Formats a number into Indian Rupee format (e.g. ₹1,25,000.00)
 */
export function formatINR(amount: number, showDecimals: boolean = true): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹0.00';
  }

  const sign = amount < 0 ? '-' : '';
  const absAmount = Math.abs(amount);

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(absAmount);

  return sign ? `-${formatted}` : formatted;
}

/**
 * Formats YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

/**
 * Formats date into readable month string e.g. "Nov 2026"
 */
export function formatMonthYear(dateString: string): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/**
 * Returns today's date in YYYY-MM-DD
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Exports transactions to CSV matching Google Sheet format:
 * Sl.No,Date,income/expense,type of income/expense,Amount,Tags,Description or Remarks,Attachments,Notes
 */
export function transactionsToCSV(transactions: Transaction[]): string {
  const headers = [
    'Sl.No',
    'Date',
    'income/expense',
    'type of income/expense',
    'Amount',
    'Tags',
    'Description or Remarks',
    'Attachments',
    'Notes',
  ];

  const rows = transactions.map((t, idx) => {
    return [
      String(t.slNo || idx + 1),
      t.date || '',
      t.type || '',
      escapeCSVValue(t.category || ''),
      String(t.amount || 0),
      escapeCSVValue(t.tag || ''),
      escapeCSVValue(t.description || ''),
      escapeCSVValue((t.attachments || []).join('; ')),
      escapeCSVValue(t.notes || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parses CSV string back into Transactions
 */
export function parseCSVToTransactions(csvContent: string): Partial<Transaction>[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const parsedRows: string[][] = [];
  for (const line of lines) {
    parsedRows.push(parseCSVLine(line));
  }

  const dataRows = parsedRows.slice(1);
  const transactions: Partial<Transaction>[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cols = dataRows[i];
    if (cols.length < 3) continue;

    const slNo = parseInt(cols[0], 10) || i + 1;
    let date = cols[1] ? cols[1].trim() : '';

    // Handle DD/MM/YYYY conversion if needed
    if (date.includes('/')) {
      const p = date.split('/');
      if (p.length === 3) {
        // Assume DD/MM/YYYY or YYYY/MM/DD
        if (p[0].length === 4) {
          date = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
        } else {
          date = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
      }
    }

    const typeRaw = cols[2] ? cols[2].trim().toLowerCase() : '';
    const type = typeRaw.includes('income') ? 'Income' : 'Expense';
    const category = cols[3] ? cols[3].trim() : 'Miscellaneous';
    const amount = parseFloat(cols[4]?.replace(/[₹,$\s]/g, '') || '0') || 0;
    const tag = cols[5] ? cols[5].trim() : 'Project Alpha';
    const description = cols[6] ? cols[6].trim() : '';
    const attachments = cols[7] ? cols[7].split(';').map(s => s.trim()).filter(Boolean) : [];
    const notes = cols[8] ? cols[8].trim() : '';

    transactions.push({
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      slNo,
      date: date || getTodayString(),
      type,
      category,
      amount,
      tag,
      description,
      attachments,
      notes,
      createdAt: Date.now(),
    });
  }

  return transactions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
