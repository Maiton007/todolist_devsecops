import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "TodoDB.db")

def _connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def _now_iso():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def _row_to_dict(r: sqlite3.Row) -> Dict[str, Any]:
    return {k: r[k] for k in r.keys()}

def _validate_date_str(d: str):
    if not d:
        return
    try:
        datetime.strptime(d, "%Y-%m-%d")
    except ValueError:
        raise ValueError("INVALID_DATE")

def normalize_tags(s: str) -> str:
    parts = [p.strip().lower() for p in (s or "").split(",")]
    parts = [p for p in parts if p]
    seen = set(); out = []
    for p in parts:
        if p not in seen:
            seen.add(p); out.append(p)
    return ",".join(out)

def init_db():
    conn = _connect()
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',   -- todo|done|archived
        priority INTEGER NOT NULL DEFAULT 0,
        tags TEXT DEFAULT '',                  -- เก็บเป็น comma-separated เพื่อความง่าย
        due_date TEXT DEFAULT NULL,            -- YYYY-MM-DD
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)
    conn.commit()
    conn.close()

# ----- CRUD -----
def create_task(p: Dict[str, Any]) -> Dict[str, Any]:
    title = (p.get("title") or "").strip()
    if not title:
        raise ValueError("TITLE_REQUIRED")
    status = (p.get("status") or "todo").strip()
    if status not in ("todo", "done", "archived"):
        raise ValueError("INVALID_STATUS")
    priority = int(p.get("priority") or 0)
    tags = normalize_tags(p.get("tags") or "")
    due_date = p.get("due_date") or None
    _validate_date_str(due_date)

    now = _now_iso()
    conn = _connect(); c = conn.cursor()
    c.execute("""INSERT INTO tasks
        (title, description, status, priority, tags, due_date, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (title, p.get("description",""), status, priority, tags, due_date, now, now))
    tid = c.lastrowid
    conn.commit(); conn.close()
    return get_task(tid)

def get_task(task_id: int) -> Dict[str, Any]:
    conn = _connect(); c = conn.cursor()
    c.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise KeyError("NOT_FOUND")
    return _row_to_dict(row)

def list_tasks(filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    q = (filters.get("q") or "").strip()
    status = (filters.get("status") or "").strip()
    tag = (filters.get("tag") or "").strip()
    due_before = (filters.get("due_before") or "").strip()
    due_after = (filters.get("due_after") or "").strip()
    sort = (filters.get("sort") or "created_at").strip()
    order = (filters.get("order") or "desc").lower()

    if sort not in {"created_at","updated_at","due_date","priority","title","status"}:
        sort="created_at"
    if order not in {"asc","desc"}:
        order="desc"

    where, params = [], []
    if q:
        like = f"%{q}%"
        where.append("(title LIKE ? OR description LIKE ?)")
        params += [like, like]
    if status:
        where.append("status = ?"); params.append(status)
    if tag:
        # match comma-separated tags (normalize space)
        where.append("((',' || REPLACE(tags,' ','') || ',') LIKE ?)")
        params.append(f"%,{tag.lower()},%")
    if due_before:
        _validate_date_str(due_before)
        where.append("(due_date IS NOT NULL AND due_date <= ?)"); params.append(due_before)
    if due_after:
        _validate_date_str(due_after)
        where.append("(due_date IS NOT NULL AND due_date >= ?)"); params.append(due_after)

    sql = "SELECT * FROM tasks"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += f" ORDER BY {sort} {order.upper()}"

    conn = _connect(); c = conn.cursor()
    c.execute(sql, params)
    rows = c.fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]

def update_task(task_id: int, p: Dict[str, Any]) -> Dict[str, Any]:
    _ = get_task(task_id)  # ตรวจว่ามีจริง
    fields, params = [], []

    if "title" in p:
        title = (p.get("title") or "").strip()
        if not title:
            raise ValueError("TITLE_REQUIRED")
        fields.append("title = ?"); params.append(title)

    if "description" in p:
        fields.append("description = ?"); params.append(p.get("description",""))

    if "status" in p:
        st = (p.get("status") or "").strip()
        if st not in ("todo","done","archived"):
            raise ValueError("INVALID_STATUS")
        fields.append("status = ?"); params.append(st)

    if "priority" in p:
        fields.append("priority = ?"); params.append(int(p.get("priority") or 0))

    if "tags" in p:
        fields.append("tags = ?"); params.append(normalize_tags(p.get("tags") or ""))

    if "due_date" in p:
        due = p.get("due_date") or None
        _validate_date_str(due)
        fields.append("due_date = ?"); params.append(due)

    fields.append("updated_at = ?"); params.append(_now_iso())

    if fields:
        params.append(task_id)
        conn = _connect(); c = conn.cursor()
        c.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", params)
        conn.commit(); conn.close()

    return get_task(task_id)

def delete_task(task_id: int) -> None:
    _ = get_task(task_id)
    conn = _connect(); c = conn.cursor()
    c.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit(); conn.close()

def toggle_task(task_id: int) -> Dict[str, Any]:
    t = get_task(task_id)
    new_status = "todo" if t["status"] == "done" else "done"
    return update_task(task_id, {"status": new_status})
