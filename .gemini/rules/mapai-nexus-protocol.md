# MAPai Nexus Protocol (MNP) — Multi-Conversation Governance Standard

## Sovereign Multi-Session Coordination Directive
This project is actively developed across multiple concurrent Antigravity conversations. To eliminate regressions, collisions, loose ends, and architectural contradictions, every conversation operating within this repository is strictly bound by the **MAPai Nexus Protocol (MNP)**.

---

### 1. Mandatory Turn-1 Intake Check
Before planning tasks, generating code, or modifying files:
1. **Inspect the Central Nexus**:
   - Read `.mapai/nexus_ledger.json` and `.mapai/SYNC_BOARD.md`.
2. **Review Active Sessions & Locks**:
   - Verify what other conversations are actively building, what files they have locked, and what architectural invariants are in place.
3. **Check for Superseded Work**:
   - Verify whether your current goal or assumptions have been superseded or altered by a newer session.

---

### 2. Lock & Collision Prevention
1. **File-Level Exclusivity**:
   - Do NOT edit a file that is currently locked exclusively by another active conversation in `.mapai/nexus_ledger.json` without explicit coordination.
2. **Registering Your Scope**:
   - Before executing code modifications, register your conversation ID, role, task, and target files:
     ```bash
     python .mapai/nexus_reconciler.py --register --session "<YOUR_CONVERSATION_ID>" --role "<ROLE_TITLE>" --task "<DESCRIPTION>" --lock <FILE_PATHS...>
     ```
   - Alternatively, update `.mapai/nexus_ledger.json` with your session entry under `active_sessions` and `file_locks`.

---

### 3. Handling Later Changes Affecting In-Flight Work (Supersession Protocol)
If your conversation introduces a new feature, schema change, or structural pivot that affects or invalidates another session's implementation:
1. **Never Silently Overwrite**:
   - Do not blindly write over files touched by a parallel session.
2. **Declare the Supersession**:
   - Record the superseded contract in `.mapai/nexus_ledger.json` under `supersessions` (identifying the superseded session, the affected contracts, and the new canonical standard).
3. **Notify via Board**:
   - Run reconciliation so the live `.mapai/SYNC_BOARD.md` immediately reflects the change.
4. **Adapter Responsibility**:
   - When introducing a breaking change to a shared interface or model, provide backward-compatible shims or update all active call-sites across the codebase.

---

### 4. Turn Completion & Reconciler Execution
Before concluding any turn where code or project files were altered:
1. **Type & Build Verification**:
   - Run static validation (`npx tsc -b` or project build) to ensure joint repo coherence.
2. **Reconcile State**:
   - Execute:
     ```bash
     python .mapai/nexus_reconciler.py --reconcile
     ```
   - Verify that `.mapai/SYNC_BOARD.md` reports `OPERATIONAL` status with 0 conflicts.
3. **Task Completion & Lock Release**:
   - When a discrete task or feature branch is finished, release your locks:
     ```bash
     python .mapai/nexus_reconciler.py --release --session "<YOUR_CONVERSATION_ID>"
     ```
4. **No Loose Ends**:
   - Never leave uncommitted orphan files or half-imported components dangling in the working tree.
