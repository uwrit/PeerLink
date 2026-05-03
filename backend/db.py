from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

import pymysql
import pymysql.cursors

from backend.config import settings


def _parse_url(url: str) -> dict:
    """Parse mysql+pymysql://user:pass@host:port/db into pymysql.connect kwargs."""
    rest = url.split("://", 1)[1]
    userinfo, hostinfo = rest.rsplit("@", 1)
    user, password = userinfo.split(":", 1)
    hostport, db = hostinfo.split("/", 1)
    host, port = (hostport.rsplit(":", 1) if ":" in hostport else (hostport, "3306"))
    return dict(host=host, port=int(port), user=user, password=password, database=db)


_conn_kwargs = _parse_url(settings.database_url)


def get_connection() -> pymysql.connections.Connection:
    return pymysql.connect(
        **_conn_kwargs,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
        charset="utf8mb4",
    )


@contextmanager
def cursor() -> Generator[pymysql.cursors.DictCursor, None, None]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            yield cur
    finally:
        conn.close()
