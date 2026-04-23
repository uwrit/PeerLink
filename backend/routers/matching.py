import asyncio
import json
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from backend.services import job_storage, matcher
from backend.services.storage import Storage, get_storage

router = APIRouter(prefix="/matching", tags=["matching"])

# In-memory event queues keyed by job_id for WebSocket delivery
_queues: dict[int, asyncio.Queue] = {}


def get_or_create_queue(job_id: int) -> asyncio.Queue:
    if job_id not in _queues:
        _queues[job_id] = asyncio.Queue()
    return _queues[job_id]


class InstitutionConfig(BaseModel):
    name: str
    count: int = 3


class MatchRequest(BaseModel):
    abstract_id: int
    institutions: list[InstitutionConfig]
    year_from: int = 2020
    year_to: int | None = None


@router.post("/start")
async def start_matching(
    body: MatchRequest,
    background_tasks: BackgroundTasks,
    storage: Storage = Depends(get_storage),
) -> dict[str, Any]:
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
    queue = get_or_create_queue(job_id)

    storage.update(body.abstract_id, {"status": "processing"})

    async def run():
        def on_event(event: dict[str, Any]) -> None:
            try:
                asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, event)
            except Exception:
                pass

        await matcher.run_matching_job(
            job_id=job_id,
            abstract_text=abstract_text,
            exclude_authors=exclude_authors,
            institutions=institutions,
            year_from=body.year_from,
            year_to=body.year_to,
            on_event=on_event,
        )
        storage.update(body.abstract_id, {"status": "matched"})
        queue.put_nowait({"type": "done", "job_id": job_id})

    background_tasks.add_task(run)
    return {"job_id": job_id, "status": "pending"}


@router.get("/{job_id}")
def get_job(job_id: int) -> dict[str, Any]:
    job = job_storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
