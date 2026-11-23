# Bidirectional Responsive Parity Protocol

## Sovereign Directive: Reciprocal Viewport Governance
Whenever making ANY visual, structural, styling, or functional change to the application:
1. **Desktop / Web View Changes -> Mandatory Reciprocal Mobile Optimization**:
   - Every modification to desktop layouts, tables, headers, forms, or data presentation must immediately be optimized for mobile viewports (`< 768px` and `< 640px`).
   - Verify touch targets (minimum 40px–44px), thumb reachability, collapsible filters, bottom-sheet dialogs, and prevention of iOS auto-zoom (`text-base sm:text-xs`).
   - Ensure the dual-mode presentation (card stream vs. table) and mobile bottom navigation remain flawless.

2. **Mobile View Changes -> Mandatory Reciprocal Desktop / Web Optimization**:
   - Every enhancement made for mobile interactions or layouts must immediately be verified and optimized for desktop viewports (`>= 768px`, `>= 1024px`, and `>= 1280px`).
   - Preserve wide-screen density, full spreadsheet-matrix table columns, keyboard shortcuts (e.g. `Press 'N' to log an entry`), multi-column metric grids, and hover states.

3. **Pre-Delivery Verification Standard**:
   - Every UI commit or turn must compile with zero errors (`tsc -b && vite build`) and pass static lint checks (`oxlint`).
   - Viewport consistency must be verified bidirectionally across both mobile (< 640px) and wide desktop (>= 1024px) formats before considering any task complete.
