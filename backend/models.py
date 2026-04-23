from datetime import datetime

from sqlalchemy import Text
from sqlmodel import Column, Field, SQLModel


class Abstract(SQLModel, table=True):
    __tablename__ = "abstracts"

    id: int | None = Field(default=None, primary_key=True)
    gf_entry_id: str = Field(index=True, unique=True)
    title: str = ""
    abstract_text: str = Field(default="", sa_column=Column(Text, nullable=False))
    pdf_url: str = Field(default="", sa_column=Column(Text, nullable=False))
    program: str = ""
    applicant_name: str = ""
    applicant_email: str = ""
    affiliation: str = ""
    exclude_authors_json: str = Field(default="[]", sa_column=Column(Text, nullable=False))
    status: str = "unmatched"
    submitted_at: datetime | None = None
    invitation_sent: bool = False
    accepted_review: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MatchJob(SQLModel, table=True):
    __tablename__ = "match_jobs"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "pending"
    year_from: int = 2020
    year_to: int | None = None
    total_reviewers_per_abstract: int = 5


class JobAbstract(SQLModel, table=True):
    __tablename__ = "job_abstracts"

    job_id: int = Field(foreign_key="match_jobs.id", primary_key=True)
    abstract_id: int = Field(foreign_key="abstracts.id", primary_key=True)


class JobInstitution(SQLModel, table=True):
    __tablename__ = "job_institutions"

    id: int | None = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="match_jobs.id", index=True)
    institution_name: str
    num_reviewers: int


class MatchResult(SQLModel, table=True):
    __tablename__ = "match_results"

    id: int | None = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="match_jobs.id", index=True)
    abstract_id: int = Field(foreign_key="abstracts.id", index=True)
    institution: str = ""
    reviewer_name: str = ""
    openalex_id: str = ""
    orcid: str = ""
    affiliation: str = ""
    h_index: int | None = None
    works_count: int | None = None
    cited_by_count: int | None = None
    top_topics_json: str = Field(default="[]", sa_column=Column(Text, nullable=False))
    justification: str = Field(default="", sa_column=Column(Text, nullable=False))
    found_at: datetime = Field(default_factory=datetime.utcnow)
