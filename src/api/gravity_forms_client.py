import io
from typing import Any
import aiohttp

GF_BASE = "https://www.iths.org/wp-json/gf/v2"
FORM_ID = 140

# Fields to pull on every entry fetch.
# Name sub-fields: 96.3=first, 96.4=middle, 96.6=last
# Reviewer name sub-fields (used as COI): 54, 58, 59, 79, 80
ENTRY_FIELDS = (
    "id,date_updated,15,19,49,2,"
    "96.3,96.4,96.6,"
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
        page_size: int = 10,
        field_ids: str = ENTRY_FIELDS,
    ) -> list[dict[str, Any]]:
        url = (
            f"{GF_BASE}/forms/{form_id}/entries"
            f"?paging[page_size]={page_size}"
            f"&paging[current_page]=1"
            f"&_field_ids={field_ids}"
        )
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self._auth) as resp:
                if not resp.ok:
                    body = await resp.text()
                    raise RuntimeError(f"GF API error {resp.status}: {body[:400]}")
                data = await resp.json()
        return data.get("entries", [])

    async def download_pdf(self, url: str) -> bytes:
        """Download a PDF and return its raw bytes."""
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self._auth) as resp:
                if not resp.ok:
                    raise RuntimeError(
                        f"PDF download failed {resp.status}: {url}"
                    )
                return await resp.read()


# PDF text extraction (sync helper — call from sync context or thread)
def extract_pdf_text(
    pdf_bytes: bytes,
    abstract_only: bool = False,
    max_pages: int | None = None,
) -> str:
    import re

    try:
        from pypdf import PdfReader
    except ImportError:
        raise RuntimeError(
            "pypdf is required for PDF extraction. Run: pip install pypdf"
        )

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages = reader.pages if max_pages is None else reader.pages[:max_pages]
        parts = []
        for page in pages:
            text = page.extract_text()
            if text:
                parts.append(text)
        full_text = "\n\n".join(parts).strip()
    except Exception:
        return ""

    if not abstract_only:
        return full_text

    # Matches numbered section headings like "2. Abstract" or plain "Abstract".
    # Captures everything until the next numbered section (e.g. "3. Research Plan")
    # or a known standalone heading, or end of text.
    match = re.search(
        r'(?im)^(?:\d+\.\s+)?Abstract[:\s]*$\s*(.*?)'
        r'(?=^\d+\.\s+\w|\Z)',
        full_text,
        re.DOTALL,
    )
    if match:
        text = match.group(1).strip()
        return _clean_abstract(text)

    # Fallback: "Abstract" inline with content on the same line.
    match = re.search(
        r'(?i)\bAbstract\b[:\s]+(.*?)(?=\n\d+\.\s+\w|\Z)',
        full_text,
        re.DOTALL,
    )
    if match:
        return _clean_abstract(match.group(1).strip())

    return ""


def _clean_abstract(text: str) -> str:
    import re
    # Drop form-template instruction lines (e.g. "Please insert your abstract here...")
    text = re.sub(r'(?im)^please\b[^\n]*\n?', '', text)
    # Drop page headers that leaked in: short lines followed by a known app title line
    text = re.sub(r'(?m)^.{1,60}\n(?:ITHS|University of Washington)[^\n]*\n?', '', text)
    # Fix pypdf split-capital artifacts: lone uppercase letter on its own line (e.g. "A\nccurate")
    text = re.sub(r'(?m)^([A-Z])\n([a-z])', r'\1\2', text)
    return text.strip()


# ---------------------------------------------------------------------------
# GF entry → structured dict
# ---------------------------------------------------------------------------

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
        "pdf_url": entry.get("19", "").strip(),
        "award_type": entry.get("49", "").strip(),
        "applicant_name": applicant_name,
        "applicant_email": entry.get("2", "").strip(),
        "exclude_authors": exclude_authors,
    }
