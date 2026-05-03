from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.services.storage import Storage, get_storage

router = APIRouter(prefix="/abstracts", tags=["abstracts"])


class AbstractPatch(BaseModel):
    status: str | None = None
    invitation_sent: bool | None = None
    accepted_review: bool | None = None


@router.get("")
def list_abstracts(
    status: str | None = Query(default=None),
    program: str | None = Query(default=None),
    storage: Storage = Depends(get_storage),
) -> list[dict[str, Any]]:
    records = storage.get_all()
    if status:
        records = [r for r in records if r.get("status") == status]
    if program:
        records = [r for r in records if r.get("program") == program]
    return records


@router.patch("/{abstract_id}")
def patch_abstract(
    abstract_id: int,
    body: AbstractPatch,
    storage: Storage = Depends(get_storage),
) -> dict[str, Any]:
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    updated = storage.update(abstract_id, fields)
    if not updated:
        raise HTTPException(status_code=404, detail="Abstract not found")
    return updated
