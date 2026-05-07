from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from backend.db import cursor, transaction


class MariaDbStorage:
    """Storage backend that persists abstract records as JSON blobs in MariaDB."""

    def get_all(self) -> list[dict[str, Any]]:
        with cursor() as cur:
            cur.execute("SELECT data FROM abstracts ORDER BY id")
            return [json.loads(row["data"]) for row in cur.fetchall()]

    def get_by_id(self, abstract_id: int) -> dict[str, Any] | None:
        with cursor() as cur:
            cur.execute("SELECT data FROM abstracts WHERE id = %s", (abstract_id,))
            row = cur.fetchone()
            return json.loads(row["data"]) if row else None

    def get_by_gf_entry_id(self, gf_entry_id: str) -> dict[str, Any] | None:
        with cursor() as cur:
            cur.execute("SELECT data FROM abstracts WHERE gf_entry_id = %s", (gf_entry_id,))
            row = cur.fetchone()
            return json.loads(row["data"]) if row else None

    def upsert(self, record: dict[str, Any]) -> dict[str, Any]:
        now = datetime.utcnow().isoformat()
        gf_id = record.get("gf_entry_id")

        with cursor() as cur:
            if gf_id:
                cur.execute("SELECT data FROM abstracts WHERE gf_entry_id = %s", (gf_id,))
                row = cur.fetchone()
                if row:
                    merged = {**json.loads(row["data"]), **record, "updated_at": now}
                    cur.execute(
                        "UPDATE abstracts SET data = %s WHERE gf_entry_id = %s",
                        (json.dumps(merged, default=str), gf_id),
                    )
                    return merged

            new_record = {
                "status": "unmatched",
                "invitation_sent": False,
                "accepted_review": False,
                "created_at": now,
                "updated_at": now,
                **record,
            }
            cur.execute(
                "INSERT INTO abstracts (gf_entry_id, data) VALUES (%s, %s)",
                (gf_id, json.dumps(new_record, default=str)),
            )
            new_record["id"] = cur.lastrowid
            cur.execute(
                "UPDATE abstracts SET data = %s WHERE id = %s",
                (json.dumps(new_record, default=str), new_record["id"]),
            )
            return new_record

    def update(self, abstract_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
        with transaction() as cur:
            cur.execute("SELECT data FROM abstracts WHERE id = %s FOR UPDATE", (abstract_id,))
            row = cur.fetchone()
            if not row:
                return None
            updated = {**json.loads(row["data"]), **fields, "updated_at": datetime.utcnow().isoformat()}
            cur.execute(
                "UPDATE abstracts SET data = %s WHERE id = %s",
                (json.dumps(updated, default=str), abstract_id),
            )
            return updated


class MariaDbJobStorage:
    """Job storage backend using JSON blobs in MariaDB."""

    def create_job(self, abstract_id: int, institutions: list[dict], year_from: int, year_to: int | None) -> dict[str, Any]:
        now = datetime.utcnow().isoformat()
        with cursor() as cur:
            job = {
                "abstract_id": abstract_id,
                "institutions": institutions,
                "year_from": year_from,
                "year_to": year_to,
                "status": "pending",
                "progress": {inst["name"]: "pending" for inst in institutions},
                "results": [],
                "logs": {inst["name"]: [] for inst in institutions},
                "created_at": now,
                "completed_at": None,
            }
            cur.execute("INSERT INTO jobs (data) VALUES (%s)", (json.dumps(job, default=str),))
            job["id"] = cur.lastrowid
            cur.execute(
                "UPDATE jobs SET data = %s WHERE id = %s",
                (json.dumps(job, default=str), job["id"]),
            )
            return job

    def get_job(self, job_id: int) -> dict[str, Any] | None:
        with cursor() as cur:
            cur.execute("SELECT data FROM jobs WHERE id = %s", (job_id,))
            row = cur.fetchone()
            return json.loads(row["data"]) if row else None

    def update_job(self, job_id: int, fields: dict[str, Any]) -> None:
        with transaction() as cur:
            cur.execute("SELECT data FROM jobs WHERE id = %s FOR UPDATE", (job_id,))
            row = cur.fetchone()
            if not row:
                return
            job = json.loads(row["data"])
            job.update(fields)
            cur.execute(
                "UPDATE jobs SET data = %s WHERE id = %s",
                (json.dumps(job, default=str), job_id),
            )

    def list_jobs(self) -> list[dict[str, Any]]:
        with cursor() as cur:
            cur.execute("SELECT data FROM jobs ORDER BY id")
            return [json.loads(row["data"]) for row in cur.fetchall()]

    def append_results(self, job_id: int, institution: str, new_results: list[dict]) -> None:
        with transaction() as cur:
            cur.execute("SELECT data FROM jobs WHERE id = %s FOR UPDATE", (job_id,))
            row = cur.fetchone()
            if not row:
                return
            job = json.loads(row["data"])
            job["results"].extend(new_results)
            job["progress"][institution] = "done"
            cur.execute(
                "UPDATE jobs SET data = %s WHERE id = %s",
                (json.dumps(job, default=str), job_id),
            )

    def append_log(self, job_id: int, institution: str, messages: list[str]) -> None:
        with transaction() as cur:
            cur.execute("SELECT data FROM jobs WHERE id = %s FOR UPDATE", (job_id,))
            row = cur.fetchone()
            if not row:
                return
            job = json.loads(row["data"])
            job.setdefault("logs", {}).setdefault(institution, []).extend(messages)
            cur.execute(
                "UPDATE jobs SET data = %s WHERE id = %s",
                (json.dumps(job, default=str), job_id),
            )

    def update_reviewer(
        self,
        job_id: int,
        reviewer_index: int,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        with transaction() as cur:
            cur.execute("SELECT data FROM jobs WHERE id = %s FOR UPDATE", (job_id,))
            row = cur.fetchone()
            if not row:
                return None
            job = json.loads(row["data"])
            results = job.get("results") or []
            if reviewer_index < 0 or reviewer_index >= len(results):
                return None
            results[reviewer_index] = {**results[reviewer_index], **fields}
            job["results"] = results
            cur.execute(
                "UPDATE jobs SET data = %s WHERE id = %s",
                (json.dumps(job, default=str), job_id),
            )
            return job

    def list_jobs_for_abstract(self, abstract_id: int) -> list[dict[str, Any]]:
        with cursor() as cur:
            cur.execute("SELECT data FROM jobs ORDER BY id")
            jobs = [json.loads(row["data"]) for row in cur.fetchall()]
            return [j for j in jobs if j.get("abstract_id") == abstract_id]
