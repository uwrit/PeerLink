#!/usr/bin/env python3
"""
populate_db.py — seed the MariaDB database for PeerLink

What it does:
  1. Syncs all abstracts from Gravity Forms into the `abstracts` table
  2. Seeds synthetic match jobs for previous year (2024), current year (2025),
     and next year (2026) so the UI has data across all time ranges

Usage (local, DB on host port 3307):
  STORAGE_BACKEND=mariadb \
  DATABASE_URL=mysql+pymysql://peerlink:peerlink@localhost:3307/peerlink \
  GRAVITY_FORMS_API_CONSUMER_KEY=... \
  GRAVITY_FORMS_API_CONSUMER_SECRET=... \
  python scripts/populate_db.py

  Or if running inside Docker (DB reachable as "db:3306" from within the network):
    docker compose exec backend python scripts/populate_db.py
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone

# Make sure the project root and src/ are on the path
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _root)
sys.path.insert(0, os.path.join(_root, "src"))

os.environ.setdefault("STORAGE_BACKEND", "mariadb")

from dotenv import load_dotenv
load_dotenv()

from backend.db import cursor
from backend.services.storage import get_storage
from backend.services.gf_sync import sync_gravity_forms
from backend.services import job_storage


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_tables() -> None:
    """Create tables if they don't exist yet (idempotent)."""
    with cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS abstracts (
              id            INT AUTO_INCREMENT PRIMARY KEY,
              gf_entry_id   VARCHAR(64) UNIQUE,
              data          JSON NOT NULL,
              created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
              id            INT AUTO_INCREMENT PRIMARY KEY,
              data          JSON NOT NULL,
              created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
    print("[DB] Tables ready.")


def count_rows() -> tuple[int, int]:
    with cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM abstracts")
        abstracts = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM jobs")
        jobs = cur.fetchone()["n"]
    return abstracts, jobs


# ── Step 1: Gravity Forms sync ────────────────────────────────────────────────

async def step_sync_gf() -> None:
    print("\n[Step 1] Syncing abstracts from Gravity Forms...")
    storage = get_storage()
    try:
        result = await sync_gravity_forms(storage)
        print(f"[Step 1] Done — inserted={result['inserted']} updated={result['updated']}")
    except RuntimeError as exc:
        print(f"[Step 1] SKIPPED — {exc}")
        print("         Set GRAVITY_FORMS_API_CONSUMER_KEY and _SECRET to enable GF sync.")


# ── Step 2: Seed synthetic jobs ───────────────────────────────────────────────

SEED_INSTITUTIONS = [
    {"name": "University of Washington", "count": 2},
    {"name": "Washington State University", "count": 2},
]

SAMPLE_REVIEWERS = {
    "University of Washington": [
        {
            "reviewer_name": "Carolyn Baylor",
            "institution": "University of Washington",
            "orcid": "0000-0001-7185-7528",
            "h_index": 28,
            "justification": "Expert in patient-reported outcome measures for communication disorders.",
        },
        {
            "reviewer_name": "Trevor Cohen",
            "institution": "University of Washington",
            "orcid": "0000-0003-0159-6697",
            "h_index": 36,
            "justification": "Leading researcher in biomedical NLP and large language models for healthcare.",
        },
    ],
    "Washington State University": [
        {
            "reviewer_name": "Maureen Schmitter-Edgecombe",
            "institution": "Washington State University",
            "orcid": "0000-0002-5304-2146",
            "h_index": 52,
            "justification": "Expert in digital health technology for cognitively affected populations.",
        },
        {
            "reviewer_name": "Catherine Van Son",
            "institution": "Washington State University",
            "orcid": "0000-0002-0491-5748",
            "h_index": 11,
            "justification": "Researcher in speech-language pathology and assistive communication technology.",
        },
    ],
}


def seed_jobs(abstracts: list[dict], storage) -> None:
    """Seed one completed job per year (2024, 2025, 2026) using real abstracts if available."""
    print("\n[Step 2] Seeding synthetic match jobs...")

    # Check which years already have seed jobs (keyed by year_from on seeded jobs)
    existing_jobs = job_storage.list_jobs()
    seeded_years = {j["year_from"] for j in existing_jobs if j.get("seed_note")}

    years = [
        (2024, 2024),  # previous year
        (2025, 2025),  # current year
        (2026, 2026),  # next year
    ]

    # Use real abstract IDs if available, otherwise use placeholder IDs 1-3
    abstract_ids = [a["id"] for a in abstracts[:3]] if abstracts else [1, 2, 3]
    # Pad if fewer than 3 abstracts
    while len(abstract_ids) < 3:
        abstract_ids.append(abstract_ids[-1] if abstract_ids else 1)

    for (year_from, year_to), abstract_id in zip(years, abstract_ids):
        if year_from in seeded_years:
            print(f"  [Year {year_from}] Already seeded, skipping.")
            continue

        results = []
        for inst_name, reviewers in SAMPLE_REVIEWERS.items():
            results.extend(reviewers)

        job = job_storage.create_job(
            abstract_id=abstract_id,
            institutions=SEED_INSTITUTIONS,
            year_from=year_from,
            year_to=year_to,
        )

        job_storage.update_job(job["id"], {
            "status": "done",
            "results": results,
            "progress": {inst["name"]: "done" for inst in SEED_INSTITUTIONS},
            "completed_at": now_iso(),
            "seed_note": f"Seeded by populate_db.py for year {year_from}",
        })
        storage.update(abstract_id, {"status": "matched"})

        print(f"  [Year {year_from}] Created job #{job['id']} for abstract_id={abstract_id} "
              f"with {len(results)} reviewers.")

    print("[Step 2] Done.")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("=" * 60)
    print("PeerLink DB Population Script")
    print("=" * 60)

    ensure_tables()

    a_before, j_before = count_rows()
    print(f"[DB] Current state: {a_before} abstracts, {j_before} jobs")

    await step_sync_gf()

    storage = get_storage()
    abstracts = storage.get_all()
    print(f"[DB] Abstracts after sync: {len(abstracts)}")

    seed_jobs(abstracts, storage)

    a_after, j_after = count_rows()
    print(f"\n[DB] Final state: {a_after} abstracts, {j_after} jobs")
    print("\nDone! The database is ready.")


if __name__ == "__main__":
    asyncio.run(main())
