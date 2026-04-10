import json
import os
import urllib.parse
from typing import Any

import aiohttp
from claude_agent_sdk import tool

OPENALEX_BASE = "https://api.openalex.org"
OPENALEX_API_KEY = os.environ.get("OPENALEX_API_KEY")


def _text(text: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": text}]}


def _error(text: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": f"Error: {text}"}], "isError": True}


@tool(
    "search_works",
    "Search OpenAlex for scholarly works. Returns titles, authors (with IDs and "
    "institutions), publication years, and citation counts. Use this to find "
    "researchers who have published on topics relevant to the grant abstract. "
    "You can combine a free-text search query with filters for institution and "
    "publication year range.",
    {
        "type": "object",
        "properties": {
            "search_query": {
                "type": "string",
                "description": "Free-text search across titles, abstracts, and fulltext. "
                "Choose terms based on your analysis of the grant abstract.",
            },
            "institution_id": {
                "type": "string",
                "description": "OpenAlex institution ID to filter by (e.g. 'I201448701'). "
                "Omit the full URL prefix — just the ID.",
            },
            "year_from": {
                "type": "integer",
                "description": "Minimum publication year (inclusive).",
            },
            "year_to": {
                "type": "integer",
                "description": "Maximum publication year (inclusive).",
            },
            "per_page": {
                "type": "integer",
                "description": "Number of results to return (default 25, max 100).",
            },
        },
        "required": ["search_query"],
    },
)
async def search_works(args: dict[str, Any]) -> dict[str, Any]:
    query = urllib.parse.quote(args["search_query"])
    per_page = 20

    filters = []
    if inst := args.get("institution_id"):
        filters.append(f"authorships.institutions.id:{inst}")
    if yf := args.get("year_from"):
        if yt := args.get("year_to"):
            filters.append(f"publication_year:{yf}-{yt}")
        else:
            filters.append(f"publication_year:>{yf - 1}")
    elif yt := args.get("year_to"):
        filters.append(f"publication_year:<{yt + 1}")

    url = (
        f"{OPENALEX_BASE}/works"
        f"?search={query}"
        f"&select=id,title,publication_year,cited_by_count,relevance_score,authorships"
        f"&per_page={per_page}"
        f"&api_key={OPENALEX_API_KEY}"
    )
    if filters:
        url += f"&filter={','.join(filters)}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    return _error(f"OpenAlex returned HTTP {resp.status}")
                data = await resp.json()

        target_inst = args.get("institution_id", "")
        works = []
        for w in data.get("results", []):
            matched_authors = []
            for a in w.get("authorships", []):
                inst_ids = [
                    i.get("id", "").split("/")[-1]
                    for i in a.get("institutions", [])
                ]
                if target_inst and target_inst not in inst_ids:
                    continue
                matched_authors.append({
                    "name": a.get("author", {}).get("display_name"),
                    "id": a.get("author", {}).get("id", "").split("/")[-1],
                    "orcid": a.get("author", {}).get("orcid"),
                    "institutions": [
                        i.get("display_name")
                        for i in a.get("institutions", [])
                    ],
                })
            if matched_authors:
                works.append({
                    "title": w.get("title"),
                    "year": w.get("publication_year"),
                    "cited_by_count": w.get("cited_by_count"),
                    "relevance_score": w.get("relevance_score"),
                    "authors": matched_authors,
                })

        total = data.get("meta", {}).get("count", len(works))
        return _text(
            f"Found {total} total works ({len(works)} shown):\n"
            + json.dumps(works, indent=2)
        )
    except Exception as e:
        return _error(str(e))


@tool(
    "get_author_profile",
    "Get a detailed profile for a researcher by their OpenAlex author ID. "
    "Returns display name, institutional affiliations, publication count, "
    "citation count, h-index, and top research topics. Use this to evaluate "
    "whether a candidate reviewer is a strong match for the grant abstract.",
    {"author_id": str},
)
async def get_author_profile(args: dict[str, Any]) -> dict[str, Any]:
    author_id = args["author_id"]
    if not author_id.startswith("http"):
        author_id = f"{OPENALEX_BASE}/authors/{author_id}"

    url = (
        f"{author_id}"
        f"?select=id,orcid,display_name,works_count,cited_by_count,"
        f"summary_stats,topics,affiliations,last_known_institutions"
        f"&api_key={OPENALEX_API_KEY}"
    )
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    return _error(f"OpenAlex returned HTTP {resp.status}")
                data = await resp.json()

        topics = []
        for t in data.get("topics", [])[:10]:
            topics.append({
                "name": t.get("display_name"),
                "count": t.get("count"),
                "domain": t.get("domain", {}).get("display_name") if t.get("domain") else None,
                "field": t.get("field", {}).get("display_name") if t.get("field") else None,
            })

        affiliations = []
        for a in data.get("affiliations", [])[:5]:
            affiliations.append({
                "institution": a.get("institution", {}).get("display_name"),
                "years": a.get("years", []),
            })

        last_known = []
        for inst in data.get("last_known_institutions", []):
            last_known.append({
                "id": inst.get("id", "").split("/")[-1],
                "display_name": inst.get("display_name"),
            })

        stats = data.get("summary_stats", {})
        profile = {
            "id": data.get("id", "").split("/")[-1],
            "orcid": data.get("orcid"),
            "display_name": data.get("display_name"),
            "works_count": data.get("works_count"),
            "cited_by_count": data.get("cited_by_count"),
            "h_index": stats.get("h_index"),
            "i10_index": stats.get("i10_index"),
            "2yr_mean_citedness": stats.get("2yr_mean_citedness"),
            "last_known_institutions": last_known,
            "affiliations": affiliations,
            "top_topics": topics,
        }
        return _text(json.dumps(profile, indent=2))
    except Exception as e:
        return _error(str(e))


@tool(
    "search_author_works",
    "Get works published by a specific author, optionally filtered by year range. "
    "Use this to understand what a candidate reviewer has been publishing recently.",
    {
        "type": "object",
        "properties": {
            "author_id": {
                "type": "string",
                "description": "OpenAlex author ID (e.g. 'A5016470862').",
            },
            "year_from": {
                "type": "integer",
                "description": "Minimum publication year (inclusive).",
            },
            "year_to": {
                "type": "integer",
                "description": "Maximum publication year (inclusive).",
            },
            "per_page": {
                "type": "integer",
                "description": "Number of results (default 10, max 100).",
            },
        },
        "required": ["author_id"],
    },
)
async def search_author_works(args: dict[str, Any]) -> dict[str, Any]:
    author_id = args["author_id"]
    per_page = 20

    filters = [f"authorships.author.id:{author_id}"]
    if yf := args.get("year_from"):
        if yt := args.get("year_to"):
            filters.append(f"publication_year:{yf}-{yt}")
        else:
            filters.append(f"publication_year:>{yf - 1}")
    elif yt := args.get("year_to"):
        filters.append(f"publication_year:<{yt + 1}")

    url = (
        f"{OPENALEX_BASE}/works"
        f"?filter={','.join(filters)}"
        f"&select=id,title,publication_year,cited_by_count"
        f"&sort=cited_by_count:desc"
        f"&per_page={per_page}"
        f"&api_key={OPENALEX_API_KEY}"
    )
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    return _error(f"OpenAlex returned HTTP {resp.status}")
                data = await resp.json()

        works = [
            {
                "title": w.get("title"),
                "year": w.get("publication_year"),
                "cited_by_count": w.get("cited_by_count"),
            }
            for w in data.get("results", [])
        ]
        total = data.get("meta", {}).get("count", len(works))
        return _text(
            f"Author has {total} total works ({len(works)} shown, sorted by citations):\n"
            + json.dumps(works, indent=2)
        )
    except Exception as e:
        return _error(str(e))
