from fastapi import FastAPI, WebSocket

from backend.routers import abstracts, matching, sync
from backend.ws import websocket_matching

app = FastAPI(title="PeerLink API")
app.include_router(sync.router)
app.include_router(abstracts.router)
app.include_router(matching.router)


@app.websocket("/ws/matching/{job_id}")
async def ws_matching(websocket: WebSocket, job_id: int) -> None:
    await websocket_matching(websocket, job_id)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
