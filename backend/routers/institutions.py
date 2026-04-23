from fastapi import APIRouter

from agent.reviewer_finder_agent import INSTITUTIONS

router = APIRouter(tags=["metadata"])

STATE_GROUPS: dict[str, list[str]] = {
    "WA": [
        "University of Washington",
        "Washington State University",
        "Gonzaga University",
    ],
    "WY": ["University of Wyoming"],
    "AK": [
        "University of Alaska Anchorage",
        "University of Alaska Fairbanks",
        "University of Alaska Southeast",
    ],
    "MT": ["Montana State University", "University of Montana"],
    "ID": [
        "University of Idaho",
        "Boise State University",
        "Idaho State University",
    ],
}


@router.get("/institutions")
def list_institutions() -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = {}
    for state, names in STATE_GROUPS.items():
        grouped[state] = [
            {"name": name, "openalex_id": INSTITUTIONS[name]}
            for name in names
            if name in INSTITUTIONS
        ]
    return grouped


@router.get("/programs")
def list_programs() -> list[str]:
    return [
        "Community-Academic Partnerships",
        "New Interdisciplinary Academic Collaborations",
        "Early-Stage Product Development Award",
    ]
