"""
MAPai Nexus Protocol (MNP) — Core Reconciler & Synchronization Engine
Version: 1.0.0
Timestamp Standard: 12-Hour AM/PM DD MMMM YYYY
"""

import os
import sys
import json
import argparse
import subprocess
from datetime import datetime
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
MAPAI_DIR = WORKSPACE_ROOT / ".mapai"
LEDGER_FILE = MAPAI_DIR / "nexus_ledger.json"
BOARD_FILE = MAPAI_DIR / "SYNC_BOARD.md"

def get_formatted_time():
    now = datetime.now()
    # Format: hh:mm AM/PM, DD MMMM YYYY
    return now.strftime("%I:%M %p, %d %B %Y").lstrip("0")

def load_ledger():
    if not LEDGER_FILE.exists():
        return {
            "protocol": "MAPai Nexus Protocol (MNP)",
            "version": "1.0.0",
            "project_name": WORKSPACE_ROOT.name,
            "created_at": get_formatted_time(),
            "last_updated": get_formatted_time(),
            "active_sessions": {},
            "file_locks": {},
            "architectural_invariants": {},
            "supersessions": [],
            "conflicts": [],
            "reconciliation_log": []
        }
    with open(LEDGER_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_ledger(ledger):
    ledger["last_updated"] = get_formatted_time()
    with open(LEDGER_FILE, "w", encoding="utf-8") as f:
        json.dump(ledger, f, indent=2)

def get_git_status():
    try:
        res = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=str(WORKSPACE_ROOT),
            capture_output=True,
            text=True,
            check=True
        )
        lines = [line.strip() for line in res.stdout.splitlines() if line.strip()]
        modified = []
        untracked = []
        for line in lines:
            status = line[:2]
            filename = line[3:].strip()
            if status == "??":
                untracked.append(filename)
            else:
                modified.append(filename)
        return {"modified": modified, "untracked": untracked, "clean": len(lines) == 0}
    except Exception as e:
        return {"modified": [], "untracked": [], "clean": False, "error": str(e)}

def detect_collisions(ledger, git_status):
    conflicts = []
    
    # 1. Unregistered modifications in working tree
    all_locked = set(ledger.get("file_locks", {}).keys())
    for s_info in ledger.get("active_sessions", {}).values():
        all_locked.update(s_info.get("locked_files", []))

    for mod_file in git_status.get("modified", []):
        # Ignore .mapai internal ledger changes
        normalized = mod_file.replace("\\", "/")
        if normalized.startswith(".mapai/"):
            continue
        if normalized not in all_locked:
            conflicts.append({
                "type": "UNREGISTERED_WORK_IN_PROGRESS",
                "severity": "WARNING",
                "file": normalized,
                "details": f"File '{normalized}' is modified in git working tree without active MNP lock declaration."
            })

    # 2. Overlapping locks across distinct active sessions
    lock_claims = {}
    for s_id, s_data in ledger.get("active_sessions", {}).items():
        if s_data.get("status") == "ACTIVE":
            for lf in s_data.get("locked_files", []):
                norm_lf = lf.replace("\\", "/")
                if norm_lf in lock_claims:
                    conflicts.append({
                        "type": "LOCK_COLLISION",
                        "severity": "CRITICAL",
                        "file": norm_lf,
                        "details": f"Conflicting concurrent lock on '{norm_lf}' between Session {lock_claims[norm_lf]} and Session {s_id}."
                    })
                else:
                    lock_claims[norm_lf] = s_id

    return conflicts

def render_board(ledger, git_status, conflicts):
    now_str = get_formatted_time()
    active_count = sum(1 for s in ledger.get("active_sessions", {}).values() if s.get("status") == "ACTIVE")
    conflict_count = len(conflicts)
    status_badge = "OPERATIONAL" if conflict_count == 0 else "CONFLICT_DETECTED"

    md = []
    md.append("# MAPai Nexus Protocol (MNP) — Live Synchronization Board\n")
    md.append(f"> **Project**: {ledger.get('project_name', 'Personal expence web app')}  ")
    md.append(f"> **Status**: {status_badge} | **Active Sessions**: {active_count} | **Pending Conflicts**: {conflict_count}  ")
    md.append(f"> **Last Synchronized**: {now_str}  \n")
    md.append("---\n")

    md.append("## 1. Active Conversation Registry\n")
    md.append("| Conversation ID | Session Role | Status | Current Scope / Objective | Locked Files | Heartbeat |")
    md.append("| :--- | :--- | :--- | :--- | :--- | :--- |")
    if not ledger.get("active_sessions"):
        md.append("| *None* | - | `IDLE` | No active sessions registered | - | - |")
    else:
        for s_id, s in ledger.get("active_sessions", {}).items():
            locked_str = ", ".join(f"`{f}`" for f in s.get("locked_files", [])) or "*None*"
            short_id = f"`{s_id[:8]}...`" if len(s_id) > 12 else f"`{s_id}`"
            md.append(f"| {short_id} | {s.get('session_name', 'Agent')} | `{s.get('status', 'ACTIVE')}` | {s.get('task_objective', 'Working')} | {locked_str} | {s.get('last_heartbeat', now_str)} |")
    md.append("\n---\n")

    md.append("## 2. Active File Locks\n")
    file_locks = ledger.get("file_locks", {})
    if not file_locks:
        md.append("*No files currently locked exclusively.*\n")
    else:
        for fpath, ldata in file_locks.items():
            holder = ldata.get("session_id", "unknown")
            short_holder = f"`{holder[:8]}...`" if len(holder) > 12 else f"`{holder}`"
            md.append(f"- **`{fpath}`** — Locked by {short_holder} [{ldata.get('mode', 'EXCLUSIVE')}] since {ldata.get('locked_at', now_str)}")
        md.append("")
    md.append("---\n")

    md.append("## 3. Architectural Invariants (Non-Negotiable Contracts)\n")
    invariants = ledger.get("architectural_invariants", {})
    if invariants:
        for idx, (k, v) in enumerate(invariants.items(), 1):
            key_title = k.replace("_", " ").title()
            md.append(f"{idx}. **{key_title}**: {v}")
    else:
        md.append("*No architectural invariants formally published yet.*")
    md.append("\n---\n")

    md.append("## 4. Contradiction & Collision Audit\n")
    md.append("| Severity | Type | Target Surface | Details |")
    md.append("| :--- | :--- | :--- | :--- |")
    if not conflicts:
        md.append("| `CLEAR` | Synchronized | All files clean and synchronized | Zero collisions detected. Git working tree and ledger aligned. |")
    else:
        for c in conflicts:
            md.append(f"| `{c['severity']}` | `{c['type']}` | `{c['file']}` | {c['details']} |")
    md.append("\n---\n")

    md.append("## 5. Working Tree Diagnostics (Git)\n")
    if git_status.get("clean"):
        md.append("✔ **Working tree clean**. No uncommitted or orphaned diffs.")
    else:
        if git_status.get("modified"):
            md.append(f"- **Modified files ({len(git_status['modified'])})**: " + ", ".join(f"`{f}`" for f in git_status["modified"]))
        if git_status.get("untracked"):
            md.append(f"- **Untracked files ({len(git_status['untracked'])})**: " + ", ".join(f"`{f}`" for f in git_status["untracked"]))
    md.append("\n---\n")

    md.append("## 6. Recent Synchronization & Event Log\n")
    logs = ledger.get("reconciliation_log", [])[-8:]
    if not logs:
        md.append(f"- **[{now_str}]** System initialized.")
    else:
        for item in reversed(logs):
            md.append(f"- **[{item.get('timestamp', now_str)}]** `{item.get('type', 'EVENT')}`: {item.get('details', '')}")

    return "\n".join(md) + "\n"

def reconcile():
    ledger = load_ledger()
    git_status = get_git_status()
    conflicts = detect_collisions(ledger, git_status)

    ledger["conflicts"] = conflicts
    
    # Append log entry if status change
    now_str = get_formatted_time()
    ledger.setdefault("reconciliation_log", []).append({
        "timestamp": now_str,
        "type": "RECONCILIATION_RUN",
        "details": f"Checked tree: {len(git_status.get('modified', []))} modified, {len(conflicts)} conflicts detected."
    })
    
    # Keep log bounded to last 50 events
    if len(ledger["reconciliation_log"]) > 50:
        ledger["reconciliation_log"] = ledger["reconciliation_log"][-50:]

    save_ledger(ledger)
    board_md = render_board(ledger, git_status, conflicts)
    with open(BOARD_FILE, "w", encoding="utf-8") as f:
        f.write(board_md)

    print(f"[MNP Reconciler] Success: Reconciled at {now_str}. Status: {'CLEAN' if not conflicts else 'CONFLICTS_FOUND'}")
    return len(conflicts) == 0

def register_session(session_id, role, objective, locked_files):
    ledger = load_ledger()
    now_str = get_formatted_time()
    
    files = [f.strip().replace("\\", "/") for f in locked_files if f.strip()]
    
    ledger.setdefault("active_sessions", {})[session_id] = {
        "session_name": role,
        "status": "ACTIVE",
        "role": role,
        "task_objective": objective,
        "branch": "master",
        "locked_files": files,
        "last_heartbeat": now_str
    }
    
    file_locks = ledger.setdefault("file_locks", {})
    for f in files:
        file_locks[f] = {
            "session_id": session_id,
            "mode": "EXCLUSIVE",
            "locked_at": now_str
        }
        
    ledger.setdefault("reconciliation_log", []).append({
        "timestamp": now_str,
        "type": "SESSION_REGISTERED",
        "details": f"Session '{role}' ({session_id[:8]}) registered with {len(files)} locks."
    })
    save_ledger(ledger)
    reconcile()
    print(f"[MNP Reconciler] Registered session {session_id}")

def release_session(session_id):
    ledger = load_ledger()
    now_str = get_formatted_time()
    if session_id in ledger.get("active_sessions", {}):
        s_data = ledger["active_sessions"][session_id]
        s_data["status"] = "COMPLETED"
        locked = s_data.get("locked_files", [])
        
        # Release locks held by this session
        file_locks = ledger.get("file_locks", {})
        for f in locked:
            if f in file_locks and file_locks[f].get("session_id") == session_id:
                del file_locks[f]
                
        s_data["locked_files"] = []
        ledger.setdefault("reconciliation_log", []).append({
            "timestamp": now_str,
            "type": "SESSION_RELEASED",
            "details": f"Session '{s_data.get('session_name')}' ({session_id[:8]}) released all locks and closed."
        })
        save_ledger(ledger)
        reconcile()
        print(f"[MNP Reconciler] Released session {session_id}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MAPai Nexus Protocol Reconciler")
    parser.add_argument("--reconcile", action="store_true", help="Perform reconciliation and regenerate SYNC_BOARD.md")
    parser.add_argument("--register", action="store_true", help="Register a session")
    parser.add_argument("--release", action="store_true", help="Release a session and unlock its files")
    parser.add_argument("--session", type=str, help="Session / Conversation ID")
    parser.add_argument("--role", type=str, default="Worker Agent", help="Role or name of the session")
    parser.add_argument("--task", type=str, default="Task execution", help="Objective of the session")
    parser.add_argument("--lock", nargs="*", default=[], help="Files to lock for this session")

    args = parser.parse_args()

    if args.register:
        if not args.session:
            print("Error: --session is required for registration.")
            sys.exit(1)
        register_session(args.session, args.role, args.task, args.lock)
    elif args.release:
        if not args.session:
            print("Error: --session is required for release.")
            sys.exit(1)
        release_session(args.session)
    else:
        # Default action: reconcile
        reconcile()
