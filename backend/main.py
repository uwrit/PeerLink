from fastapi import FastAPI

from backend.routers import institutions, matching, sync

app = FastAPI(title="PeerLink API")
app.include_router(institutions.router)
app.include_router(matching.router)
app.include_router(sync.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
