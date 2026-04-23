from fastapi import APIRouter

from agent.reviewer_finder_agent import INSTITUTIONS

router = APIRouter(tags=["institutions"])

PROGRAMS = [
    "Early-Stage Product Development Award",
    "New Interdisciplinary Academic Collaborations",
    "Academic Community Partnerships",
]

_STATE_MAP: dict[str, str] = {
    "University of Washington": "Washington",
    "Washington State University": "Washington",
    "Gonzaga University": "Washington",
    "Western Washington University": "Washington",
    "Central Washington University": "Washington",
    "Eastern Washington University": "Washington",
    "University of Wyoming": "Wyoming",
    "University of Alaska Anchorage": "Alaska",
    "University of Alaska Fairbanks": "Alaska",
    "University of Alaska Southeast": "Alaska",
    "University of Montana": "Montana",
    "Montana State University": "Montana",
    "Montana Technological University": "Montana",
    "University of Idaho": "Idaho",
    "Boise State University": "Idaho",
    "Idaho State University": "Idaho",
}


@router.get("/institutions")
def get_institutions() -> list[dict]:
    grouped: dict[str, list[str]] = {}
    for name in INSTITUTIONS:
        state = _STATE_MAP.get(name, "Other")
        grouped.setdefault(state, []).append(name)
    return [{"state": state, "universities": unis} for state, unis in sorted(grouped.items())]


@router.get("/programs")
def get_programs() -> list[str]:
    return PROGRAMS
