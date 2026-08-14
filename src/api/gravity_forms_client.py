from typing import Any
import aiohttp

GF_BASE = "https://www.iths.org/wp-json/gf/v2"
FORM_ID = 140

# Fields to pull on every entry fetch.
# 49=award type, 2=email, 15=project title, 8=institution, 97=project abstract
# Name sub-fields: 96.3=first, 96.4=middle, 96.6=last
# Reviewer name sub-fields (used as COI): 54, 58, 59, 79, 80
ENTRY_FIELDS = (
    "id,date_updated,49,"
    "96.3,96.4,96.6,"
    "2,15,8,97,"
    "54.3,54.6,58.3,58.6,59.3,59.6,79.3,79.6,80.3,80.6"
)


class GravityFormsClient:
    def __init__(self, consumer_key: str, consumer_secret: str):
        import base64
        token = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()
        self._auth = {"Authorization": f"Basic {token}"}

    async def get_all_entries(
        self,
        form_id: int = FORM_ID,
        # Number of applications to fetch
        page_size: int = 5,
        field_ids: str = ENTRY_FIELDS,
    ) -> list[dict[str, Any]]:
        url = (
            f"{GF_BASE}/forms/{form_id}/entries"
            f"?paging[page_size]={page_size}"
            f"&_field_ids={field_ids}"
        )
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self._auth) as resp:
                if not resp.ok:
                    body = await resp.text()
                    raise RuntimeError(f"GF API error {resp.status}: {body[:400]}")
                data = await resp.json()
        return data.get("entries", [])


def parse_entry(entry: dict[str, Any]) -> dict[str, Any]:
    """
    Map raw GF field values to a clean dict used by the pipeline.
    """
    def _name(*parts: str) -> str:
        return " ".join(p.strip() for p in parts if p.strip())

    applicant_name = _name(
        entry.get("96.3", ""),
        entry.get("96.4", ""),
        entry.get("96.6", ""),
    )

    # Collect reviewer names for COI exclusion
    reviewer_pairs = [
        (entry.get("54.3", ""), entry.get("54.6", "")),
        (entry.get("58.3", ""), entry.get("58.6", "")),
        (entry.get("59.3", ""), entry.get("59.6", "")),
        (entry.get("79.3", ""), entry.get("79.6", "")),
        (entry.get("80.3", ""), entry.get("80.6", "")),
    ]
    exclude_authors = [
        _name(first, last)
        for first, last in reviewer_pairs
        if _name(first, last)
    ]

    return {
        "gf_entry_id": str(entry.get("id", "")),
        "date_updated": entry.get("date_updated", ""),
        "title": entry.get("15", "").strip(),
        "award_type": entry.get("49", "").strip(),
        "applicant_name": applicant_name,
        "applicant_email": entry.get("2", "").strip(),
        "institution": entry.get("8", "").strip(),
        "abstract_text": entry.get("97", "").strip(),
        "exclude_authors": exclude_authors,
    }
