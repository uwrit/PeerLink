import asyncio
import json
import sys
import urllib.parse
from typing import Any

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import aiohttp
from dotenv import load_dotenv

load_dotenv()
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    tool,
    create_sdk_mcp_server,
)

OPENALEX_BASE = "https://api.openalex.org"
OPENALEX_MAILTO = "amrithg@uw.edu"

INSTITUTIONS = {
    "University of Washington": "I201448701",
    "Washington State University": "I72951846",
    "Gonzaga University": "I119888943",
    "University of Wyoming": "I12834331",
    "University of Alaska Anchorage": "I147853995",
    "University of Alaska Fairbanks": "I141472210",
    "University of Alaska Southeast": "I90464598",
    "Montana State University": "I23732399",
    "University of Montana": "I6750721",
    "University of Idaho": "I155093810",
    "Boise State University": "I120156002",
    "Idaho State University": "I106969075",
}


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
                "description": "Number of results to return (default 15, max 200).",
            },
        },
        "required": ["search_query"],
    },
)
async def search_works(args: dict[str, Any]) -> dict[str, Any]:
    query = urllib.parse.quote(args["search_query"])
    per_page = min(args.get("per_page", 25), 200)

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
        f"&select=id,title,publication_year,cited_by_count,authorships"
        f"&per_page={per_page}"
        f"&mailto={OPENALEX_MAILTO}"
    )
    if filters:
        url += f"&filter={','.join(filters)}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    return _error(f"OpenAlex returned HTTP {resp.status}")
                data = await resp.json()

        works = []
        for w in data.get("results", []):
            authors = []
            for a in w.get("authorships", []):
                author_info = {
                    "name": a.get("author", {}).get("display_name"),
                    "id": a.get("author", {}).get("id", "").split("/")[-1],
                    "institutions": [
                        i.get("display_name")
                        for i in a.get("institutions", [])
                    ],
                }
                authors.append(author_info)
            works.append({
                "title": w.get("title"),
                "year": w.get("publication_year"),
                "cited_by_count": w.get("cited_by_count"),
                "authors": authors,
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
    # Allow either bare ID or full URL
    if not author_id.startswith("http"):
        author_id = f"{OPENALEX_BASE}/authors/{author_id}"

    url = (
        f"{author_id}"
        f"?select=id,display_name,works_count,cited_by_count,"
        f"summary_stats,topics,affiliations"
        f"&mailto={OPENALEX_MAILTO}"
    )
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    return _error(f"OpenAlex returned HTTP {resp.status}")
                data = await resp.json()

        # Extract top topics (limit to 10)
        topics = []
        for t in data.get("topics", [])[:10]:
            topics.append({
                "name": t.get("display_name"),
                "count": t.get("count"),
                "domain": t.get("domain", {}).get("display_name") if t.get("domain") else None,
                "field": t.get("field", {}).get("display_name") if t.get("field") else None,
            })

        # Extract affiliations
        affiliations = []
        for a in data.get("affiliations", [])[:5]:
            affiliations.append({
                "institution": a.get("institution", {}).get("display_name"),
                "years": a.get("years", []),
            })

        stats = data.get("summary_stats", {})
        profile = {
            "id": data.get("id", "").split("/")[-1],
            "display_name": data.get("display_name"),
            "works_count": data.get("works_count"),
            "cited_by_count": data.get("cited_by_count"),
            "h_index": stats.get("h_index"),
            "i10_index": stats.get("i10_index"),
            "2yr_mean_citedness": stats.get("2yr_mean_citedness"),
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
                "description": "Number of results (default 10, max 200).",
            },
        },
        "required": ["author_id"],
    },
)
async def search_author_works(args: dict[str, Any]) -> dict[str, Any]:
    author_id = args["author_id"]
    per_page = min(args.get("per_page", 10), 200)

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
        f"&mailto={OPENALEX_MAILTO}"
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _text(text: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": text}]}


def _error(text: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": f"Error: {text}"}], "isError": True}


# ---------------------------------------------------------------------------
# System prompt — tells the agent HOW to find reviewers, not WHAT to search
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an expert research reviewer matching agent for UW ITHS \
(Institute of Translational Health Sciences). Your job is to find the best \
peer reviewers for grant applications by analyzing research abstracts and \
searching the OpenAlex academic database.

You will be given:
- A grant/research abstract (any field or domain)
- A target institution to find reviewers from
- A publication year cutoff
- The number of reviewers to find
- An optional list of authors to exclude (conflict of interest)

## Your Process

1. **Analyze the abstract thoroughly.** Identify:
   - The core research area and discipline
   - Specific technologies, methods, or techniques mentioned
   - The application domain (e.g., pediatrics, environmental science, etc.)
   - Key scientific terms and concepts
   - Interdisciplinary angles that might be relevant

2. **Use the provided institution ID.** The institution OpenAlex ID is given \
to you directly — do NOT search for it.

3. **Design a diverse search strategy.** Create 3-5 different search queries \
that cover different facets of the abstract. For example:
   - Core technology/method query
   - Application domain query
   - Specific technique + domain combination
   - Broader field query to catch senior researchers
   Do NOT hardcode any terms — derive ALL search terms from the abstract.

4. **Execute searches.** Call `search_works` for each query, filtering by \
institution and year range. Collect candidate authors from results.

5. **Identify promising candidates.** Look for authors who:
   - Appear in multiple relevant search results
   - Have high citation counts on relevant papers
   - Are affiliated with the target institution
   - Are NOT in the exclusion list

6. **Evaluate top candidates.** For your most promising candidates (aim for \
8-12), call `get_author_profile` to get their full research profile. Assess:
   - Topic alignment with the abstract
   - Methodological expertise overlap
   - Publication impact (h-index, citation count)
   - Recency of relevant work

7. **Select and rank the final reviewers.** Choose the requested number of \
reviewers. Ensure diversity of expertise across the panel — don't pick 5 \
people who all do the exact same thing. A good review panel covers different \
aspects of the grant.

## Output Format

For each recommended reviewer, provide:
- **Name** and OpenAlex author ID
- **Affiliation** (department if available)
- **Key metrics** (h-index, total works, total citations)
- **Top research topics** (from their profile)
- **Relevance justification** — a specific explanation of WHY this person is \
qualified to review THIS particular grant, referencing specific aspects of the \
abstract that match their expertise

End with a brief summary table and a note about how the panel covers different \
aspects of the grant.

## Important Rules
- NEVER recommend authors from the exclusion list
- Only recommend authors currently affiliated with the target institution
- All recommended reviewers must have publications from the specified year onward
- Base ALL search queries on the abstract content — never use hardcoded terms
- If a search returns few results, try broader or alternative queries
"""


# ---------------------------------------------------------------------------
# Main agent entry point
# ---------------------------------------------------------------------------

async def find_reviewers(
    abstract: str,
    institution: str = "University of Washington",
    institution_id: str | None = None,
    year_from: int = 2020,
    num_reviewers: int = 5,
    exclude_authors: list[str] | None = None,
) -> tuple[str, dict[str, Any]]:
    """
    Find peer reviewers for a grant abstract using the Claude Agent SDK.

    Args:
        abstract: The grant/research abstract (any domain).
        institution: Institution display name.
        institution_id: OpenAlex institution ID (e.g. 'I201448701').
                        If None, looked up from INSTITUTIONS dict.
        year_from: Minimum publication year for filtering.
        num_reviewers: Number of reviewers to recommend.
        exclude_authors: Optional list of author names to exclude (COI).

    Returns:
        A tuple of (reviewer recommendations string, usage stats dict).
    """
    # Resolve institution ID from the built-in lookup
    if institution_id is None:
        institution_id = INSTITUTIONS.get(institution)
        if institution_id is None:
            raise ValueError(
                f"Unknown institution '{institution}'. "
                f"Available: {', '.join(INSTITUTIONS.keys())}"
            )

    # Build the MCP server with our OpenAlex tools
    openalex_server = create_sdk_mcp_server(
        name="openalex",
        version="1.0.0",
        tools=[search_works, get_author_profile, search_author_works],
    )

    # Configure the agent
    options = ClaudeAgentOptions(
        system_prompt=SYSTEM_PROMPT,
        mcp_servers={"openalex": openalex_server},
        allowed_tools=[
            "mcp__openalex__search_works",
            "mcp__openalex__get_author_profile",
            "mcp__openalex__search_author_works",
        ],
        max_turns=20,
        model="claude-sonnet-4-6",
    )

    # Build the user prompt
    exclude_section = ""
    if exclude_authors:
        exclude_section = (
            f"\n\n**Authors to EXCLUDE (conflict of interest):**\n"
            + "\n".join(f"- {name}" for name in exclude_authors)
        )

    user_prompt = (
        f"Find {num_reviewers} peer reviewers from **{institution}** "
        f"(OpenAlex institution ID: `{institution_id}`) "
        f"(publications from {year_from} onward) for the following grant abstract:\n\n"
        f"---\n{abstract}\n---"
        f"{exclude_section}"
    )

    # Run the agent and collect its response
    output_parts: list[str] = []
    usage_stats: dict[str, Any] = {}

    async with ClaudeSDKClient(options=options) as client:
        await client.query(user_prompt)
        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        output_parts.append(block.text)
            elif isinstance(message, ResultMessage):
                if message.result:
                    output_parts.append(message.result)
                usage_stats = {
                    "total_cost_usd": message.total_cost_usd,
                    "usage": message.usage,
                    "num_turns": message.num_turns,
                    "duration_ms": message.duration_ms,
                    "duration_api_ms": message.duration_api_ms,
                }

    return "\n".join(output_parts), usage_stats


def main():
    from abstracts import a1

    abstracts = [a1]

    print("=" * 60)
    print("PeerLink — Peer Reviewer Finder Agent")
    print("=" * 60)
    print()

    # Let the user pick an institution
    institution_names = list(INSTITUTIONS.keys())
    print("Select an institution to search for reviewers:")
    for idx, name in enumerate(institution_names, 1):
        print(f"  {idx}. {name}")
    print()

    while True:
        choice = input(f"Enter a number (1-{len(institution_names)}): ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(institution_names):
            break
        print("Invalid choice. Please try again.")

    selected_institution = institution_names[int(choice) - 1]
    selected_id = INSTITUTIONS[selected_institution]
    print(f"\nSelected: {selected_institution} (ID: {selected_id})")
    print()

    print(f"Processing {len(abstracts)} abstract(s)")
    print()

    for i, (title, abstract) in enumerate(abstracts):
        print("-" * 60)
        print(f"[{i + 1}] {title}")
        print(f"Searching for 5 reviewers at {selected_institution}...")
        print("-" * 60)
        print()

        result, usage = asyncio.run(
            find_reviewers(
                abstract=abstract,
                institution=selected_institution,
                institution_id=selected_id,
            )
        )

        print(result)
        print()

        # Print usage stats
        print("=" * 60)
        print("USAGE STATS")
        print("=" * 60)
        if usage.get("total_cost_usd") is not None:
            print(f"  Cost:           ${usage['total_cost_usd']:.4f}")
        if usage.get("usage"):
            u = usage["usage"]
            print(f"  Input tokens:   {u.get('input_tokens', 'N/A'):,}")
            print(f"  Output tokens:  {u.get('output_tokens', 'N/A'):,}")
        print(f"  Turns:          {usage.get('num_turns', 'N/A')}")
        duration_s = usage.get("duration_ms", 0) / 1000
        print(f"  Total duration: {duration_s:.1f}s")
        api_s = usage.get("duration_api_ms", 0) / 1000
        print(f"  API time:       {api_s:.1f}s")
        print("=" * 60)
        print()


if __name__ == "__main__":
    main()
