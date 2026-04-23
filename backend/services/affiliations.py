_DOMAIN_MAP: dict[str, str] = {
    "uw.edu": "University of Washington",
    "washington.edu": "University of Washington",
    "wsu.edu": "Washington State University",
    "gonzaga.edu": "Gonzaga University",
    "uwyo.edu": "University of Wyoming",
    "uaa.alaska.edu": "University of Alaska Anchorage",
    "alaska.edu": "University of Alaska Fairbanks",
    "uas.alaska.edu": "University of Alaska Southeast",
    "montana.edu": "Montana State University",
    "umt.edu": "University of Montana",
    "uidaho.edu": "University of Idaho",
    "boisestate.edu": "Boise State University",
    "isu.edu": "Idaho State University",
}


def affiliation_from_email(email: str) -> str:
    """Return institution name derived from email domain, or the domain itself."""
    if not email or "@" not in email:
        return ""
    domain = email.split("@", 1)[1].lower().strip()
    # Try full domain first, then parent domain (e.g. subdomain.uw.edu → uw.edu)
    if domain in _DOMAIN_MAP:
        return _DOMAIN_MAP[domain]
    parts = domain.split(".")
    for i in range(1, len(parts) - 1):
        parent = ".".join(parts[i:])
        if parent in _DOMAIN_MAP:
            return _DOMAIN_MAP[parent]
    return domain
