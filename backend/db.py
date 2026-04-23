from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from backend.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, pool_recycle=3600)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
