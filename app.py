import asyncio
import logging
import sys
import threading
import time
import traceback
import streamlit as st
from reviewer_finder_agent import find_reviewers, INSTITUTIONS

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

st.set_page_config(page_title="PeerLink", layout="wide")

st.title("PeerLink")

st.markdown("""
<style>
button[kind="primaryFormSubmit"] {
    background-color: #28a745;
    border-color: #28a745;
}
button[kind="primaryFormSubmit"]:hover {
    background-color: #218838;
    border-color: #1e7e34;
}
</style>
""", unsafe_allow_html=True)

# --- Input form ---
with st.form("reviewer_form"):
    abstract = st.text_area(
        "Grant / Research Abstract",
        height=250,
        placeholder="Paste the grant abstract here...",
    )

    col1, col2, col3 = st.columns(3)
    with col1:
        institution = st.selectbox("Institution", list(INSTITUTIONS.keys()))
    with col2:
        year_from = st.number_input(
            "Publications from year", min_value=2000, max_value=2026, value=2020
        )
    with col3:
        num_reviewers = st.number_input(
            "Number of reviewers", min_value=1, max_value=15, value=5
        )

    submitted = st.form_submit_button("Find Reviewers", type="primary", use_container_width=True)

# --- Run agent on submit ---
if submitted:
    if not abstract.strip():
        st.error("Please paste an abstract before submitting.")
        st.stop()

    status_container = st.status("Searching for reviewers...", expanded=True)

    with status_container:
        st.write(f"**Institution:** {institution}")
        st.write(f"**Year cutoff:** {year_from} | **Reviewers requested:** {num_reviewers}")

        def _fmt_timer(seconds: float) -> str:
            mins, secs = divmod(int(seconds), 60)
            return f"{mins:02d}:{secs:02d}"

        timer_area = st.empty()
        log_area = st.empty()
        logs: list[str] = []
        start_time = time.time()

        timer_area.markdown(f"**{_fmt_timer(0)}**")

        def log(msg: str):
            logs.append(msg)

        log("Starting agent...")

        # Run the agent in a background thread so we can update the timer
        agent_result: dict = {}

        def _run_agent():
            try:
                logger.info("Calling find_reviewers(institution=%s, year_from=%s, num_reviewers=%s)",
                            institution, year_from, num_reviewers)
                r, u = asyncio.run(
                    find_reviewers(
                        abstract=abstract.strip(),
                        institution=institution,
                        year_from=int(year_from),
                        num_reviewers=int(num_reviewers),
                        on_progress=log,
                    )
                )
                agent_result["result"] = r
                agent_result["usage"] = u
                logger.info("find_reviewers completed successfully")
            except Exception as e:
                logger.error("Agent failed with exception:\n%s", traceback.format_exc())
                agent_result["error"] = e

        worker = threading.Thread(target=_run_agent, daemon=True)
        worker.start()

        # Tick every 0.1s for a smooth real-time timer
        prev_log_count = 0
        while worker.is_alive():
            elapsed = time.time() - start_time
            timer_area.markdown(f"**{_fmt_timer(elapsed)}**")
            if len(logs) != prev_log_count:
                log_area.code("\n".join(logs), language=None)
                prev_log_count = len(logs)
            time.sleep(0.1)

        # Final update after thread finishes
        if len(logs) != prev_log_count:
            log_area.code("\n".join(logs), language=None)

        if "error" in agent_result:
            st.error(f"Agent failed: {agent_result['error']}")
            st.stop()

        result = agent_result["result"]
        elapsed = time.time() - start_time
        timer_area.markdown(f"**Completed in {_fmt_timer(elapsed)}**")

    status_container.update(label=f"Done! ({_fmt_timer(elapsed)})", state="complete", expanded=False)

    # --- Results ---
    st.divider()
    st.subheader("Recommended Reviewers")
    st.markdown(result)
