import json
import re
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from backend.services.storage import Storage, get_storage

router = APIRouter(prefix="/abstracts", tags=["abstracts"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class AbstractPatch(BaseModel):
    status: str | None = None
    invitation_sent: bool | None = None
    accepted_review: bool | None = None


class AbstractCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    applicant_name: str = Field(min_length=1, max_length=200)
    applicant_email: str = Field(min_length=1, max_length=200)
    affiliation: str = Field(default="", max_length=300)
    phone: str = Field(default="", max_length=50)
    program: str = Field(min_length=1)
    abstract_text: str = Field(min_length=1, max_length=50_000)

    @field_validator("title", "applicant_name", "program", "abstract_text")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v

    @field_validator("applicant_email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("invalid email format")
        return v


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


@router.post("")
def create_abstract(
    body: AbstractCreate,
    storage: Storage = Depends(get_storage),
) -> dict[str, Any]:
    record = {
        "gf_entry_id": f"manual-{uuid.uuid4().hex[:16]}",
        "title": body.title,
        "abstract_text": body.abstract_text,
        "pdf_url": "",
        "program": body.program,
        "applicant_name": body.applicant_name,
        "applicant_email": body.applicant_email,
        "affiliation": body.affiliation.strip(),
        "phone": body.phone.strip(),
        "exclude_authors_json": json.dumps([]),
        "submitted_at": datetime.utcnow().isoformat(),
    }
    try:
        return storage.upsert(record)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save abstract: {exc}")


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
