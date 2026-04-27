import asyncio
import json
import logging
from typing import Any, Callable

from agent.reviewer_finder_agent import find_reviewers
from backend.services import job_storage

logger = logging.getLogger(__name__)

_SEMAPHORE = asyncio.Semaphore(2)


def _extract_json_from_output(output: str) -> str:
    """Return the JSON portion of the agent output.

    The agent sometimes emits narrative reasoning before the final JSON block
    within the same text block. The JSON object always begins on its own line,
    so find the last occurrence of a newline followed by '{' and slice from there.
    """
    stripped = output.strip()
    if stripped.startswith("{"):
        return stripped
    idx = stripped.rfind("\n{")
    if idx != -1:
        return stripped[idx:].strip()
    return stripped  # let json.loads surface the error with the original text


def _parse_reviewers_from_output(output: str, institution: str) -> list[dict[str, Any]]:
    try:
        payload = json.loads(_extract_json_from_output(output))
        reviewers = payload["reviewers"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.error(
            "Failed to parse agent JSON for %s: %s. Output: %s",
            institution, exc, output[:500],
        )
        return [{"institution": institution, "raw": output, "parse_error": str(exc)}]

    for reviewer in reviewers:
        reviewer["institution"] = institution
    return reviewers


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
        log_messages: list[str] = []

        def _on_progress(msg: str) -> None:
            log_messages.append(msg)
            on_event({"type": "log", "institution": institution, "message": msg})

        try:
            output, usage = await find_reviewers(
                abstract=abstract_text,
                institution=institution,
                num_reviewers=num_reviewers,
                year_from=year_from,
                year_to=year_to,
                exclude_authors=exclude_authors,
                on_progress=_on_progress,
            )
            results = _parse_reviewers_from_output(output, institution)
            job_storage.append_results(job_id, institution, results)
            job_storage.append_log(job_id, institution, log_messages)
            on_event({"type": "progress", "institution": institution, "status": "done", "count": len(results)})
        except Exception as exc:
            logger.error("Matching failed for institution %s: %s", institution, exc)
            job_storage.append_log(job_id, institution, log_messages)
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
