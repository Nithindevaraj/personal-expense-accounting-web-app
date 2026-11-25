# Cross-Surface Parity & Anti-Redundancy Protocol

## Sovereign Directive: Global Coherence & Zero-Divergence
Whenever planning, adding, modifying, or refactoring ANY feature, UI element, form, setting, data model, or logic:

---

### 1. Mandatory Pre-Execution Scan (Twin-Detection & Anti-Reinvention)
Before writing or modifying any code:
1. **Search for Existing Implementations**:
   - Perform an exhaustive grep / AST scan across the entire project (`src/`) for related keywords, types, component names, and state stores.
   - If a matching or similar capability already exists, **DO NOT reinvent it**. Reuse, extend, or parameterize the existing implementation.
2. **Scan for Twin Surfaces (Secondary Locations)**:
   - Identify every place in the application where this feature, setting, or data appears or can be controlled:
     - Main Screen / Dashboard
     - Settings / Preferences Screen
     - Modals / Drawers / Quick-Add Sheets
     - Alternative Views (e.g. Table vs Card stream)
     - Responsive Breakpoint Variants (Mobile vs Desktop)

---

### 2. Single Source of Truth Standard (DRY Enforcement)
1. **No Duplicated State or Logic**:
   - If Screen A and Settings Screen B manage or display the same concept, they MUST NOT use separate, decoupled implementations.
2. **Extract Shared Primitives**:
   - Extract the shared behavior into a canonical shared component, custom hook, or centralized state store (e.g., Zustand store, React context, or utility helper).
   - Ensure both Screen A and Settings Screen B consume that exact canonical primitive.

---

### 3. Synchronized Multi-Surface Propagation
1. **Atomic Multi-Screen Updates**:
   - If a proposed change affects a control that appears on Screen A and also has an expression in the Settings screen (or vice versa), the agent MUST update **all** affected surfaces in the exact same turn/commit.
2. **Prevent Split-Brain UI**:
   - It is strictly forbidden to update Screen A while leaving Settings Screen B with legacy options, hardcoded defaults, or defunct handlers.
3. **Responsive Reciprocal Verification**:
   - Cross-surface parity must hold across both mobile and desktop views as mandated by the Bidirectional Responsive Parity Protocol.

---

### 4. Verification Check Before Completion
1. Verify that the change takes effect consistently across ALL screens where it is surfaced.
2. Compile and typecheck (`tsc -b && vite build`) to confirm that all prop changes, schemas, and call-sites remain 100% compliant.
