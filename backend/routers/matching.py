from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from agent.reviewer_finder_agent import INSTITUTIONS
from backend.services.matcher import create_matching_job, get_matching_job, run_matching_job
from backend.services.storage import Storage, get_storage

router = APIRouter(prefix="/matching", tags=["matching"])


class InstitutionRequest(BaseModel):
    name: str
    count: int = Field(ge=1, le=20)


class MatchingStartRequest(BaseModel):
    abstract_ids: list[int] = Field(min_length=1)
    institutions: list[InstitutionRequest] = Field(min_length=1)
    year_from: int = Field(default=2020, ge=1900)
    year_to: int | None = Field(default=None, ge=1900)
    total_reviewers: int | None = Field(default=None, ge=1, le=100)


@router.post("/start")
async def start_matching(
    payload: MatchingStartRequest,
    background_tasks: BackgroundTasks,
    storage: Annotated[Storage, Depends(get_storage)],
) -> dict[str, int | str]:
    if payload.year_to is not None and payload.year_to < payload.year_from:
        raise HTTPException(
            status_code=400,
            detail="'year_to' cannot be earlier than 'year_from'",
        )

    unknown = [
        institution.name
        for institution in payload.institutions
        if institution.name not in INSTITUTIONS
    ]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown institution(s): {', '.join(unknown)}",
        )

    missing_abstracts = [
        abstract_id
        for abstract_id in payload.abstract_ids
        if storage.get_by_id(abstract_id) is None
    ]
    if missing_abstracts:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown abstract id(s): {missing_abstracts}",
        )

    job = await create_matching_job(
        abstract_ids=payload.abstract_ids,
        institutions=[
            institution.model_dump()
            for institution in payload.institutions
        ],
        year_from=payload.year_from,
        year_to=payload.year_to,
        total_reviewers=payload.total_reviewers,
    )
    background_tasks.add_task(run_matching_job, int(job["job_id"]), storage)
    return {"job_id": int(job["job_id"]), "status": "pending"}


@router.get("/{job_id}")
async def read_matching_job(job_id: int) -> dict:
    job = await get_matching_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Matching job not found")
    return job
