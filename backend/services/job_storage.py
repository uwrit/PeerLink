from __future__ import annotations

from typing import Any

from backend.services.mariadb_storage import MariaDbJobStorage


def _backend() -> MariaDbJobStorage:
    return MariaDbJobStorage()


def create_job(abstract_id: int, institutions: list[dict[str, Any]], year_from: int, year_to: int | None) -> dict[str, Any]:
    return _backend().create_job(abstract_id, institutions, year_from, year_to)


def get_job(job_id: int) -> dict[str, Any] | None:
    return _backend().get_job(job_id)


def update_job(job_id: int, fields: dict[str, Any]) -> None:
    return _backend().update_job(job_id, fields)


def list_jobs() -> list[dict[str, Any]]:
    return _backend().list_jobs()


def append_results(job_id: int, institution: str, new_results: list[dict[str, Any]]) -> None:
    return _backend().append_results(job_id, institution, new_results)


def append_log(job_id: int, institution: str, messages: list[str]) -> None:
    return _backend().append_log(job_id, institution, messages)
