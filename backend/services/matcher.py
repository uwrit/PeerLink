from __future__ import annotations

import asyncio
import json
from datetime import datetime
from itertools import count
from typing import Any

from backend.services.storage import Storage
from agent.reviewer_finder_agent import find_reviewers_for_institutions

_job_ids = count(1)
_jobs: dict[int, dict[str, Any]] = {}
_lock = asyncio.Lock()


async def create_matching_job(
    *,
    abstract_ids: list[int],
    institutions: list[dict[str, Any]],
    year_from: int,
    year_to: int | None,
    total_reviewers: int | None = None,
) -> dict[str, Any]:
    job_id = next(_job_ids)
    now = datetime.utcnow().isoformat()
    job = {
        "job_id": job_id,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "abstract_ids": abstract_ids,
        "institutions": institutions,
        "year_from": year_from,
        "year_to": year_to,
        "total_reviewers": total_reviewers,
        "progress": {
            str(abstract_id): {
                institution["name"]: "pending"
                for institution in institutions
            }
            for abstract_id in abstract_ids
        },
        "results": [],
        "errors": [],
    }
    async with _lock:
        _jobs[job_id] = job
    return job


async def get_matching_job(job_id: int) -> dict[str, Any] | None:
    async with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


async def _update_job(job_id: int, **fields: Any) -> None:
    async with _lock:
        job = _jobs[job_id]
        job.update(fields)
        job["updated_at"] = datetime.utcnow().isoformat()


async def _set_progress(job_id: int, abstract_id: int, institution: str, status: str) -> None:
    async with _lock:
        job = _jobs[job_id]
        job["progress"][str(abstract_id)][institution] = status
        job["updated_at"] = datetime.utcnow().isoformat()


def _exclude_authors(abstract: dict[str, Any]) -> list[str]:
    raw = abstract.get("exclude_authors_json") or "[]"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(name) for name in parsed if str(name).strip()]


async def run_matching_job(job_id: int, storage: Storage) -> None:
    job = await get_matching_job(job_id)
    if not job:
        return

    await _update_job(job_id, status="running")
    institutions = job["institutions"]
    institution_counts = {
        institution["name"]: int(institution["count"])
        for institution in institutions
    }

    try:
        for abstract_id in job["abstract_ids"]:
            abstract = storage.get_by_id(int(abstract_id))
            if not abstract:
                async with _lock:
                    _jobs[job_id]["errors"].append(
                        {"abstract_id": abstract_id, "error": "Abstract not found"}
                    )
                continue

            for institution in institutions:
                await _set_progress(job_id, int(abstract_id), institution["name"], "running")

            result, usage = await find_reviewers_for_institutions(
                abstract=abstract.get("abstract_text", ""),
                institution_reviewer_counts=institution_counts,
                year_from=int(job["year_from"]),
                year_to=job["year_to"],
                exclude_authors=_exclude_authors(abstract),
            )

            async with _lock:
                _jobs[job_id]["results"].append(
                    {
                        "abstract_id": abstract_id,
                        "result": result,
                        "usage": usage,
                    }
                )

            for institution in institutions:
                await _set_progress(job_id, int(abstract_id), institution["name"], "done")
            storage.update(int(abstract_id), {"status": "matched"})

        await _update_job(job_id, status="done")
    except Exception as exc:
        async with _lock:
            _jobs[job_id]["errors"].append({"error": str(exc)})
        await _update_job(job_id, status="error")
