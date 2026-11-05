"""Local SQLite Database Adapter for StudyBuddy.
Provides full offline resilience mirroring Supabase PostgREST query interface.
"""
import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "studybuddy.db")

_lock = threading.Lock()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """Create all required tables for StudyBuddy."""
    with _lock:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.executescript("""
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            summary TEXT DEFAULT '',
            upload_time TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            topics_covered TEXT DEFAULT '[]',
            goals TEXT DEFAULT '[]',
            duration_mins INTEGER DEFAULT 0,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            source TEXT DEFAULT 'text',
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS flashcards (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            subject TEXT DEFAULT 'General',
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            mastered INTEGER DEFAULT 0,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS flashcard_review_days (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            review_date TEXT NOT NULL,
            review_count INTEGER DEFAULT 0,
            created_at TEXT,
            UNIQUE(student_id, review_date)
        );

        CREATE TABLE IF NOT EXISTS schedule_events (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            title TEXT NOT NULL,
            subject TEXT DEFAULT 'General',
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            priority TEXT DEFAULT 'normal',
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS emotion_logs (
            id TEXT PRIMARY KEY,
            student_id TEXT,
            emotion TEXT NOT NULL,
            confidence REAL DEFAULT 0,
            session_date TEXT,
            detected_at TEXT
        );

        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT,
            UNIQUE(student_id, name)
        );

        CREATE TABLE IF NOT EXISTS workspace_documents (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            created_at TEXT,
            UNIQUE(workspace_id, document_id)
        );

        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            invite_code TEXT UNIQUE NOT NULL,
            admin_email TEXT,
            password_hash TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS teachers (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            org_id TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS subjects (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            teacher_id TEXT,
            name TEXT NOT NULL,
            subject_code TEXT UNIQUE NOT NULL,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS org_members (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            requested_at TEXT,
            reviewed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS subject_enrollments (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            requested_at TEXT,
            reviewed_at TEXT,
            enrolled_at TEXT,
            UNIQUE(subject_id, student_id)
        );

        CREATE TABLE IF NOT EXISTS announcements (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL,
            teacher_id TEXT,
            title TEXT NOT NULL,
            body TEXT DEFAULT '',
            tag TEXT DEFAULT 'General',
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS assignments (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL,
            teacher_id TEXT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            due_date TEXT,
            max_score INTEGER DEFAULT 100,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS exams (
            id TEXT PRIMARY KEY,
            subject_id TEXT,
            teacher_id TEXT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            exam_type TEXT DEFAULT 'mcq',
            duration_mins INTEGER DEFAULT 60,
            total_marks INTEGER DEFAULT 100,
            closes_at TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS exam_questions (
            id TEXT PRIMARY KEY,
            exam_id TEXT NOT NULL,
            question_text TEXT NOT NULL,
            option_a TEXT DEFAULT '',
            option_b TEXT DEFAULT '',
            option_c TEXT DEFAULT '',
            option_d TEXT DEFAULT '',
            correct_option TEXT DEFAULT '',
            marks INTEGER DEFAULT 1,
            max_marks INTEGER DEFAULT 1,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS exam_submissions (
            id TEXT PRIMARY KEY,
            exam_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            score REAL DEFAULT 0,
            max_score REAL DEFAULT 100,
            percentage REAL DEFAULT 0,
            passed INTEGER DEFAULT 1,
            answers TEXT DEFAULT '{}',
            feedback TEXT DEFAULT '',
            submitted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS hypothesis_profiles (
            id TEXT PRIMARY KEY,
            student_id TEXT UNIQUE NOT NULL,
            version_space TEXT DEFAULT '{}',
            active_hypothesis TEXT DEFAULT '',
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS session_feedback (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            rating INTEGER DEFAULT 5,
            feedback_text TEXT NOT NULL,
            extracted_constraints TEXT DEFAULT '{}',
            previous_hypothesis TEXT DEFAULT '',
            updated_hypothesis TEXT DEFAULT '',
            created_at TEXT
        );
        """)
        conn.commit()
        conn.close()


init_db()


class QueryResult:
    def __init__(self, data: Any):
        self.data = data


class LocalTableQuery:
    def __init__(self, table_name: str):
        self.table_name = table_name
        self._action = "SELECT"
        self._select_cols = "*"
        self._insert_payload: Optional[Union[Dict, List[Dict]]] = None
        self._update_payload: Optional[Dict] = None
        self._filters: List[tuple] = []
        self._order_by: Optional[str] = None
        self._order_desc: bool = False
        self._limit: Optional[int] = None
        self._is_single: bool = False

    def select(self, cols: str = "*"):
        self._action = "SELECT"
        self._select_cols = cols
        return self

    def insert(self, payload: Union[Dict, List[Dict]]):
        self._action = "INSERT"
        self._insert_payload = payload
        return self

    def update(self, payload: Dict):
        self._action = "UPDATE"
        self._update_payload = payload
        return self

    def delete(self):
        self._action = "DELETE"
        return self

    def eq(self, column: str, value: Any):
        self._filters.append((column, "=", value))
        return self

    def neq(self, column: str, value: Any):
        self._filters.append((column, "!=", value))
        return self

    def in_(self, column: str, values: List[Any]):
        self._filters.append((column, "IN", list(values)))
        return self

    def order(self, column: str, desc: bool = False):
        self._order_by = column
        self._order_desc = desc
        return self

    def limit(self, count: int):
        self._limit = count
        return self

    def single(self):
        self._is_single = True
        return self

    def _convert_row(self, row: sqlite3.Row) -> dict:
        d = dict(row)
        for k, v in d.items():
            if k == "mastered":
                d[k] = bool(v)
            elif k in ("topics_covered", "goals", "answers", "extracted_constraints", "version_space"):
                if isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
                    try:
                        d[k] = json.loads(v)
                    except Exception:
                        pass
        return d

    def execute(self) -> QueryResult:
        with _lock:
            conn = get_connection()
            cursor = conn.cursor()

            try:
                if self._action == "INSERT":
                    items = self._insert_payload
                    if isinstance(items, dict):
                        items = [items]

                    inserted = []
                    for item in items:
                        row_dict = dict(item)
                        if "id" not in row_dict or not row_dict["id"]:
                            row_dict["id"] = str(uuid.uuid4())
                        now_str = datetime.utcnow().isoformat() + "Z"
                        if "created_at" not in row_dict:
                            # Table specific timestamp checks
                            if self.table_name == "documents" and "upload_time" not in row_dict:
                                row_dict["upload_time"] = now_str
                            elif self.table_name == "schedule_events" and "created_at" not in row_dict:
                                row_dict["created_at"] = now_str
                            else:
                                row_dict["created_at"] = now_str

                        # Serialize lists/dicts to json
                        for k, v in row_dict.items():
                            if isinstance(v, (list, dict)):
                                row_dict[k] = json.dumps(v)
                            elif isinstance(v, bool):
                                row_dict[k] = 1 if v else 0

                        cols = list(row_dict.keys())
                        placeholders = ["?"] * len(cols)
                        sql = f"INSERT INTO {self.table_name} ({', '.join(cols)}) VALUES ({', '.join(placeholders)})"
                        try:
                            cursor.execute(sql, [row_dict[c] for c in cols])
                        except sqlite3.IntegrityError as e:
                            raise Exception(f"duplicate key value violates unique constraint: {str(e)}")

                        cursor.execute(f"SELECT * FROM {self.table_name} WHERE id = ?", (row_dict["id"],))
                        res_row = cursor.fetchone()
                        if res_row:
                            inserted.append(self._convert_row(res_row))

                    conn.commit()
                    return QueryResult(inserted)

                elif self._action == "UPDATE":
                    where_sql, params = self._build_where()
                    # First fetch which IDs match
                    cursor.execute(f"SELECT id FROM {self.table_name} {where_sql}", params)
                    matching_ids = [r["id"] for r in cursor.fetchall()]

                    if not matching_ids:
                        return QueryResult([])

                    set_clauses = []
                    set_params = []
                    for k, v in self._update_payload.items():
                        set_clauses.append(f"{k} = ?")
                        if isinstance(v, (list, dict)):
                            set_params.append(json.dumps(v))
                        elif isinstance(v, bool):
                            set_params.append(1 if v else 0)
                        else:
                            set_params.append(v)

                    sql = f"UPDATE {self.table_name} SET {', '.join(set_clauses)} WHERE id IN ({', '.join(['?']*len(matching_ids))})"
                    cursor.execute(sql, set_params + matching_ids)
                    conn.commit()

                    cursor.execute(f"SELECT * FROM {self.table_name} WHERE id IN ({', '.join(['?']*len(matching_ids))})", matching_ids)
                    updated = [self._convert_row(r) for r in cursor.fetchall()]
                    return QueryResult(updated)

                elif self._action == "DELETE":
                    where_sql, params = self._build_where()
                    cursor.execute(f"SELECT * FROM {self.table_name} {where_sql}", params)
                    deleted_rows = [self._convert_row(r) for r in cursor.fetchall()]

                    cursor.execute(f"DELETE FROM {self.table_name} {where_sql}", params)
                    conn.commit()
                    return QueryResult(deleted_rows)

                else:  # SELECT
                    where_sql, params = self._build_where()
                    sql = f"SELECT * FROM {self.table_name} {where_sql}"
                    if self._order_by:
                        direction = "DESC" if self._order_desc else "ASC"
                        sql += f" ORDER BY {self._order_by} {direction}"
                    if self._limit is not None:
                        sql += f" LIMIT {self._limit}"

                    cursor.execute(sql, params)
                    rows = cursor.fetchall()
                    data = [self._convert_row(r) for r in rows]

                    # Special handling for teachers join if requested:
                    if self.table_name == "subjects" and "teacher" in str(self._select_cols):
                        for item in data:
                            t_id = item.get("teacher_id")
                            if t_id:
                                cursor.execute("SELECT full_name FROM teachers WHERE id = ?", (t_id,))
                                t_row = cursor.fetchone()
                                item["teacher"] = {"full_name": t_row["full_name"]} if t_row else None
                            else:
                                item["teacher"] = None

                    if self._is_single:
                        if not data:
                            raise Exception("JSON object requested, multiple (or no) rows returned (PGRST116)")
                        return QueryResult(data[0])

                    return QueryResult(data)
            finally:
                conn.close()

    def _build_where(self):
        if not self._filters:
            return "", []

        clauses = []
        params = []
        for col, op, val in self._filters:
            if op == "IN":
                if not val:
                    clauses.append("1=0")
                else:
                    placeholders = ", ".join(["?"] * len(val))
                    clauses.append(f"{col} IN ({placeholders})")
                    params.extend(val)
            else:
                clauses.append(f"{col} {op} ?")
                params.append(val)

        return f"WHERE {' AND '.join(clauses)}", params


class LocalDBClient:
    """Provides a client interface matching Supabase postgrest table access."""

    def table(self, table_name: str) -> LocalTableQuery:
        return LocalTableQuery(table_name)
