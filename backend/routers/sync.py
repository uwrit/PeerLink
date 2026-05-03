from fastapi import APIRouter, Depends, HTTPException

from backend.services.gf_sync import sync_gravity_forms
from backend.services.storage import Storage, get_storage

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/gravity-forms")
async def trigger_sync(storage: Storage = Depends(get_storage)) -> dict[str, int]:
    try:
        result = await sync_gravity_forms(storage)
        return {"synced": result["inserted"] + result["updated"]}
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
