# Personal Accounting & Project Expense Web App

A modern, high-performance personal finance and project cost-center management application built to mirror and extend the structure of the **Personal accounting (Kishore)** Google Spreadsheet (`en_GB` / `Asia/Calcutta`, formatted in Indian Rupee `₹`).

---

## 🌟 Key Features

### 1. Executive Dashboard (`Dashboard` Tab)
- **KPI Metrics**: Real-time Total Inflow (Credits), Total Outflow (Debits), Net Capital Balance (Surplus/Deficit), and Net Margin %.
- **Monthly Trajectory Chart**: Interactive Recharts bar/area visualization of monthly income vs. expenses.
- **Expense Category Donut Chart**: Top spending breakdown with percentage share.
- **Project Matrix Summary**: Quick P&L snapshot for all active cost-centers.
- **Recent Entries**: Click to quickly view or edit recent ledger items.

### 2. Transactions Ledger (`Transactions` Tab)
Mirrors the exact 9-column schema of the Google Sheet with web superpowers:
- **`Sl.No`**: Auto-incrementing sequence index.
- **`Date`**: Standard Indian date formatting (`DD/MM/YYYY`).
- **`income/expense`**: Segmented classification badge.
- **Conditional Formatting**:
  - 🟢 **Income rows**: Emerald highlight (`bg-[#edf7ee] border-l-[#34a853]`).
  - 🔴 **Expense rows**: Rose/Red highlight (`bg-[#fdf2f2] border-l-[#ea4335]`).
- **`type of income/expense`**: Dynamic category selector pre-populated with all 15 income types from your spreadsheet + comprehensive expense categories + custom category creation.
- **`Amount`**: Formatted with the Indian numbering standard (e.g., `₹1,25,000.00`).
- **`Tags`**: Project Cost-Center links (e.g. *Project Alpha*, *Project Beta*, *Project Gamma*, *Personal*).
- **`Description or Remarks`**: Context-rich description.
- **`Attachments`**: Support for uploading and previewing receipt images/bills in a full lightbox modal.
- **`Notes`**: Bookkeeping observations.
- **Filter Toolbar**: Instant search across all fields, Date Range bounds, Type filter, Category filter, Project Tag filter, and Multi-select batch deletion.
- **Google Sheets Interop**: 1-click **Export to CSV** matching the exact Google Sheet columns.

### 3. Projects Hub (`Projects` Tab)
Faithfully implements the Google Sheet's cost-center accounting:
- **Date Range Filters**: Cells `B2` (`From`) and `C2` (`To`) equivalent.
- **Formula Replication**:
  ```excel
  Income  = SUMIFS(Transactions!Amount, Tags=Project, Type="Income", Date >= From, Date <= To)
  Expense = SUMIFS(Transactions!Amount, Tags=Project, Type="Expense", Date >= From, Date <= To)
  Balance = Total Income - Total Expense
  ```
- **Project Cards**: Budget utilization progress bars, net balance badges, and 1-click drill down to view filtered project transactions.
- **New Project Creator**: Custom project tags, descriptions, budget allocations, and color identifiers.

### 4. Cashflow Intelligence & Analytics (`Analytics` Tab)
- Multi-period annual and monthly cashflow comparisons.
- Expense distribution and Inflow streams share.
- Project P&L comparative bar chart.
- Leaderboard of highest-value transactions.

### 5. Data Management & Offline Privacy (`Data & Backup` Tab)
- **100% Client-Side Privacy**: Data is persisted in browser local storage and IndexedDB — zero external servers or trackers.
- **CSV Import / Export**: Import your existing Google Sheet CSV export directly, or export your current ledger anytime.
- **Full JSON Backup & Restore**: Download complete state backups with one click.
- **Demo Data / Reset**: Easily reset to Kishore’s realistic sample dataset or clear data.

---

## ⚡ Keyboard Shortcuts
- Press **`N`** anytime (outside of input fields) to open the **New Transaction** modal.
- Press **`Esc`** to close any modal.

---

## 🚀 Running the App Locally

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The development server runs by default on:
👉 **`http://localhost:5173/`**
