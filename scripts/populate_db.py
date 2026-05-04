#!/usr/bin/env python3
"""
populate_db.py — initialize the MariaDB database for PeerLink

Syncs all abstracts from Gravity Forms into the abstracts table.

Usage (inside Docker):
  docker compose run --rm populate

Usage (local, DB on host port 3307):
  STORAGE_BACKEND=mariadb \
  DATABASE_URL=mysql+pymysql://peerlink:peerlink@localhost:3307/peerlink \
  GRAVITY_FORMS_API_CONSUMER_KEY=... \
  GRAVITY_FORMS_API_CONSUMER_SECRET=... \
  python scripts/populate_db.py
"""

import asyncio
import os
import sys

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _root)
sys.path.insert(0, os.path.join(_root, "src"))

os.environ.setdefault("STORAGE_BACKEND", "mariadb")

from dotenv import load_dotenv
load_dotenv()

from backend.services.storage import get_storage
from backend.services.gf_sync import sync_gravity_forms


async def main() -> None:
    print("Syncing abstracts from Gravity Forms...")
    storage = get_storage()
    try:
        result = await sync_gravity_forms(storage)
        print(f"Done — inserted={result['inserted']} updated={result['updated']}")
    except RuntimeError as exc:
        print(f"FAILED — {exc}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
