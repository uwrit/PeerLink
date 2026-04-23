from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import abstracts, matching, sync, institutions
from backend.ws import websocket_matching

app = FastAPI(title="PeerLink API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:80", "http://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(matching.router, prefix="/api")
app.include_router(sync.router, prefix="/api")
app.include_router(abstracts.router, prefix="/api")
app.include_router(institutions.router, prefix="/api")


@app.websocket("/ws/matching/{job_id}")
async def ws_matching(websocket: WebSocket, job_id: int) -> None:
    await websocket_matching(websocket, job_id)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
