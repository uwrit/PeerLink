import json
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from agent.reviewer_finder_agent import INSTITUTIONS
from backend.services import job_storage, matcher
from backend.services.storage import Storage, get_storage

router = APIRouter(prefix="/matching", tags=["matching"])


class InstitutionRequest(BaseModel):
    name: str
    count: int = Field(ge=1, le=20)


class MatchRequest(BaseModel):
    abstract_id: int
    institutions: list[InstitutionRequest] = Field(min_length=1)
    year_from: int = Field(default=2020, ge=1900)
    year_to: int | None = Field(default=None, ge=1900)


class ReviewerStatusPatch(BaseModel):
    invitation_sent: bool | None = None
    accepted_invite: bool | None = None


def _recompute_abstract_status(storage: Storage, abstract_id: int) -> None:
    abstract = storage.get_by_id(abstract_id)
    if not abstract:
        return
    current = abstract.get("status")
    if current in ("unmatched", "processing"):
        return
    jobs = job_storage.list_jobs_for_abstract(abstract_id)
    any_accepted = any(
        r.get("accepted_invite")
        for job in jobs
        for r in (job.get("results") or [])
    )
    new_status = "matched" if any_accepted else "in-progress"
    if new_status != current:
        storage.update(abstract_id, {"status": new_status})


@router.post("/start")
async def start_matching(
    body: MatchRequest,
    background_tasks: BackgroundTasks,
    storage: Storage = Depends(get_storage),
) -> dict[str, Any]:
    if body.year_to is not None and body.year_to < body.year_from:
        raise HTTPException(
            status_code=400,
            detail="'year_to' cannot be earlier than 'year_from'",
        )

    unknown = [inst.name for inst in body.institutions if inst.name not in INSTITUTIONS]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown institution(s): {', '.join(unknown)}",
        )

    abstract = storage.get_by_id(body.abstract_id)
    if not abstract:
        raise HTTPException(status_code=404, detail="Abstract not found")

    abstract_text = abstract.get("abstract_text", "")
    if not abstract_text:
        raise HTTPException(status_code=422, detail="Abstract has no extracted text — cannot match")

    exclude_authors = json.loads(abstract.get("exclude_authors_json", "[]"))
    institutions = [inst.model_dump() for inst in body.institutions]

    job = job_storage.create_job(
        abstract_id=body.abstract_id,
        institutions=institutions,
        year_from=body.year_from,
        year_to=body.year_to,
    )
    job_id = job["id"]

    storage.update(body.abstract_id, {"status": "processing"})

    async def run():
        await matcher.run_matching_job(
            job_id=job_id,
            abstract_text=abstract_text,
            exclude_authors=exclude_authors,
            institutions=institutions,
            year_from=body.year_from,
            year_to=body.year_to,
        )
        storage.update(body.abstract_id, {"status": "in-progress"})

    background_tasks.add_task(run)
    return {"job_id": job_id, "status": "pending"}


@router.get("/jobs")
def list_jobs() -> list[dict[str, Any]]:
    return job_storage.list_jobs()


@router.patch("/jobs/{job_id}/reviewers/{reviewer_index}")
def patch_reviewer(
    job_id: int,
    reviewer_index: int,
    body: ReviewerStatusPatch,
    storage: Storage = Depends(get_storage),
) -> dict[str, Any]:
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    job = job_storage.update_reviewer(job_id, reviewer_index, fields)
    if not job:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    _recompute_abstract_status(storage, job["abstract_id"])
    return job
