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
    const category = cols[3] ? cols[3].trim() : 'Purchase';
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

/**
 * Generates an executive accounting statement and opens browser print / save-as-PDF dialog.
 */
export function exportTransactionsToPDF(
  transactions: Transaction[],
  userProfile?: { name?: string; currency?: string }
): void {
  const sorted = [...transactions].sort(
    (a, b) => (a.slNo || 0) - (b.slNo || 0) || a.date.localeCompare(b.date)
  );

  let totalIncome = 0;
  let totalExpense = 0;
  for (const t of sorted) {
    if (t.type === 'Income') totalIncome += t.amount;
    else totalExpense += t.amount;
  }
  const netBalance = totalIncome - totalExpense;
  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const rowsHtml = sorted
    .map(
      (t, idx) => `
    <tr>
      <td style="text-align: center; color: #64748b;">${t.slNo || idx + 1}</td>
      <td style="white-space: nowrap;">${formatDate(t.date)}</td>
      <td>
        <span class="badge ${t.type === 'Income' ? 'badge-income' : 'badge-expense'}">
          ${t.type}
        </span>
      </td>
      <td><strong>${escapeHtml(t.category || '-')}</strong></td>
      <td><span class="tag">${escapeHtml(t.tag || 'Personal')}</span></td>
      <td>${escapeHtml(t.description || '-')}</td>
      <td style="text-align: right; font-weight: bold; color: ${
        t.type === 'Income' ? '#059669' : '#e11d48'
      };">
        ${t.type === 'Income' ? '+' : '-'}${formatINR(t.amount)}
      </td>
    </tr>`
    )
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Personal_Accounting_Statement_${new Date().toISOString().split('T')[0]}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #059669;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .meta-box strong {
      color: #0f172a;
      font-size: 11px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .summary-label {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .summary-val {
      font-size: 14px;
      font-weight: 800;
      margin-top: 2px;
    }
    .text-income { color: #059669; }
    .text-expense { color: #e11d48; }
    .text-balance { color: ${netBalance >= 0 ? '#059669' : '#e11d48'}; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 7px 6px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
      text-align: left;
    }
    td {
      padding: 6px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 10px;
    }
    tr {
      page-break-inside: avoid;
    }
    tr:nth-child(even) {
      background-color: #fafafa;
    }
    .badge {
      display: inline-block;
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-income {
      background: #d1fae5;
      color: #065f46;
    }
    .badge-expense {
      background: #ffe4e6;
      color: #9f1239;
    }
    .tag {
      display: inline-block;
      background: #eff6ff;
      color: #1e40af;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 600;
    }
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Personal Accounting & Expense Statement</div>
      <div class="subtitle">Account Holder: ${escapeHtml(userProfile?.name || 'Personal')} &bull; Currency: ${userProfile?.currency || 'INR'}</div>
    </div>
    <div class="meta-box">
      <div>Generated On</div>
      <strong>${generatedDate}</strong>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Income</div>
      <div class="summary-val text-income">${formatINR(totalIncome)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Expense</div>
      <div class="summary-val text-expense">${formatINR(totalExpense)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Net Balance</div>
      <div class="summary-val text-balance">${formatINR(netBalance)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Entries</div>
      <div class="summary-val">${sorted.length}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th style="width: 75px;">Date</th>
        <th style="width: 65px;">Type</th>
        <th style="width: 110px;">Category</th>
        <th style="width: 85px;">Project</th>
        <th>Description</th>
        <th style="width: 90px; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8;">No transactions found.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <span>Personal Expense Accounting Web App &bull; Private Ledger Statement</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>`;

  // Write to a hidden iframe to trigger the native browser print / save-as-PDF dialog
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 250);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
