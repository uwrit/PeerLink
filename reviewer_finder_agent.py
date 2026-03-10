import asyncio
import json
import sys
import urllib.parse
from typing import Any, Callable

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
    ThinkingBlock,
    ToolUseBlock,
    ToolResultBlock,
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

        # Pre-filter: only include authors affiliated with the target institution
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
    # Allow either bare ID or full URL
    if not author_id.startswith("http"):
        author_id = f"{OPENALEX_BASE}/authors/{author_id}"

    url = (
        f"{author_id}"
        f"?select=id,orcid,display_name,works_count,cited_by_count,"
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
            "orcid": data.get("orcid"),
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
You are PeerLink, an expert research reviewer matching agent for UW ITHS \
(Institute of Translational Health Sciences). Your job is to find the best \
peer reviewers for grant applications by analyzing research abstracts and \
searching the OpenAlex academic database.

## CRITICAL: Available Tools
You have EXACTLY three tools. Use ONLY these:
- `search_works` — search OpenAlex for scholarly works
- `get_author_profile` — get a researcher's full profile by OpenAlex ID
- `search_author_works` — get works by a specific author

Do NOT attempt to use any other tools. All the data you need is returned directly in tool results. \
Work with the inline data — never try to access files on disk.

## Input
You will be given:
- A grant/research abstract
- A target institution (name + OpenAlex ID)
- A publication year cutoff
- The number of reviewers to find
- An optional exclusion list (conflict of interest)
- An optional list of **previously vetted reviewers** — pre-approved, high-quality \
reviewers from past runs

## Process — Be Efficient

1. **Analyze the abstract.** Identify the core research area, key methods, \
application domain, and 2-3 distinct facets worth searching.

1b. **Check vetted reviewers first.** If a vetted reviewer list is provided, \
evaluate each one against the abstract before searching. Call `get_author_profile` \
on any whose topics seem relevant. Vetted reviewers who are a very strong fit should \
be included in your final recommendations — they are pre-approved and should be \
prioritized over unknown candidates of similar quality. Only include vette

2. **Run 3 targeted searches** using `search_works`, all filtered by the \
given institution ID and year range. Results already contain ONLY authors \
from the target institution, so you do not need to filter further. Design \
queries to cover different facets:
   - Core method/technology
   - Application domain / field of study
   - A broader or interdisciplinary angle
   Derive ALL search terms from the abstract.

3. **Collect candidate authors** directly from the search results. Authors \
appearing across multiple searches or on highly-cited papers are strong \
candidates. Pick your top 5-7 unique candidates.

4. **Get profiles** for your top 5-7 candidates by calling \
`get_author_profile`. Verify institution affiliation and assess topic \
alignment, h-index, and publication impact.

5. **Select and rank** the final reviewers (the requested number). Ensure \
the panel covers different aspects of the grant — don't pick people who all \
do the exact same thing.

## Output Format
For each reviewer:
- **Name** and OpenAlex author ID
- **Affiliation**
- **Key metrics** (h-index, total works, total citations)
- **Top research topics**
- **Relevance justification** — WHY this person is qualified to review THIS \
grant, referencing specific aspects of the abstract

End with a brief summary table.
OUTPUT the final reviewer recommendations in the specified format.

## Rules
- NEVER recommend authors from the exclusion list
- Only recommend authors currently affiliated with the target institution
- All reviewers must have publications from the specified year onward
- Derive ALL search queries from the abstract — never hardcode terms
- Do NOT run more than 4 search queries total — be strategic
- Do NOT look up more than 8 author profiles total
- Work with the data returned inline — never use file system tools
- Set `"vetted": true` in the JSON block for any reviewer from the vetted pool

## Structured JSON Output (Required)

After your summary table, append a fenced JSON block with ALL recommended reviewers. \
This is parsed by the database and must be valid JSON:

```json
[
  {
    "name": "Full Name",
    "openalex_id": "A1234567890",
    "affiliation": "Department, Institution",
    "h_index": 42,
    "total_works": 150,
    "total_citations": 3200,
    "top_topics": ["Topic 1", "Topic 2", "Topic 3"],
    "relevance_justification": "Why this reviewer fits this abstract.",
    "vetted": false
  }
]
```
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
    vetted_reviewers: list[dict[str, Any]] | None = None,
    on_progress: Callable[[str], None] | None = None,
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
    def _log(msg: str) -> None:
        if on_progress:
            on_progress(msg)
        print(msg)

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
        max_turns=15,
        model="claude-sonnet-4-6",
    )

    # Build the user prompt
    exclude_section = ""
    if exclude_authors:
        exclude_section = (
            "\n\n**Authors to EXCLUDE (conflict of interest):**\n"
            + "\n".join(f"- {name}" for name in exclude_authors)
        )

    vetted_section = ""
    if vetted_reviewers:
        lines = [
            "\n\n**Previously Vetted Reviewers (prioritize if relevant):**",
        ]
        for r in vetted_reviewers:
            topics = r.get("top_topics", "")
            if isinstance(topics, list):
                topics = ", ".join(topics)
            lines.append(
                f"- **{r['name']}** (ID: {r.get('openalex_id', 'N/A')}) — "
                f"{r.get('affiliation', 'N/A')} | H-index: {r.get('h_index', 'N/A')} | "
                f"Topics: {topics}"
            )
        vetted_section = "\n".join(lines)

    user_prompt = (
        f"Find {num_reviewers} peer reviewers from **{institution}** "
        f"(OpenAlex institution ID: `{institution_id}`) "
        f"(publications from {year_from} onward) for the following grant abstract:\n\n"
        f"---\n{abstract}\n---"
        f"{exclude_section}"
        f"{vetted_section}"
    )

    # Run the agent and collect its response
    output_parts: list[str] = []
    usage_stats: dict[str, Any] = {}

    async with ClaudeSDKClient(options=options) as client:
        await client.query(user_prompt)
        step = 0
        async for message in client.receive_response():
            step += 1
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, ThinkingBlock):
                        _log(block.thinking)
                    elif isinstance(block, ToolUseBlock):
                        tool_name = block.name.replace("mcp__openalex__", "")
                        _log(f"Calling {tool_name}({json.dumps(block.input)})")
                    elif isinstance(block, ToolResultBlock):
                        status = "ERROR" if block.is_error else "OK"
                        _log(f"Tool result ({status}): {block.content}")
                    elif isinstance(block, TextBlock):
                        output_parts.append(block.text)
            elif isinstance(message, ResultMessage):
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
