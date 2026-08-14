# Phasewise Implementation Plan: Mobile Store Feedback Pulse

Based on the [Architecture Document](architecture.md) and [Problem Statement](problemstatement.md), this document outlines the step-by-step implementation plan to build the feedback pulse pipeline.

## Phase 1: Project Initialization & Setup
**Goal:** Establish the foundation of the project, including the runtime environment and dependencies.
*   **Step 1.1:** Initialize the project repository (e.g., `npm init` for Node.js or `uv init` / `poetry init` for Python).
*   **Step 1.2:** Install core dependencies:
    *   LLM orchestration framework and clients (e.g., LangChain, Groq SDK).
    *   Scraping libraries (e.g., `google-play-scraper`, `app-store-scraper`).
    *   MCP Client SDK (to connect to the Google Docs and Gmail MCP servers).
*   **Step 1.3:** Setup environment variables (`.env`) for LLM API keys and MCP server connection parameters.

## Phase 2: Data Ingestion Layer
**Goal:** Fetch public review data from the App Store and Play Store safely.
*   **Step 2.1:** Implement Apple App Store fetcher:
    *   Query the RSS feed or use an open-source scraper.
    *   Filter reviews for the last 8–12 weeks.
*   **Step 2.2:** Implement Google Play Store fetcher:
    *   Query using an open-source scraper.
    *   Filter reviews for the last 8–12 weeks.
*   **Step 2.3:** Data Cleaning & Filtering:
    *   Remove reviews with less than 8 words.
    *   Remove reviews containing emojis.
    *   Remove reviews in the Hindi language.
*   **Step 2.4:** Data Normalization:
    *   Map both datasets to a unified schema: `{ source: string, date: Date, rating: number, title: string, text: string }`.

## Phase 3: Sanitization & Pre-Analysis Strategy
**Goal:** Strip PII and strategically prepare the large volume of reviews for LLM processing without exceeding context limits.
*   **Step 3.1: PII Stripping:** Apply regex-based filters to remove obvious patterns like email addresses, phone numbers, and typical username formats from the reviews.
*   **Step 3.2: Data Stratification:** Group reviews by rating. Focus primarily on 'Critical' reviews (1-3 stars) for bug reports/complaints, and scan 'Positive' reviews (4-5 stars) for feature requests.
*   **Step 3.3: Language Handling:** Acknowledge that many reviews are in Hinglish or regional scripts (e.g. Kannada). Instead of discarding them, we will rely on the LLM's multilingual capabilities to interpret and translate them during analysis.
*   **Step 3.4: Batching & Chunking:** Since 700+ reviews will exceed typical fast LLM context windows (e.g., Groq's 8k limit), batch the reviews into manageable chunks (e.g., 50-100 reviews per batch). We will use a Map-Reduce approach in Phase 4 to cluster each chunk and then synthesize the final themes.

## Phase 4: AI Processing (Map-Reduce Clustering & Synthesis)
**Goal:** Use Groq LLM to process batched reviews (Map) and synthesize them into a final actionable report (Reduce). Note that `llama-3.3-70b-versatile` has strict rate limits (1K Tokens Per Minute, 30 Requests Per Minute).
*   **Step 4.1: Map Prompts (Batch processing):** 
    *   Initialize the Groq API client to leverage high-speed inference.
    *   Implement rate-limiting (e.g., sequential processing with delays and backoffs) to respect the 1K TPM and 30 RPM limits, rather than executing all batches concurrently.
    *   Pass each batch of 'Critical' reviews to the LLM to extract up to 3 bug/complaint themes.
    *   Pass each batch of 'Positive' reviews to the LLM to extract up to 3 feature request themes.
*   **Step 4.2: Reduce & Synthesis Prompt:**
    *   Feed the aggregated themes from all batches into a final synthesis prompt. Ensure the combined context strictly fits within the 1K TPM limit.
    *   Instruct the LLM to distill the **Top 3 Critical Issues** and **Top 3 Feature Requests**.
    *   Extract exactly **3 verbatim quotes** (no hallucinations) supporting the insights.
    *   Generate exactly **3 actionable ideas** based on the synthesized themes.
    *   Instruct the LLM to draft the final markdown report and email body.
    *   Enforce a strict constraint: the final email output must be a formatted scannable note **≤250 words**.
*   **Step 4.3:** Parse the final synthesis output into a structured format (e.g., JSON) to reliably build the Google Doc and email payload.

## Phase 5: MCP Integration (Google Docs & Gmail) ✅
**Goal:** Deliver the final synthesized note to stakeholders via Docs and Email using a remote MCP server.
*   **MCP Server:** `google-workspace-mcp` v1.0.0 hosted at `mcpserver-production-b397.up.railway.app` (SSE transport on `/sse`).
*   **Implementation Note:** The MCP server's tool schemas omit `type: "object"`, which breaks the official `@modelcontextprotocol/sdk` client validation. A custom raw SSE client (`src/mcp_client.ts`) was built to bypass this using `EventSource` + JSON-RPC directly.
*   **Step 5.1: Google Docs Delivery** (`src/delivery.ts`):
    *   Initializes the raw MCP Client via SSE.
    *   Calls the `gdocs_append_content` tool with `{ document_id: string, content: string }` to append the full structured markdown report (Critical Issues, Feature Requests, Verbatim Quotes, and Actionable Ideas).
    *   Constructs the Google Doc URL from the document ID: `https://docs.google.com/document/d/{GOOGLE_DOC_ID}/edit`.
    *   **Limitation:** The MCP server only supports `gdocs_append_content` (no `create_document`), so a pre-existing Google Doc ID must be configured in `.env`.
*   **Step 5.2: Gmail Delivery** (`src/delivery.ts`):
    *   Calls the `gmail_create_draft` tool with `{ to: string[], subject: string, body: string }`.
    *   Formats a short email body containing the **≤250 words** high-level summary from Phase 4 and the Google Doc URL.
    *   Targets the stakeholder email(s) configured in `.env` (`STAKEHOLDER_EMAIL`).
*   **Runner:** `src/run_delivery.ts` — standalone script for Phase 5. Run via `npx tsx src/run_delivery.ts`.

## Phase 6: Orchestration & Automation ✅
**Goal:** Tie all phases together into a single automated run with weekly scheduling.
*   **Step 6.1: Orchestrator** (`src/orchestrator.ts`):
    *   Executes Phases 2 → 5 sequentially in a single `runFullPipeline()` call.
    *   Saves intermediate outputs at each phase (`reviews.json`, `processed_reviews.json`, `final_report.json`, `delivery_result.json`).
    *   Returns a structured `PipelineResult` with per-phase success/error status.
    *   Can be run standalone via `npm run pipeline` or `npx tsx src/orchestrator.ts`.
*   **Step 6.2: Error Handling:**
    *   Each phase is wrapped in try/catch — a failure in one phase is logged and aborts subsequent phases.
    *   Graceful degradation: Google Docs failure does not block Gmail delivery (within Phase 5).
    *   Guards against concurrent runs (scheduler skips if a pipeline is already in progress).
*   **Step 6.3: Weekly Scheduler** (`src/scheduler.ts`):
    *   Uses `node-cron` for in-process cron scheduling.
    *   Default schedule: **Every Monday at 9:00 AM IST** (`0 9 * * 1`, `Asia/Kolkata`).
    *   Configurable via `.env`: `CRON_SCHEDULE` (5-field cron expression) and `CRON_TIMEZONE` (IANA timezone).
    *   Supports `--run-now` flag to execute immediately before starting the scheduled loop.
    *   Graceful shutdown on SIGINT/SIGTERM.
    *   Run via `npm run scheduler` or `npm run scheduler:now`.


## Phase 7: Testing & Verification ✅
**Goal:** Ensure constraints (length, PII, themes) are met before going to production.
*   **Test Framework:** `vitest` installed and configured (`npm test`).
*   **Step 7.1 (Ingestion):** `tests/ingestion.test.ts` implemented. Tests `fetchPlayStoreReviews` and `fetchAppStoreReviews` to ensure that data pulled is strictly within the last 12 weeks.
*   **Step 7.2 (LLM Constraints):** `tests/llm_constraints.test.ts` implemented. Validates the `final_report.json` to ensure the email summary strictly adheres to the ≤250 words constraint, and checks that every extracted quote exists verbatim in the original reviews (accounting for punctuation and whitespace variations).
*   **Step 7.3 (E2E Integration):** `tests/e2e.test.ts` implemented. Calls `deliverReport` with a test payload and verifies that the MCP Server successfully appends to the target Google Doc and creates a Gmail draft without errors.
