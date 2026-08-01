from fastapi import APIRouter, Request

router = APIRouter(prefix="/me", tags=["me"])


def _first_header(request: Request, *names: str) -> str | None:
    """Return the first present, non-empty header among `names` (case-insensitive)."""
    for name in names:
        value = request.headers.get(name)
        if value:
            return value.strip()
    return None


@router.get("")
def me(request: Request) -> dict[str, str | None]:
    """Return the SAML attributes the Shibboleth SP injected for the current user.

    Apache (mod_shib, `ShibUseHeaders On`) forwards the four mapped SAML
    attributes — email, firstName, lastName, userId — as request headers.
    These are trustworthy ONLY because the backend port is firewalled and
    reachable solely through Apache, which scrubs any client-supplied copies
    of these header names. Never expose port 8000 publicly, or these become
    spoofable.

    In local dev (no Shibboleth in front) every field comes back null, which
    the frontend renders gracefully.
    """
    first = _first_header(request, "firstName")
    last = _first_header(request, "lastName")
    full_name = " ".join(p for p in (first, last) if p) or None

    return {
        "user_id": _first_header(request, "x-user-eppn", "userId"),
        "email": _first_header(request, "email"),
        "first_name": first,
        "last_name": last,
        "full_name": full_name,
    }


@router.get("/_debug/headers")
def debug_headers(request: Request) -> dict[str, object]:
    """TEMPORARY diagnostic — remove once SSO header forwarding is confirmed.

    Returns inbound request headers WITH values, so we can see exactly what the
    SP is forwarding. Sensitive headers (cookie/authorization) are redacted so a
    live session token never lands in a response or log.
    """
    redact = {"cookie", "authorization"}
    headers = {
        name: ("<redacted>" if name.lower() in redact else value)
        for name, value in request.headers.items()
    }
    expected = ["email", "x-user-eppn", "firstName", "lastName", "userId"]
    lowered = {n.lower() for n in headers}
    return {
        "inbound_headers": headers,
        "expected_present": {e: (e.lower() in lowered) for e in expected},
    }
