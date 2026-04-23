import asyncio
import json

from fastapi import WebSocket, WebSocketDisconnect

from backend.routers.matching import get_or_create_queue
from backend.services import job_storage


async def websocket_matching(websocket: WebSocket, job_id: int) -> None:
    await websocket.accept()

    job = job_storage.get_job(job_id)
    if not job:
        await websocket.send_text(json.dumps({"type": "error", "detail": "Job not found"}))
        await websocket.close()
        return

    # If job already finished, send current state immediately and close
    if job.get("status") == "done":
        await websocket.send_text(json.dumps({"type": "done", "job_id": job_id}))
        await websocket.close()
        return

    queue = get_or_create_queue(job_id)

    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=60.0)
                await websocket.send_text(json.dumps(event, default=str))
                if event.get("type") == "done":
                    break
            except asyncio.TimeoutError:
                # Send keepalive ping
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    finally:
        await websocket.close()
