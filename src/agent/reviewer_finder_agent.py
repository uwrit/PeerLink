import json
import sys
from typing import Any, Callable, TypedDict

from dotenv import load_dotenv

load_dotenv()

from agent.prompt import agent_prompt
from api.tools import search_works, get_author_profile, search_author_works

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ThinkingBlock,
    ToolUseBlock,
    ToolResultBlock,
    create_sdk_mcp_server,
)

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


class InstitutionReviewerRequest(TypedDict):
    institution: str
    institution_id: str
    num_reviewers: int


def resolve_institution_requests(
    institution_reviewer_counts: dict[str, int] | None = None,
    *,
    institution: str = "University of Washington",
    institution_id: str | None = None,
    num_reviewers: int = 5,
) -> list[InstitutionReviewerRequest]:
    """
    Normalize matching config into per-institution requests.

    The dashboard will pass institution-specific counts, while older callers can
    keep using the single institution + num_reviewers parameters.
    """
    if institution_reviewer_counts:
        requests: list[InstitutionReviewerRequest] = []
        for name, count in institution_reviewer_counts.items():
            if count <= 0:
                continue
            resolved_id = INSTITUTIONS.get(name)
            if resolved_id is None:
                raise ValueError(
                    f"Unknown institution '{name}'. "
                    f"Available: {', '.join(INSTITUTIONS.keys())}"
                )
            requests.append(
                {
                    "institution": name,
                    "institution_id": resolved_id,
                    "num_reviewers": int(count),
                }
            )
        if not requests:
            raise ValueError("At least one institution must request one or more reviewers.")
        return requests

    if institution_id is None:
        institution_id = INSTITUTIONS.get(institution)
        if institution_id is None:
            raise ValueError(
                f"Unknown institution '{institution}'. "
                f"Available: {', '.join(INSTITUTIONS.keys())}"
            )

    return [
        {
            "institution": institution,
            "institution_id": institution_id,
            "num_reviewers": int(num_reviewers),
        }
    ]


async def find_reviewers(
    abstract: str,
    institution: str = "University of Washington",
    institution_id: str | None = None,
    year_from: int = 2020,
    year_to: int | None = None,
    num_reviewers: int = 5,
    exclude_authors: list[str] | None = None,
    on_progress: Callable[[str], None] | None = None,
) -> tuple[str, dict[str, Any]]:
    def _log(msg: str) -> None:
        if on_progress:
            on_progress(msg)
        print(msg)

    request = resolve_institution_requests(
        institution=institution,
        institution_id=institution_id,
        num_reviewers=num_reviewers,
    )[0]
    institution = request["institution"]
    institution_id = request["institution_id"]
    num_reviewers = request["num_reviewers"]

    # Build the MCP server with our OpenAlex tools
    openalex_server = create_sdk_mcp_server(
        name="openalex",
        version="1.0.0",
        tools=[search_works, get_author_profile, search_author_works],
    )

    # Configure the agent
    options = ClaudeAgentOptions(
        system_prompt=agent_prompt,
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
            f"\n\n**Authors to EXCLUDE (conflict of interest):**\n"
            + "\n".join(f"- {name}" for name in exclude_authors)
        )

    if year_to is not None:
        year_range_phrase = f"publications from {year_from} to {year_to}"
    else:
        year_range_phrase = f"publications from {year_from} onward"

    user_prompt = (
        f"Find exactly {num_reviewers} peer reviewers from **{institution}** "
        f"(OpenAlex institution ID: `{institution_id}`) "
        f"({year_range_phrase}) for the following grant abstract:\n\n"
        f"---\n{abstract}\n---"
        f"{exclude_section}"
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
                        _log(block.text)
                        output_parts.append(block.text)
            elif isinstance(message, ResultMessage):
                usage_stats = {
                    "total_cost_usd": message.total_cost_usd,
                    "usage": message.usage,
                    "num_turns": message.num_turns,
                    "duration_ms": message.duration_ms,
                    "duration_api_ms": message.duration_api_ms,
                }

    return output_parts[-1] if output_parts else "", usage_stats
