from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol


class Storage(Protocol):
    def get_all(self) -> list[dict[str, Any]]: ...
    def get_by_id(self, abstract_id: int) -> dict[str, Any] | None: ...
    def get_by_gf_entry_id(self, gf_entry_id: str) -> dict[str, Any] | None: ...
    def upsert(self, record: dict[str, Any]) -> dict[str, Any]: ...
    def update(self, abstract_id: int, fields: dict[str, Any]) -> dict[str, Any] | None: ...


_DATA_FILE = Path(os.environ.get("JSON_DATA_PATH", "data/abstracts.json"))
_lock = threading.Lock()


class JsonStorage:
    def __init__(self, path: Path = _DATA_FILE) -> None:
        self._path = path

    def _load(self) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []
        with open(self._path, encoding="utf-8") as f:
            return json.load(f)

    def _save(self, records: list[dict[str, Any]]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._path, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, default=str)

    def get_all(self) -> list[dict[str, Any]]:
        with _lock:
            return self._load()

    def get_by_id(self, abstract_id: int) -> dict[str, Any] | None:
        with _lock:
            records = self._load()
            return next((r for r in records if r.get("id") == abstract_id), None)

    def get_by_gf_entry_id(self, gf_entry_id: str) -> dict[str, Any] | None:
        with _lock:
            records = self._load()
            return next((r for r in records if r.get("gf_entry_id") == gf_entry_id), None)

    def upsert(self, record: dict[str, Any]) -> dict[str, Any]:
        with _lock:
            records = self._load()
            gf_id = record.get("gf_entry_id")
            now = datetime.utcnow().isoformat()
            for i, r in enumerate(records):
                if r.get("gf_entry_id") == gf_id:
                    records[i] = {**r, **record, "updated_at": now}
                    self._save(records)
                    return records[i]
            # Insert — auto-assign integer id
            new_id = max((r.get("id", 0) for r in records), default=0) + 1
            new_record = {
                "id": new_id,
                "status": "unmatched",
                "invitation_sent": False,
                "accepted_review": False,
                "created_at": now,
                "updated_at": now,
                **record,
            }
            records.append(new_record)
            self._save(records)
            return new_record

    def update(self, abstract_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
        with _lock:
            records = self._load()
            for i, r in enumerate(records):
                if r.get("id") == abstract_id:
                    records[i] = {**r, **fields, "updated_at": datetime.utcnow().isoformat()}
                    self._save(records)
                    return records[i]
            return None


_json_storage = JsonStorage()


def get_storage() -> Storage:
    return _json_storage
