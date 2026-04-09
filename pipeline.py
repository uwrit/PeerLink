"""
PeerLink Pipeline — Gravity Forms → Airtable

Flow:
  1. Poll Gravity Forms API for all entries (form 140).
  2. Check Airtable Abstracts for already-processed GF Entry IDs.
  3. For each new entry:
       a. Download the uploaded PDF and extract its text.
       b. Create a record in Airtable Abstracts (logs the request).
       c. Run the reviewer-finder agent.
       d. Parse structured reviewer JSON from agent output.
       e. Write reviewer records to Airtable Outputs.
       f. Mark the Abstracts record as Processed.
  4. Vetted reviewers (Outputs rows with "Vetted" checked) are fetched once
     at startup and passed to the agent as pre-approved candidates.

Required .env vars:
  ANTHROPIC_API_KEY      — Claude API key
  AIRTABLE_API_KEY       — Airtable personal access token
  AIRTABLE_BASE_ID       — Airtable base ID (appXXXXXXXX)
  GF_CONSUMER_KEY        — Gravity Forms REST API consumer key
  GF_CONSUMER_SECRET     — Gravity Forms REST API consumer secret

Optional .env vars (defaults shown):
  ABSTRACTS_TABLE        — "Abstracts"
  OUTPUTS_TABLE          — "Outputs"
  GF_FORM_ID             — 140
  DEFAULT_INSTITUTION    — "University of Washington"
  DEFAULT_YEAR_FROM      — 2020
  DEFAULT_NUM_REVIEWERS  — 5

Airtable schema — Abstracts table
----------------------------------
  GF Entry ID       (Single line text)  <- links back to Gravity Forms entry
  Title             (Single line text)
  Abstract          (Long text)          <- extracted from PDF
  Institution       (Single line text)
  Year From         (Number)
  Num Reviewers     (Number)
  Exclude Authors   (Long text)          <- comma-separated COI names from form
  Applicant Name    (Single line text)
  Applicant Email   (Single line text)
  Award Type        (Single line text)
  PDF URL           (URL)
  Processed         (Checkbox)
  Processing Notes  (Long text)

Airtable schema — Outputs table (unchanged)
--------------------------------------------
  Reviewer Name           (Single line text)
  OpenAlex ID             (Single line text)
  Affiliation             (Single line text)
  H-Index                 (Number)
  Total Works             (Number)
  Total Citations         (Number)
  Top Topics              (Long text)
  Relevance Justification (Long text)
  Abstract Titles         (Single line text)
  Abstract Record IDs     (Single line text)
  Vetted                  (Checkbox)
  Full Agent Output       (Long text)
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
from gravity_forms_client import GravityFormsClient, extract_pdf_text, parse_entry
from reviewer_finder_agent import find_reviewers, INSTITUTIONS

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

AIRTABLE_API_KEY = os.environ.get("AIRTABLE_API_KEY", "")
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "")
GF_CONSUMER_KEY = os.environ.get("GF_CONSUMER_KEY", "")
GF_CONSUMER_SECRET = os.environ.get("GF_CONSUMER_SECRET", "")

ABSTRACTS_TABLE = os.getenv("ABSTRACTS_TABLE", "Abstracts")
OUTPUTS_TABLE = os.getenv("OUTPUTS_TABLE", "Outputs")
GF_FORM_ID = int(os.getenv("GF_FORM_ID", "140"))
DEFAULT_INSTITUTION = os.getenv("DEFAULT_INSTITUTION", "University of Washington")
DEFAULT_YEAR_FROM = int(os.getenv("DEFAULT_YEAR_FROM", "2020"))
DEFAULT_NUM_REVIEWERS = int(os.getenv("DEFAULT_NUM_REVIEWERS", "5"))

_MISSING = [k for k, v in {
    "AIRTABLE_API_KEY": AIRTABLE_API_KEY,
    "AIRTABLE_BASE_ID": AIRTABLE_BASE_ID,
    "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
    "GF_CONSUMER_KEY": GF_CONSUMER_KEY,
    "GF_CONSUMER_SECRET": GF_CONSUMER_SECRET,
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
    """Airtable long-text fields cap at ~100 000 chars; leave a buffer."""
    if len(text) <= limit:
        return text
    return text[:limit] + "\n\n[truncated]"


# ---------------------------------------------------------------------------
# Airtable helpers
# ---------------------------------------------------------------------------

async def _get_vetted_reviewers(client: AirtableClient) -> list[dict[str, Any]]:
    """Return all Outputs rows where the Vetted checkbox is checked."""
    records = await client.list_records(OUTPUTS_TABLE, filter_formula="{Vetted}=1")
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


async def _get_processed_gf_ids(client: AirtableClient) -> set[str]:
    """Return the set of GF Entry IDs already present in the Abstracts table."""
    records = await client.list_records(
        ABSTRACTS_TABLE,
        fields=["GF Entry ID"],
    )
    ids: set[str] = set()
    for r in records:
        gf_id = r.get("fields", {}).get("GF Entry ID", "")
        if gf_id:
            ids.add(str(gf_id))
    return ids


# ---------------------------------------------------------------------------
# Per-entry processing
# ---------------------------------------------------------------------------

async def _process_entry(
    at_client: AirtableClient,
    gf_client: GravityFormsClient,
    entry: dict[str, Any],
    vetted_reviewers: list[dict[str, Any]],
) -> None:
    parsed = parse_entry(entry)
    gf_id = parsed["gf_entry_id"]
    title = parsed["title"] or f"GF Entry {gf_id}"
    pdf_url = parsed["pdf_url"]
    institution = DEFAULT_INSTITUTION
    institution_id = INSTITUTIONS.get(institution)

    print(f"\n{'='*60}")
    print(f"GF Entry  : {gf_id}  ({parsed['date_updated']})")
    print(f"Title     : {title}")
    print(f"Applicant : {parsed['applicant_name']} <{parsed['applicant_email']}>")
    print(f"Award     : {parsed['award_type']}")
    print(f"COI       : {parsed['exclude_authors'] or 'none'}")
    print(f"{'='*60}")

    # --- Create Abstracts record (in-progress) ----------------------------
    abstracts_record = await at_client.create_record(ABSTRACTS_TABLE, {
        "GF Entry ID": gf_id,
        "Title": title,
        "Institution": institution,
        "Year From": DEFAULT_YEAR_FROM,
        "Num Reviewers": DEFAULT_NUM_REVIEWERS,
        "Exclude Authors": ", ".join(parsed["exclude_authors"]),
        "Applicant Name": parsed["applicant_name"],
        "Applicant Email": parsed["applicant_email"],
        "Award Type": parsed["award_type"],
        "PDF URL": pdf_url,
        "Processed": False,
        "Processing Notes": "In progress...",
    })
    abstracts_record_id: str = abstracts_record["id"]

    # --- Download & extract PDF -------------------------------------------
    if not pdf_url:
        note = "Skipped: no PDF URL in form entry."
        print(f"  {note}")
        await at_client.update_record(ABSTRACTS_TABLE, abstracts_record_id, {
            "Processed": True,
            "Processing Notes": note,
        })
        return

    print(f"  Downloading PDF...")
    try:
        pdf_bytes = await gf_client.download_pdf(pdf_url)
        abstract_text = extract_pdf_text(pdf_bytes)
        print(f"  Extracted {len(abstract_text):,} chars from PDF.")
    except Exception as exc:
        note = f"PDF error: {exc}"
        print(f"  {note}")
        await at_client.update_record(ABSTRACTS_TABLE, abstracts_record_id, {
            "Processed": True,
            "Processing Notes": note,
        })
        return

    if not abstract_text:
        note = "PDF downloaded but no text could be extracted (may be scanned/image-based)."
        print(f"  {note}")
        await at_client.update_record(ABSTRACTS_TABLE, abstracts_record_id, {
            "Processed": True,
            "Processing Notes": note,
        })
        return

    # Store extracted abstract in Airtable for reference
    await at_client.update_record(ABSTRACTS_TABLE, abstracts_record_id, {
        "Abstract": _truncate(abstract_text, 95_000),
    })

    # --- Run the agent ----------------------------------------------------
    print(f"  Running reviewer-finder agent...")
    try:
        output, usage = await find_reviewers(
            abstract=abstract_text,
            institution=institution,
            institution_id=institution_id,
            year_from=DEFAULT_YEAR_FROM,
            num_reviewers=DEFAULT_NUM_REVIEWERS,
            exclude_authors=parsed["exclude_authors"] or None,
            vetted_reviewers=vetted_reviewers or None,
        )
    except Exception as exc:
        note = f"Agent error: {exc}"
        print(f"  {note}")
        await at_client.update_record(ABSTRACTS_TABLE, abstracts_record_id, {
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
    write_ok = True
    try:
        rows_to_create = []
        for i, r in enumerate(reviewers):
            topics = r.get("top_topics", [])
            topics_str = ", ".join(topics) if isinstance(topics, list) else str(topics)
            rows_to_create.append({
                "Reviewer Name": r.get("name", ""),
                "OpenAlex ID": r.get("openalex_id", ""),
                "Affiliation": r.get("affiliation", ""),
                "H-Index": r.get("h_index"),
                "Total Works": r.get("total_works"),
                "Total Citations": r.get("total_citations"),
                "Top Topics": topics_str,
                "Relevance Justification": r.get("relevance_justification", ""),
                "Abstract Titles": title,
                "Abstract Record IDs": abstracts_record_id,
                "Full Agent Output": _truncate(output) if i == 0 else None,
            })

        if rows_to_create:
            created = await at_client.create_records_batch(OUTPUTS_TABLE, rows_to_create)
            print(f"  Created {len(created)} output record(s) in '{OUTPUTS_TABLE}'.")
        elif not reviewers:
            # Fallback: store raw output
            await at_client.create_record(OUTPUTS_TABLE, {
                "Abstract Titles": title,
                "Abstract Record IDs": abstracts_record_id,
                "Full Agent Output": _truncate(output),
                "Relevance Justification": "See Full Agent Output — structured parsing failed.",
            })
            print("  Created 1 fallback output record (raw output only).")
    except Exception as exc:
        print(f"  ERROR writing to Outputs table: {exc}")
        write_ok = False

    # --- Mark abstract as processed ---------------------------------------
    cost = usage.get("total_cost_usd")
    cost_str = f"${cost:.4f}" if cost is not None else "N/A"
    note = (
        f"{'OK' if write_ok else 'Agent OK but Outputs write failed'} — "
        f"{len(reviewers)} reviewer(s) found. "
        f"Cost: {cost_str} | Turns: {usage.get('num_turns', '?')} | "
        f"Duration: {usage.get('duration_ms', 0)/1000:.1f}s"
    )
    await at_client.update_record(ABSTRACTS_TABLE, abstracts_record_id, {
        "Processed": True,
        "Processing Notes": note,
    })
    print(f"  Marked as processed. {note}")


# ---------------------------------------------------------------------------
# Pipeline entry point
# ---------------------------------------------------------------------------

async def run_pipeline() -> None:
    at_client = AirtableClient(AIRTABLE_API_KEY, AIRTABLE_BASE_ID)
    gf_client = GravityFormsClient(GF_CONSUMER_KEY, GF_CONSUMER_SECRET)

    # 1. Fetch vetted reviewers (shared across all entries this run)
    print("Fetching vetted reviewers from Airtable...")
    vetted = await _get_vetted_reviewers(at_client)
    print(f"  Found {len(vetted)} vetted reviewer(s).")

    # 2. Find which GF entries are already processed
    print(f"\nFetching processed GF entry IDs from '{ABSTRACTS_TABLE}'...")
    processed_ids = await _get_processed_gf_ids(at_client)
    print(f"  {len(processed_ids)} entries already processed.")

    # 3. Pull all GF entries
    print(f"\nFetching entries from Gravity Forms (form {GF_FORM_ID})...")
    all_entries = await gf_client.get_all_entries(form_id=GF_FORM_ID)
    print(f"  Total GF entries: {len(all_entries)}")

    # 4. Filter to new entries
    new_entries = [e for e in all_entries if str(e.get("id", "")) not in processed_ids]
    print(f"  New entries to process: {len(new_entries)}")

    if not new_entries:
        print("\nNothing new to process. Done.")
        return

    # 5. Process each entry sequentially
    for i, entry in enumerate(new_entries, 1):
        print(f"\n[{i}/{len(new_entries)}] Processing GF entry {entry.get('id')}...")
        await _process_entry(at_client, gf_client, entry, vetted)

    print(f"\n{'='*60}")
    print(f"Pipeline complete. Processed {len(new_entries)} new entry/entries.")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(run_pipeline())
