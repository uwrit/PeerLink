from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

_JOBS_FILE = Path(os.environ.get("JSON_JOBS_PATH", "data/jobs.json"))
_lock = threading.Lock()


def _use_mariadb() -> bool:
    return os.environ.get("STORAGE_BACKEND", "json") == "mariadb"


def _mariadb():
    from backend.services.mariadb_storage import MariaDbJobStorage
    return MariaDbJobStorage()


# ── JSON helpers ──────────────────────────────────────────────────────────────

def _load() -> list[dict[str, Any]]:
    if not _JOBS_FILE.exists() or _JOBS_FILE.stat().st_size == 0:
        return []
    with open(_JOBS_FILE, encoding="utf-8") as f:
        return json.load(f)


def _save(jobs: list[dict[str, Any]]) -> None:
    _JOBS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _JOBS_FILE.with_suffix(_JOBS_FILE.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(jobs, f, indent=2, default=str)
    os.replace(tmp, _JOBS_FILE)


# ── Public API (routes to the right backend) ──────────────────────────────────

def create_job(abstract_id: int, institutions: list[dict[str, Any]], year_from: int, year_to: int | None) -> dict[str, Any]:
    if _use_mariadb():
        return _mariadb().create_job(abstract_id, institutions, year_from, year_to)
    with _lock:
        jobs = _load()
        new_id = max((j.get("id", 0) for j in jobs), default=0) + 1
        job = {
            "id": new_id,
            "abstract_id": abstract_id,
            "institutions": institutions,
            "year_from": year_from,
            "year_to": year_to,
            "status": "pending",
            "progress": {inst["name"]: "pending" for inst in institutions},
            "results": [],
            "logs": {inst["name"]: [] for inst in institutions},
            "created_at": datetime.utcnow().isoformat(),
            "completed_at": None,
        }
        jobs.append(job)
        _save(jobs)
        return job


def get_job(job_id: int) -> dict[str, Any] | None:
    if _use_mariadb():
        return _mariadb().get_job(job_id)
    with _lock:
        return next((j for j in _load() if j.get("id") == job_id), None)


def update_job(job_id: int, fields: dict[str, Any]) -> None:
    if _use_mariadb():
        return _mariadb().update_job(job_id, fields)
    with _lock:
        jobs = _load()
        for i, j in enumerate(jobs):
            if j.get("id") == job_id:
                jobs[i] = {**j, **fields}
                _save(jobs)
                return


def list_jobs() -> list[dict[str, Any]]:
    if _use_mariadb():
        return _mariadb().list_jobs()
    with _lock:
        return _load()


def append_results(job_id: int, institution: str, new_results: list[dict[str, Any]]) -> None:
    if _use_mariadb():
        return _mariadb().append_results(job_id, institution, new_results)
    with _lock:
        jobs = _load()
        for i, j in enumerate(jobs):
            if j.get("id") == job_id:
                jobs[i]["results"].extend(new_results)
                jobs[i]["progress"][institution] = "done"
                _save(jobs)
                return


def append_log(job_id: int, institution: str, messages: list[str]) -> None:
    if _use_mariadb():
        return _mariadb().append_log(job_id, institution, messages)
    with _lock:
        jobs = _load()
        for i, j in enumerate(jobs):
            if j.get("id") == job_id:
                jobs[i].setdefault("logs", {}).setdefault(institution, []).extend(messages)
                _save(jobs)
                return
