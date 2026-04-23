import unittest

from agent.reviewer_finder_agent import resolve_institution_requests


class ResolveInstitutionRequestsTests(unittest.TestCase):
    def test_resolves_multiple_institutions_with_selected_counts(self) -> None:
        requests = resolve_institution_requests(
            {
                "University of Washington": 2,
                "Gonzaga University": 1,
            }
        )

        self.assertEqual(
            requests,
            [
                {
                    "institution": "University of Washington",
                    "institution_id": "I201448701",
                    "num_reviewers": 2,
                },
                {
                    "institution": "Gonzaga University",
                    "institution_id": "I119888943",
                    "num_reviewers": 1,
                },
            ],
        )

    def test_ignores_zero_counts_and_requires_at_least_one_reviewer(self) -> None:
        with self.assertRaisesRegex(ValueError, "At least one institution"):
            resolve_institution_requests({"University of Washington": 0})

    def test_preserves_single_institution_compatibility(self) -> None:
        requests = resolve_institution_requests(
            institution="University of Idaho",
            num_reviewers=3,
        )

        self.assertEqual(
            requests,
            [
                {
                    "institution": "University of Idaho",
                    "institution_id": "I155093810",
                    "num_reviewers": 3,
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
