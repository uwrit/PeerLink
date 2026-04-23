import asyncio
import logging
import re
from typing import Any, Callable

from agent.reviewer_finder_agent import find_reviewers
from backend.services import job_storage

logger = logging.getLogger(__name__)

_SEMAPHORE = asyncio.Semaphore(2)


def _parse_reviewers_from_output(output: str, institution: str) -> list[dict[str, Any]]:
    """
    Best-effort parse of the agent's markdown text output into structured reviewer dicts.
    The agent returns a numbered list of reviewers with name, affiliation, topics, justification.
    Falls back to storing the raw text if parsing fails.
    """
    reviewers = []
    # Split on numbered list entries: "1.", "2.", etc.
    blocks = re.split(r"\n(?=\d+\.)", output.strip())
    for block in blocks:
        if not block.strip():
            continue
        lines = [l.strip() for l in block.strip().splitlines() if l.strip()]
        if not lines:
            continue
        name_line = re.sub(r"^\d+\.\s*\*{0,2}", "", lines[0]).strip("* ")
        reviewer: dict[str, Any] = {
            "institution": institution,
            "reviewer_name": name_line,
            "raw": block.strip(),
        }
        for line in lines[1:]:
            lower = line.lower()
            if "openalex" in lower or "openalex.org" in lower:
                match = re.search(r"https?://\S+", line)
                if match:
                    reviewer["openalex_id"] = match.group()
            elif "orcid" in lower:
                match = re.search(r"\d{4}-\d{4}-\d{4}-\d{3}[\dX]", line)
                if match:
                    reviewer["orcid"] = match.group()
            elif "h-index" in lower or "h index" in lower:
                match = re.search(r"\d+", line)
                if match:
                    reviewer["h_index"] = int(match.group())
            elif "justification" in lower or "rationale" in lower:
                reviewer["justification"] = re.sub(r".*?:\s*", "", line, count=1)
        reviewers.append(reviewer)
    return reviewers if reviewers else [{"institution": institution, "raw": output}]


async def _run_one(
    job_id: int,
    abstract_text: str,
    exclude_authors: list[str],
    institution: str,
    num_reviewers: int,
    year_from: int,
    year_to: int | None,
    on_event: Callable[[dict[str, Any]], None],
) -> None:
    async with _SEMAPHORE:
        job_storage.update_job(job_id, {
            "progress": {
                **job_storage.get_job(job_id)["progress"],
                institution: "running",
            }
        })
        on_event({"type": "progress", "institution": institution, "status": "running"})
        try:
            output, usage = await find_reviewers(
                abstract=abstract_text,
                institution=institution,
                num_reviewers=num_reviewers,
                year_from=year_from,
                year_to=year_to,
                exclude_authors=exclude_authors,
                on_progress=lambda msg: on_event({"type": "log", "institution": institution, "message": msg}),
            )
            results = _parse_reviewers_from_output(output, institution)
            job_storage.append_results(job_id, institution, results)
            on_event({"type": "progress", "institution": institution, "status": "done", "count": len(results)})
        except Exception as exc:
            logger.error("Matching failed for institution %s: %s", institution, exc)
            job_storage.update_job(job_id, {
                "progress": {
                    **job_storage.get_job(job_id)["progress"],
                    institution: "error",
                }
            })
            on_event({"type": "progress", "institution": institution, "status": "error", "error": str(exc)})


async def run_matching_job(
    job_id: int,
    abstract_text: str,
    exclude_authors: list[str],
    institutions: list[dict[str, Any]],
    year_from: int,
    year_to: int | None,
    on_event: Callable[[dict[str, Any]], None],
) -> None:
    job_storage.update_job(job_id, {"status": "running"})
    on_event({"type": "started", "job_id": job_id})

    tasks = [
        _run_one(
            job_id=job_id,
            abstract_text=abstract_text,
            exclude_authors=exclude_authors,
            institution=inst["name"],
            num_reviewers=inst["count"],
            year_from=year_from,
            year_to=year_to,
            on_event=on_event,
        )
        for inst in institutions
    ]
    await asyncio.gather(*tasks)

    job_storage.update_job(job_id, {"status": "done"})
    on_event({"type": "done", "job_id": job_id})
