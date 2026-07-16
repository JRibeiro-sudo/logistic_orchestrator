"""Thin read layer over the synthetic JSON fixtures in data/.

Simulates the read side of enterprise system integrations (SAP master data,
inventory, PO status, inbound/tracking) that the deterministic and evidence
gathering stages consume. All data is synthetic — see generate_mock_data.py.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"


@lru_cache(maxsize=None)
def _load(filename: str) -> list[dict]:
    with open(DATA_DIR / filename) as f:
        return json.load(f)["records"]


def clear_cache() -> None:
    _load.cache_clear()


def suppliers() -> list[dict]:
    return _load("suppliers.json")


def parts() -> list[dict]:
    return _load("parts.json")


def inventory() -> list[dict]:
    return _load("inventory.json")


def po_status() -> list[dict]:
    return _load("po_status.json")


def inbound_deliveries() -> list[dict]:
    return _load("inbound_deliveries.json")


def consumption_vs_plan() -> list[dict]:
    return _load("consumption_vs_plan.json")


def get_supplier(supplier_id: str) -> dict | None:
    return next((s for s in suppliers() if s["supplier_id"] == supplier_id), None)


def get_part(part_number: str) -> dict | None:
    return next((p for p in parts() if p["part_number"] == part_number), None)


def get_inventory(part_number: str) -> dict | None:
    return next((i for i in inventory() if i["part_number"] == part_number), None)


def get_po_status_for_part(part_number: str) -> list[dict]:
    return [po for po in po_status() if po["part_number"] == part_number]


def get_inbound_for_po(po_id: str) -> dict | None:
    return next((d for d in inbound_deliveries() if d["po_id"] == po_id), None)


def get_consumption_vs_plan(part_number: str) -> dict | None:
    return next((c for c in consumption_vs_plan() if c["part_number"] == part_number), None)
