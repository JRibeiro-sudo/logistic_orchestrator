"""Section 3.10 — Case log and preventive flag.

Persists every case (trigger -> triage -> dispatch -> specialist outputs ->
guardrail results -> synthesis -> checkpoint decision -> execution result)
as a structured record in SQLite.

The recurring-risk flag is a plain counting SQL query, not an AI call: if a
part_number has triggered >= N times within a trailing window, the case
output carries recurring_risk=true alongside it. This is informational
only — it never skips or alters the pipeline.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from schemas import CaseRecord

ROOT_DIR = Path(__file__).parent.parent

SCHEMA = """
CREATE TABLE IF NOT EXISTS cases (
    case_id TEXT PRIMARY KEY,
    part_number TEXT NOT NULL,
    triggered_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    record_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_part_number ON cases(part_number);
"""


def _db_path(config: dict) -> Path:
    return ROOT_DIR / config["storage"]["db_path"]


@contextmanager
def _connect(config: dict):
    db_path = _db_path(config)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def count_recent_triggers(part_number: str, config: dict, before: datetime | None = None) -> int:
    """Counts cases for this part_number with triggered_at within the
    trailing recurring-risk window, strictly before `before` (defaults to
    now) so a case doesn't count itself."""
    window_days = config["recurring_risk"]["window_days"]
    reference = before or datetime.now(timezone.utc)
    cutoff = reference - timedelta(days=window_days)

    with _connect(config) as conn:
        cur = conn.execute(
            "SELECT COUNT(*) FROM cases WHERE part_number = ? AND triggered_at >= ? AND triggered_at < ?",
            (part_number, cutoff.isoformat(), reference.isoformat()),
        )
        return cur.fetchone()[0]


def compute_recurring_risk(part_number: str, config: dict, triggered_at: datetime) -> bool:
    threshold = config["recurring_risk"]["trigger_count_threshold"]
    prior_count = count_recent_triggers(part_number, config, before=triggered_at)
    # prior_count is cases strictly before this one; the current trigger
    # itself is the +1'th occurrence.
    return (prior_count + 1) >= threshold


def save_case(record: CaseRecord, config: dict) -> None:
    with _connect(config) as conn:
        conn.execute(
            """
            INSERT INTO cases (case_id, part_number, triggered_at, created_at, record_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(case_id) DO UPDATE SET
                record_json = excluded.record_json,
                created_at = excluded.created_at
            """,
            (
                record.case_id,
                record.shortage_case.part_number,
                record.shortage_case.triggered_at.isoformat(),
                record.created_at.isoformat(),
                record.model_dump_json(),
            ),
        )


def get_case(case_id: str, config: dict) -> CaseRecord | None:
    with _connect(config) as conn:
        cur = conn.execute("SELECT record_json FROM cases WHERE case_id = ?", (case_id,))
        row = cur.fetchone()
        if row is None:
            return None
        return CaseRecord.model_validate_json(row[0])


def list_cases_for_part(part_number: str, config: dict) -> list[CaseRecord]:
    with _connect(config) as conn:
        cur = conn.execute(
            "SELECT record_json FROM cases WHERE part_number = ? ORDER BY triggered_at ASC",
            (part_number,),
        )
        return [CaseRecord.model_validate_json(row[0]) for row in cur.fetchall()]


def all_cases(config: dict) -> list[CaseRecord]:
    with _connect(config) as conn:
        cur = conn.execute("SELECT record_json FROM cases ORDER BY triggered_at ASC")
        return [CaseRecord.model_validate_json(row[0]) for row in cur.fetchall()]
