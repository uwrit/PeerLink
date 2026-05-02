from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import abstracts, matching, sync, institutions

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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
