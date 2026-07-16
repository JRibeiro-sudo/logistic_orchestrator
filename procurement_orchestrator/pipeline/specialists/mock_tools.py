"""Mocked enterprise integration tools used by the specialist branches.

All four tools are simulated against the synthetic fixtures in data/ — no
real network calls, no real API keys, no real suppliers or stakeholders.
"""

from __future__ import annotations

import uuid

from pipeline import data_access


def mock_send_supplier_email(rendered_template: str, po_id: str) -> dict:
    """Outbound, external. Simulates sending a fixed pre-approved template
    to the supplier and returns a canned reply derived from synthetic PO
    status — no free-generated text is ever sent."""
    po = next((p for p in data_access.po_status() if p["po_id"] == po_id), None)
    return {
        "message_id": f"MSG-{uuid.uuid4().hex[:8]}",
        "sent": True,
        "channel": "mock_supplier_email",
        "po_id": po_id,
        "simulated_reply": {
            "po_status": po["status"] if po else "unknown",
            "promised_date": po["promised_date"] if po else None,
        },
    }


def mock_contact_internal_stakeholder(rendered_template: str, part_id: str) -> dict:
    """Outbound, internal. Simulates pinging an internal stakeholder with a
    fixed template and returns a canned status derived from synthetic
    consumption-vs-plan data."""
    consumption = data_access.get_consumption_vs_plan(part_id)
    deviation = (consumption or {}).get("deviation_pct", 0)
    return {
        "message_id": f"MSG-{uuid.uuid4().hex[:8]}",
        "sent": True,
        "channel": "mock_internal_stakeholder",
        "part_id": part_id,
        "simulated_reply": {
            "upstream_component_status": "at_risk" if deviation > 20 else "on_track",
            "deviation_pct": deviation,
        },
    }


def mock_carrier_tracking_lookup(tracking_number: str) -> dict:
    """Read-only, external."""
    delivery = next(
        (d for d in data_access.inbound_deliveries() if d["tracking_number"] == tracking_number),
        None,
    )
    if delivery is None:
        return {"tracking_number": tracking_number, "found": False}
    return {"tracking_number": tracking_number, "found": True, **delivery}


def mock_sap_query(part_id: str, query_type: str) -> dict:
    """Read-only, internal."""
    if query_type == "consumption_vs_plan":
        return {"part_id": part_id, "query_type": query_type, "result": data_access.get_consumption_vs_plan(part_id)}
    raise ValueError(f"Unsupported mock_sap_query query_type: {query_type!r}")
