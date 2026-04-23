import unittest

from backend.routers.institutions import list_institutions
from backend.routers.matching import (
    InstitutionRequest,
    MatchingStartRequest,
    read_matching_job,
    start_matching,
)


class FakeBackgroundTasks:
    def __init__(self) -> None:
        self.tasks = []

    def add_task(self, fn, *args, **kwargs) -> None:
        self.tasks.append((fn, args, kwargs))


class FakeStorage:
    def __init__(self) -> None:
        self.records = {
            1: {
                "id": 1,
                "abstract_text": "A translational health abstract.",
                "exclude_authors_json": '["Conflicted Reviewer"]',
                "status": "unmatched",
            }
        }

    def get_all(self):
        return list(self.records.values())

    def get_by_id(self, abstract_id: int):
        return self.records.get(abstract_id)

    def get_by_gf_entry_id(self, gf_entry_id: str):
        return None

    def upsert(self, record):
        return record

    def update(self, abstract_id: int, fields):
        self.records[abstract_id].update(fields)
        return self.records[abstract_id]


class BackendContractTests(unittest.IsolatedAsyncioTestCase):
    def test_institutions_endpoint_returns_grouped_authoritative_list(self) -> None:
        data = list_institutions()

        self.assertEqual(data["WA"][0]["name"], "University of Washington")
        self.assertEqual(data["WA"][0]["openalex_id"], "I201448701")

    async def test_matching_start_accepts_frontend_payload(self) -> None:
        background = FakeBackgroundTasks()
        payload = MatchingStartRequest(
            abstract_ids=[1],
            institutions=[
                InstitutionRequest(name="University of Washington", count=2),
                InstitutionRequest(name="Gonzaga University", count=1),
            ],
            year_from=2020,
            year_to=2026,
            total_reviewers=3,
        )

        response = await start_matching(payload, background, FakeStorage())

        self.assertEqual(response["status"], "pending")
        self.assertIsInstance(response["job_id"], int)
        self.assertEqual(len(background.tasks), 1)

        job = await read_matching_job(response["job_id"])
        self.assertEqual(
            job["institutions"],
            [
                {"name": "University of Washington", "count": 2},
                {"name": "Gonzaga University", "count": 1},
            ],
        )


if __name__ == "__main__":
    unittest.main()
