from fastapi import FastAPI

from backend.routers import sync

app = FastAPI(title="PeerLink API")
app.include_router(sync.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
