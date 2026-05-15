import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from backend.config import settings
from backend.services.affiliations import affiliation_from_email
from backend.services.storage import Storage
from api.gravity_forms_client import GravityFormsClient, extract_pdf_text, parse_entry

logger = logging.getLogger(__name__)


_MAX_CONCURRENT_PDF_DOWNLOADS = 6


async def _fetch_abstract_text(
    client: GravityFormsClient,
    pdf_url: str,
    label: str = "",
    sem: asyncio.Semaphore | None = None,
) -> str:
    if not pdf_url:
        return ""

    async def _run() -> str:
        print(f"  [PDF] Downloading: {label or pdf_url}")
        try:
            pdf_bytes = await client.download_pdf(pdf_url)
            print(f"  [PDF] Extracting abstract: {label or pdf_url}")
            result = await asyncio.to_thread(
                extract_pdf_text, pdf_bytes, True, max_pages=5
            )
            print(f"  [PDF] Done: {label or pdf_url} ({len(result)} chars)")
            return result
        except Exception as exc:
            print(f"  [PDF] FAILED: {label or pdf_url} — {exc}")
            logger.warning("PDF extraction failed for %s: %s", pdf_url, exc)
            return ""

    if sem is None:
        return await _run()
    async with sem:
        return await _run()


async def sync_gravity_forms(storage: Storage) -> dict[str, int]:
    """
    Pull all entries from Gravity Forms and upsert into storage.
    Returns counts of inserted and updated rows.
    """
    if not settings.gf_consumer_key or not settings.gf_consumer_secret:
        raise RuntimeError(
            "GRAVITY_FORMS_API_CONSUMER_KEY / GRAVITY_FORMS_API_CONSUMER_SECRET not set in environment"
        )

    client = GravityFormsClient(settings.gf_consumer_key, settings.gf_consumer_secret)
    raw_entries: list[dict[str, Any]] = await client.get_all_entries()
    logger.info("Fetched %d entries from Gravity Forms", len(raw_entries))

    inserted = 0
    updated = 0

    parsed_entries = [parse_entry(raw) for raw in raw_entries if raw.get("id")]

    print(
        f"[Sync] Processing {len(parsed_entries)} applications "
        f"(max {_MAX_CONCURRENT_PDF_DOWNLOADS} concurrent downloads)..."
    )
    sem = asyncio.Semaphore(_MAX_CONCURRENT_PDF_DOWNLOADS)
    abstract_texts = await asyncio.gather(
        *[
            _fetch_abstract_text(
                client,
                p["pdf_url"],
                label=p["title"] or p["gf_entry_id"],
                sem=sem,
            )
            for p in parsed_entries
        ]
    )

    for parsed, abstract_text in zip(parsed_entries, abstract_texts):
        gf_entry_id = parsed["gf_entry_id"]
        if not gf_entry_id:
            continue

        affiliation = affiliation_from_email(parsed["applicant_email"])

        submitted_at: str | None = None
        if parsed.get("date_updated"):
            try:
                dt = datetime.fromisoformat(parsed["date_updated"].replace(" ", "T"))
                submitted_at = dt.isoformat()
            except ValueError:
                pass

        existing = storage.get_by_gf_entry_id(gf_entry_id)

        record = {
            "gf_entry_id": gf_entry_id,
            "title": parsed["title"],
            "abstract_text": abstract_text,
            "pdf_url": parsed["pdf_url"],
            "program": parsed["award_type"],
            "applicant_name": parsed["applicant_name"],
            "applicant_email": parsed["applicant_email"],
            "affiliation": affiliation,
            "exclude_authors_json": json.dumps(parsed["exclude_authors"]),
            "submitted_at": submitted_at,
        }

        storage.upsert(record)

        if existing:
            updated += 1
        else:
            inserted += 1

    print(f"[Sync] Done — inserted={inserted} updated={updated}")
    logger.info("GF sync done — inserted=%d updated=%d", inserted, updated)
    return {"inserted": inserted, "updated": updated}
