"""
PeerLink Airtable Pipeline

Reads unprocessed abstracts from Airtable → runs the reviewer-finder agent →
writes structured reviewer records back to Airtable.

Vetted reviewers (Outputs rows where "Vetted" checkbox is checked) are fetched
once at startup and passed to the agent as pre-approved candidates for each
abstract.

Required .env vars:
  ANTHROPIC_API_KEY      — Claude API key
  AIRTABLE_API_KEY       — Airtable personal access token
  AIRTABLE_BASE_ID       — Airtable base ID (found in the base URL: appXXXXXXXX)

Optional .env vars (defaults shown):
  ABSTRACTS_TABLE        — "Abstracts"
  OUTPUTS_TABLE          — "Outputs"

Airtable schema expected
------------------------
Abstracts table:
  Title             (Single line text)
  Abstract          (Long text)          ← the grant text
  Institution       (Single line text)   ← must match INSTITUTIONS dict key
  Year From         (Number)             ← default 2020
  Num Reviewers     (Number)             ← default 5
  Exclude Authors   (Long text)          ← comma-separated COI names
  Processed         (Checkbox)           ← pipeline sets this when done
  Processing Notes  (Long text)          ← pipeline writes status / errors here

Outputs table:
  Reviewer Name         (Single line text)
  OpenAlex ID           (Single line text)
  Affiliation           (Single line text)
  H-Index               (Number)
  Total Works           (Number)
  Total Citations       (Number)
  Top Topics            (Long text)
  Relevance Justification (Long text)
  Abstract Title        (Single line text)
  Abstract Record ID    (Single line text)
  Vetted                (Checkbox)        ← check to promote reviewer to vetted pool
  Full Agent Output     (Long text)       ← stored on the first reviewer row only
"""

import asyncio
import json
import os
import re
import sys
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from airtable_client import AirtableClient
from reviewer_finder_agent import find_reviewers, INSTITUTIONS

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

AIRTABLE_API_KEY = os.environ.get("AIRTABLE_API_KEY", "")
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "")
ABSTRACTS_TABLE = os.getenv("ABSTRACTS_TABLE", "Abstracts")
OUTPUTS_TABLE = os.getenv("OUTPUTS_TABLE", "Outputs")

_MISSING = [k for k, v in {
    "AIRTABLE_API_KEY": AIRTABLE_API_KEY,
    "AIRTABLE_BASE_ID": AIRTABLE_BASE_ID,
    "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
}.items() if not v]

if _MISSING:
    print(f"ERROR: Missing required env vars: {', '.join(_MISSING)}")
    print("Add them to your .env file and retry.")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _parse_reviewers_json(output: str) -> list[dict[str, Any]]:
    """Extract the structured ```json ... ``` block from agent output."""
    match = re.search(r"```json\s*([\s\S]*?)\s*```", output)
    if not match:
        return []
    try:
        parsed = json.loads(match.group(1))
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError as exc:
        print(f"  WARNING: Could not parse reviewer JSON: {exc}")
        return []


def _truncate(text: str, limit: int = 95_000) -> str:
    """Airtable long-text fields cap at 100 000 chars; leave a small buffer."""
    if len(text) <= limit:
        return text
    return text[:limit] + "\n\n[truncated]"


# ---------------------------------------------------------------------------
# Airtable helpers
# ---------------------------------------------------------------------------

async def _get_vetted_reviewers(client: AirtableClient) -> list[dict[str, Any]]:
    """Return all Outputs rows where the Vetted checkbox is checked."""
    records = await client.list_records(
        OUTPUTS_TABLE,
        filter_formula="{Vetted}=1",
    )
    vetted = []
    for r in records:
        f = r.get("fields", {})
        topics_raw = f.get("Top Topics", "")
        topics = [t.strip() for t in topics_raw.split(",")] if topics_raw else []
        vetted.append({
            "name": f.get("Reviewer Name", ""),
            "openalex_id": f.get("OpenAlex ID", ""),
            "affiliation": f.get("Affiliation", ""),
            "h_index": f.get("H-Index"),
            "top_topics": topics,
        })
    return vetted


# ---------------------------------------------------------------------------
# Per-abstract processing
# ---------------------------------------------------------------------------

async def _process_abstract(
    client: AirtableClient,
    record: dict[str, Any],
    vetted_reviewers: list[dict[str, Any]],
) -> None:
    record_id: str = record["id"]
    fields: dict[str, Any] = record.get("fields", {})

    title = fields.get("Title", "Untitled")
    abstract = fields.get("Abstract", "").strip()
    institution = (fields.get("Institution") or "University of Washington").strip()
    year_from = int(fields.get("Year From") or 2020)
    num_reviewers = int(fields.get("Num Reviewers") or 5)
    exclude_raw = fields.get("Exclude Authors", "") or ""
    exclude_authors = [a.strip() for a in exclude_raw.split(",") if a.strip()]

    print(f"\n{'='*60}")
    print(f"Abstract : {title}")
    print(f"Institution: {institution}  |  Year from: {year_from}  |  Reviewers: {num_reviewers}")
    print(f"Vetted pool: {len(vetted_reviewers)} reviewer(s) available")
    print(f"{'='*60}")

    # --- Validate inputs --------------------------------------------------
    if not abstract:
        note = "Skipped: no abstract text."
        print(f"  {note}")
        await client.update_record(ABSTRACTS_TABLE, record_id, {
            "Processed": True,
            "Processing Notes": note,
        })
        return

    institution_id = INSTITUTIONS.get(institution)
    if institution_id is None:
        note = (
            f"Error: unknown institution '{institution}'. "
            f"Valid options: {', '.join(INSTITUTIONS.keys())}"
        )
        print(f"  {note}")
        await client.update_record(ABSTRACTS_TABLE, record_id, {
            "Processed": True,
            "Processing Notes": note,
        })
        return

    # --- Run the agent ----------------------------------------------------
    try:
        output, usage = await find_reviewers(
            abstract=abstract,
            institution=institution,
            institution_id=institution_id,
            year_from=year_from,
            num_reviewers=num_reviewers,
            exclude_authors=exclude_authors or None,
            vetted_reviewers=vetted_reviewers or None,
        )
    except Exception as exc:
        note = f"Agent error: {exc}"
        print(f"  {note}")
        await client.update_record(ABSTRACTS_TABLE, record_id, {
            "Processed": True,
            "Processing Notes": note,
        })
        return

    # --- Parse structured reviewer data -----------------------------------
    reviewers = _parse_reviewers_json(output)
    print(f"  Agent done. Parsed {len(reviewers)} structured reviewer(s).")

    if not reviewers:
        print("  WARNING: No JSON block found in output — storing raw output only.")

    # --- Write reviewer rows to Outputs table -----------------------------
    try:
        rows_to_create = []
        for i, r in enumerate(reviewers):
            topics = r.get("top_topics", [])
            topics_str = ", ".join(topics) if isinstance(topics, list) else str(topics)

            row: dict[str, Any] = {
                "Reviewer Name": r.get("name", ""),
                "OpenAlex ID": r.get("openalex_id", ""),
                "Affiliation": r.get("affiliation", ""),
                "H-Index": r.get("h_index"),
                "Total Works": r.get("total_works"),
                "Total Citations": r.get("total_citations"),
                "Top Topics": topics_str,
                "Relevance Justification": r.get("relevance_justification", ""),
                "Abstract Titles": title,
                "Abstract Record IDs": record_id,
                # Full agent output goes on the first reviewer row only
                "Full Agent Output": _truncate(output) if i == 0 else None,
            }
            rows_to_create.append(row)

        if rows_to_create:
            created = await client.create_records_batch(OUTPUTS_TABLE, rows_to_create)
            print(f"  Created {len(created)} output record(s) in '{OUTPUTS_TABLE}'.")
        elif not reviewers:
            # Fallback: create a single row with just the raw output
            await client.create_record(OUTPUTS_TABLE, {
                "Abstract Titles": title,
                "Abstract Record IDs": record_id,
                "Full Agent Output": _truncate(output),
                "Relevance Justification": "See Full Agent Output — structured parsing failed.",
            })
            print("  Created 1 fallback output record (raw output only).")

        write_ok = True
    except Exception as exc:
        print(f"  ERROR writing to Outputs table: {exc}")
        write_ok = False

    # --- Mark abstract as processed ---------------------------------------
    cost = usage.get("total_cost_usd")
    cost_str = f"${cost:.4f}" if cost is not None else "N/A"
    if write_ok:
        note = (
            f"OK — {len(reviewers)} reviewer(s) found. "
            f"Cost: {cost_str} | Turns: {usage.get('num_turns', '?')} | "
            f"Duration: {usage.get('duration_ms', 0)/1000:.1f}s"
        )
    else:
        note = (
            f"Agent OK but Outputs write failed — check field names. "
            f"Cost: {cost_str} | Turns: {usage.get('num_turns', '?')}"
        )
    await client.update_record(ABSTRACTS_TABLE, record_id, {
        "Processed": True,
        "Processing Notes": note,
    })
    print(f"  Marked abstract as processed. {note}")


# ---------------------------------------------------------------------------
# Pipeline entry point
# ---------------------------------------------------------------------------

async def run_pipeline() -> None:
    client = AirtableClient(AIRTABLE_API_KEY, AIRTABLE_BASE_ID)

    # 1. Fetch vetted reviewers once (shared across all abstracts this run)
    print("Fetching vetted reviewers from Airtable...")
    vetted = await _get_vetted_reviewers(client)
    print(f"  Found {len(vetted)} vetted reviewer(s).")

    # 2. Fetch unprocessed abstracts
    print(f"\nFetching unprocessed abstracts from '{ABSTRACTS_TABLE}'...")
    pending = await client.list_records(
        ABSTRACTS_TABLE,
        filter_formula="NOT({Processed})",
    )
    print(f"  Found {len(pending)} pending abstract(s).")

    if not pending:
        print("\nNothing to process. Done.")
        return

    # 3. Process each abstract sequentially
    for i, record in enumerate(pending, 1):
        print(f"\n[{i}/{len(pending)}] Processing abstract...")
        await _process_abstract(client, record, vetted)

    print(f"\n{'='*60}")
    print(f"Pipeline complete. Processed {len(pending)} abstract(s).")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(run_pipeline())
