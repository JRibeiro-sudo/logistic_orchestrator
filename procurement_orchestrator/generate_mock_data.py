"""Synthetic dataset generator for the Procurement Material Recovery Orchestrator.

Generates clearly-labeled MOCK fixtures under data/: supplier master (with
lead times), part master, current inventory/consumption, PO status, and
inbound delivery / tracking records. Nothing here represents a real company,
supplier, or figure — every name is an obviously synthetic placeholder.

Run: python generate_mock_data.py [--seed N]
"""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

DATA_DIR = Path(__file__).parent / "data"
CONFIG_PATH = Path(__file__).parent / "config.yaml"

SUPPLIER_NAME_POOL = [
    "Synthetic Supplier Co. A",
    "Synthetic Supplier Co. B",
    "Synthetic Supplier Co. C",
    "Synthetic Supplier Co. D",
    "Synthetic Supplier Co. E",
    "Synthetic Supplier Co. F",
]

PART_FAMILIES = ["Compressor Valve", "PCB Assembly", "Heat Exchanger Fin", "Motor Bracket", "Sensor Module", "Gasket Set"]

CARRIERS = ["Synthetic Carrier X", "Synthetic Carrier Y", "Synthetic Carrier Z"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def generate(seed: int, num_suppliers: int, num_parts: int) -> None:
    rng = random.Random(seed)
    DATA_DIR.mkdir(exist_ok=True)
    meta = {"synthetic": True, "note": "Academic prototype mock data — no real company, supplier, or figure.", "generated_at": _now().isoformat()}

    # --- Supplier master (with lead times) ---
    suppliers = []
    for i in range(num_suppliers):
        supplier_id = f"SUP-{i+1:03d}"
        # Mix of short and long lead-time suppliers to exercise both bands.
        lead_time_days = rng.choice([2, 3, 5, 7, 10, 14, 21, 30])
        suppliers.append(
            {
                "supplier_id": supplier_id,
                "name": SUPPLIER_NAME_POOL[i % len(SUPPLIER_NAME_POOL)],
                "region": rng.choice(["EU-West", "EU-East", "APAC", "NA"]),
                "lead_time_days": lead_time_days,
            }
        )

    # --- Part master ---
    parts = []
    for i in range(num_parts):
        part_number = f"PN-{i+1:05d}"
        supplier = rng.choice(suppliers)
        family = PART_FAMILIES[i % len(PART_FAMILIES)]
        parts.append(
            {
                "part_number": part_number,
                "description": f"{family} (synthetic)",
                "supplier_id": supplier["supplier_id"],
                "unit_cost_eur": round(rng.uniform(1.5, 85.0), 2),
                "safety_stock_units": rng.randint(50, 500),
            }
        )

    # --- Inventory + consumption (drives trigger.py) ---
    inventory = []
    for part in parts:
        daily_consumption = round(rng.uniform(20, 400), 1)
        current_stock = round(daily_consumption * rng.uniform(0.3, 4.0), 1)
        inventory.append(
            {
                "part_number": part["part_number"],
                "current_stock_units": current_stock,
                "daily_consumption_units": daily_consumption,
                "system_vs_physical_delta_flag": rng.random() < 0.15,
                "as_of": _now().isoformat(),
            }
        )

    # --- PO status ---
    po_status = []
    for i, part in enumerate(parts):
        po_id = f"PO-{i+1:05d}"
        status = rng.choice(["confirmed", "confirmed", "delayed", "at_risk", "open"])
        po_status.append(
            {
                "po_id": po_id,
                "part_number": part["part_number"],
                "supplier_id": part["supplier_id"],
                "status": status,
                "promised_date": (_now() + timedelta(days=rng.randint(-3, 20))).date().isoformat(),
            }
        )

    # --- Inbound deliveries / carrier tracking ---
    inbound = []
    for i, po in enumerate(po_status):
        delivery_id = f"DLV-{i+1:05d}"
        tracking_number = f"TRK-{rng.randint(100000, 999999)}"
        status = rng.choice(["in_transit", "in_transit", "delayed", "customs_hold", "delivered"])
        inbound.append(
            {
                "delivery_id": delivery_id,
                "po_id": po["po_id"],
                "tracking_number": tracking_number,
                "carrier": rng.choice(CARRIERS),
                "status": status,
                "eta": (_now() + timedelta(days=rng.randint(-2, 15))).date().isoformat(),
            }
        )

    # --- Consumption vs plan (demand_deviation branch, mock_sap_query target) ---
    consumption_vs_plan = []
    for part in parts:
        planned = round(rng.uniform(500, 3000), 0)
        actual = round(planned * rng.uniform(0.7, 1.6), 0)
        consumption_vs_plan.append(
            {
                "part_number": part["part_number"],
                "planned_units_30d": planned,
                "actual_units_30d": actual,
                "deviation_pct": round((actual - planned) / planned * 100, 1),
            }
        )

    # --- Hand-crafted demo fixtures (DEMO- prefix) ---
    # Deterministic records with deliberately unambiguous signals, layered
    # on top of the randomly generated bulk data above, so demo_scenarios.py
    # can reliably reproduce each named scenario shape for the assignment
    # write-up. Still 100% synthetic. The bulk random parts above remain
    # available for main.py's live, unscripted trigger scan.
    demo_supplier_short = {
        "supplier_id": "SUP-DEMO-1",
        "name": "Synthetic Supplier Co. Demo-1",
        "region": "EU-West",
        "lead_time_days": 3,
    }
    demo_supplier_long = {
        "supplier_id": "SUP-DEMO-2",
        "name": "Synthetic Supplier Co. Demo-2",
        "region": "APAC",
        "lead_time_days": 21,
    }
    suppliers += [demo_supplier_short, demo_supplier_long]

    demo_part_transport = {
        "part_number": "DEMO-PN-9001",
        "description": "Gasket Set (synthetic, demo scenario: transport delay)",
        "supplier_id": "SUP-DEMO-1",
        "unit_cost_eur": 4.5,
        "safety_stock_units": 200,
    }
    demo_part_capacity = {
        "part_number": "DEMO-PN-9002",
        "description": "Compressor Valve (synthetic, demo scenario: supplier capacity)",
        "supplier_id": "SUP-DEMO-2",
        "unit_cost_eur": 62.0,
        "safety_stock_units": 150,
    }
    demo_part_contradiction = {
        "part_number": "DEMO-PN-9003",
        "description": "PCB Assembly (synthetic, demo scenario: guardrail rejection)",
        "supplier_id": "SUP-DEMO-1",
        "unit_cost_eur": 18.0,
        "safety_stock_units": 120,
    }
    parts += [demo_part_transport, demo_part_capacity, demo_part_contradiction]

    inventory += [
        {
            # short lead time (3d) -> 48h horizon; 40 units / 40 per day = 24h coverage, fires.
            "part_number": "DEMO-PN-9001",
            "current_stock_units": 40.0,
            "daily_consumption_units": 40.0,
            "system_vs_physical_delta_flag": False,
            "as_of": _now().isoformat(),
        },
        {
            # long lead time (21d) -> 756h horizon; well below that, fires.
            "part_number": "DEMO-PN-9002",
            "current_stock_units": 300.0,
            "daily_consumption_units": 36.0,
            "system_vs_physical_delta_flag": False,
            "as_of": _now().isoformat(),
        },
        {
            "part_number": "DEMO-PN-9003",
            "current_stock_units": 60.0,
            "daily_consumption_units": 60.0,
            "system_vs_physical_delta_flag": False,
            "as_of": _now().isoformat(),
        },
    ]

    po_status += [
        {
            # Supplier has CONFIRMED the PO — rules out supplier_capacity —
            # isolates the transport signal below.
            "po_id": "PO-DEMO-9001",
            "part_number": "DEMO-PN-9001",
            "supplier_id": "SUP-DEMO-1",
            "status": "confirmed",
            "promised_date": (_now() - timedelta(days=2)).date().isoformat(),
        },
        {
            # Supplier itself is flagging risk, nothing shipped yet.
            "po_id": "PO-DEMO-9002",
            "part_number": "DEMO-PN-9002",
            "supplier_id": "SUP-DEMO-2",
            "status": "at_risk",
            "promised_date": (_now() + timedelta(days=18)).date().isoformat(),
        },
        {
            "po_id": "PO-DEMO-9003",
            "part_number": "DEMO-PN-9003",
            "supplier_id": "SUP-DEMO-1",
            "status": "at_risk",
            "promised_date": (_now() + timedelta(days=1)).date().isoformat(),
        },
    ]

    inbound += [
        {
            # PO confirmed, but the carrier tracking shows a hard delay —
            # this is the transport signal for DEMO-PN-9001.
            "delivery_id": "DLV-DEMO-9001",
            "po_id": "PO-DEMO-9001",
            "tracking_number": "TRK-DEMO-9001",
            "carrier": "Synthetic Carrier X",
            "status": "delayed",
            "eta": (_now() + timedelta(days=4)).date().isoformat(),
        },
        # DEMO-PN-9002 intentionally has no inbound delivery record yet —
        # nothing has shipped because the supplier itself is capacity
        # constrained, reinforcing the supplier_capacity signal.
        {
            "delivery_id": "DLV-DEMO-9003",
            "po_id": "PO-DEMO-9003",
            "tracking_number": "TRK-DEMO-9003",
            "carrier": "Synthetic Carrier Y",
            "status": "in_transit",
            "eta": (_now() + timedelta(days=1)).date().isoformat(),
        },
    ]

    consumption_vs_plan += [
        {"part_number": "DEMO-PN-9001", "planned_units_30d": 1200.0, "actual_units_30d": 1200.0, "deviation_pct": 0.0},
        {"part_number": "DEMO-PN-9002", "planned_units_30d": 1000.0, "actual_units_30d": 1010.0, "deviation_pct": 1.0},
        {"part_number": "DEMO-PN-9003", "planned_units_30d": 900.0, "actual_units_30d": 905.0, "deviation_pct": 0.6},
    ]

    fixtures = {
        "suppliers.json": suppliers,
        "parts.json": parts,
        "inventory.json": inventory,
        "po_status.json": po_status,
        "inbound_deliveries.json": inbound,
        "consumption_vs_plan.json": consumption_vs_plan,
    }
    for filename, records in fixtures.items():
        with open(DATA_DIR / filename, "w") as f:
            json.dump({"_meta": meta, "records": records}, f, indent=2)

    print(f"Generated {len(fixtures)} synthetic fixture files in {DATA_DIR}/ (seed={seed})")
    for filename, records in fixtures.items():
        print(f"  {filename}: {len(records)} records")


def main() -> None:
    cfg = load_config()
    mock_cfg = cfg.get("mock_data", {})
    parser = argparse.ArgumentParser(description="Generate synthetic mock data fixtures.")
    parser.add_argument("--seed", type=int, default=mock_cfg.get("seed", 42))
    parser.add_argument("--num-suppliers", type=int, default=mock_cfg.get("num_suppliers", 6))
    parser.add_argument("--num-parts", type=int, default=mock_cfg.get("num_parts", 12))
    args = parser.parse_args()
    generate(args.seed, args.num_suppliers, args.num_parts)


if __name__ == "__main__":
    main()
