import json
import logging
from datetime import datetime
from typing import Any

from backend.config import settings
from backend.services.storage import Storage
from api.gravity_forms_client import GravityFormsClient, parse_entry

logger = logging.getLogger(__name__)


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

    print(f"[Sync] Processing {len(parsed_entries)} applications...")

    for parsed in parsed_entries:
        gf_entry_id = parsed["gf_entry_id"]
        if not gf_entry_id:
            continue

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
            "abstract_text": parsed["abstract_text"],
            "program": parsed["award_type"],
            "applicant_name": parsed["applicant_name"],
            "applicant_email": parsed["applicant_email"],
            "affiliation": parsed["institution"],
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
