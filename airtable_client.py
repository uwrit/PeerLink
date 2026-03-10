"""
Async Airtable API client for PeerLink.

Handles all Airtable REST operations: listing, creating, and updating records.
Table names with spaces are URL-encoded automatically.
"""

import urllib.parse
from typing import Any, Optional

import aiohttp


AIRTABLE_BASE_URL = "https://api.airtable.com/v0"


class AirtableClient:
    def __init__(self, api_key: str, base_id: str):
        self.api_key = api_key
        self.base_id = base_id
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _table_url(self, table: str) -> str:
        return f"{AIRTABLE_BASE_URL}/{self.base_id}/{urllib.parse.quote(table, safe='')}"

    async def list_records(
        self,
        table: str,
        filter_formula: Optional[str] = None,
        fields: Optional[list[str]] = None,
    ) -> list[dict[str, Any]]:
        """Fetch all records from a table, auto-paginating via offset."""
        url = self._table_url(table)
        params: dict[str, Any] = {}
        if filter_formula:
            params["filterByFormula"] = filter_formula
        if fields:
            # aiohttp accepts list values for repeated query params
            params["fields[]"] = fields

        records: list[dict[str, Any]] = []
        async with aiohttp.ClientSession() as session:
            while True:
                async with session.get(url, headers=self._headers, params=params) as resp:
                    if not resp.ok:
                        body = await resp.text()
                        raise RuntimeError(
                            f"Airtable list_records error {resp.status} on '{table}': {body}"
                        )
                    data = await resp.json()

                records.extend(data.get("records", []))
                offset = data.get("offset")
                if not offset:
                    break
                params["offset"] = offset

        return records

    async def create_record(
        self, table: str, fields: dict[str, Any]
    ) -> dict[str, Any]:
        """Create a single record. Returns the created record dict."""
        url = self._table_url(table)
        # Strip None values — Airtable rejects null field values
        clean = {k: v for k, v in fields.items() if v is not None and v != ""}
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, headers=self._headers, json={"fields": clean}
            ) as resp:
                if not resp.ok:
                    body = await resp.text()
                    raise RuntimeError(
                        f"Airtable create_record error {resp.status} on '{table}': {body}"
                    )
                return await resp.json()

    async def update_record(
        self, table: str, record_id: str, fields: dict[str, Any]
    ) -> dict[str, Any]:
        """PATCH update a record by its Airtable record ID."""
        url = f"{self._table_url(table)}/{record_id}"
        clean = {k: v for k, v in fields.items() if v is not None}
        async with aiohttp.ClientSession() as session:
            async with session.patch(
                url, headers=self._headers, json={"fields": clean}
            ) as resp:
                if not resp.ok:
                    body = await resp.text()
                    raise RuntimeError(
                        f"Airtable update_record error {resp.status} on '{table}/{record_id}': {body}"
                    )
                return await resp.json()

    async def create_records_batch(
        self, table: str, records: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Create up to 10 records at once (Airtable batch limit).
        Automatically chunks larger lists.
        """
        url = self._table_url(table)
        results: list[dict[str, Any]] = []

        # Airtable allows max 10 records per batch request
        for i in range(0, len(records), 10):
            chunk = records[i : i + 10]
            payload = {
                "records": [
                    {"fields": {k: v for k, v in r.items() if v is not None and v != ""}}
                    for r in chunk
                ]
            }
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url, headers=self._headers, json=payload
                ) as resp:
                    if not resp.ok:
                        body = await resp.text()
                        raise RuntimeError(
                            f"Airtable batch create error {resp.status} on '{table}': {body}"
                        )
                    data = await resp.json()
                    results.extend(data.get("records", []))

        return results
