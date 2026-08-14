# Architecture Document: Mobile Store Feedback Pulse

## 1. System Overview
The Mobile Store Feedback Pulse system is an automated, AI-driven pipeline designed to extract public app store reviews, distill them into actionable insights (themes, quotes, and next steps), and distribute these insights through Google Docs and Gmail. 

The most critical architectural constraint is the use of the **Model Context Protocol (MCP)** to interact with Google Services, explicitly avoiding custom OAuth and REST API implementations. The entire pipeline operates asynchronously as a scheduled batch job (e.g., weekly).

## 2. Core Components

### 2.1. Data Ingestion Layer
Responsible for safely retrieving raw, public review data from the Google Play Store and Apple App Store.
*   **Data Sources:** Public RSS feeds, official scraping tools (that do not violate ToS), or public API endpoints for app reviews. 
*   **Data Scope:** Reviews from the past 8–12 weeks.
*   **Data Schema:** Extracts must include `rating`, `title`, `text`, and `date`.
*   **Constraint:** Strictly public exports; no authenticated scraping or ToS violations.

### 2.2. Processing & Intelligence Layer (LLM Agent)
The core analytical engine of the system. This layer leverages a Large Language Model (LLM) to process the raw text and generate the required insights.
*   **PII Stripping Filter:** A pre-processing step (which could also be handled by the LLM via prompt engineering) to ensure no usernames, emails, or device IDs are passed through to the final document.
*   **Clustering Engine:** Groups the raw reviews into a maximum of **5 predefined or dynamically generated themes** (e.g., *Onboarding, Payments, Bugs, Feature Requests, UI/UX*).
*   **Content Generation:** 
    *   Identifies the **Top 3 themes**.
    *   Extracts **3 verbatim user quotes** (stripped of PII, no hallucinated wording).
    *   Generates **3 concrete action ideas** grounded in the themes.
    *   Formats the output into a scannable weekly note of **≤250 words**.

### 2.3. Orchestration Layer
A lightweight script or agent framework (e.g., a simple Python/Node script or an AI agent) that coordinates the workflow.
*   **Scheduler:** Triggers the pipeline on a weekly cadence (e.g., via cron, GitHub Actions, or a cloud scheduler).
*   **Context Manager:** Passes the raw data to the LLM and routes the LLM's formatted output to the MCP clients.

### 2.4. Integration Layer (MCP Servers)
Instead of building custom OAuth flows and REST clients, the orchestration layer communicates with standard MCP servers.
*   **MCP Client:** Built into the Orchestration layer, this client connects to external MCP servers.
*   **Google Docs MCP Server:** Exposes tools to create or update documents. The orchestrator calls a tool like `create_document` or `update_document` with the generated markdown/text.
*   **Gmail MCP Server:** Exposes tools to draft emails. The orchestrator calls a tool like `create_draft` to generate an email to the configured alias containing the summary and a link to the Google Doc.

## 3. Data Flow Architecture

The end-to-end execution follows a linear, batch-oriented data flow:

1.  **Trigger:** The weekly schedule initiates the Orchestrator.
2.  **Extract:** The Ingestion Layer pulls the last 8-12 weeks of reviews from Apple App Store and Google Play Store.
3.  **Sanitize:** Reviews are scrubbed of any Personally Identifiable Information (PII).
4.  **Analyze:** An LLM analyzes the dataset and groups reviews into ≤5 themes.
5.  **Synthesize (via Groq):** The Groq LLM (e.g., LLaMA-3/Mixtral) rapidly drafts the weekly pulse report (Top 3 themes, 3 verbatim quotes, 3 action items) and final email content, ensuring it meets the ≤250 words constraint.
6.  **Publish (Docs via MCP):** The Orchestrator connects to the Google Docs MCP Server and executes a tool call to write the weekly pulse into a new or rolling Google Doc.
7.  **Notify (Gmail via MCP):** The Orchestrator retrieves the Doc link, connects to the Gmail MCP Server, and executes a tool call to create a draft email addressed to the stakeholder alias.
8.  **Terminate:** The job completes successfully.

## 4. MCP Integration Details
The system relies on the Model Context Protocol (MCP) for out-of-bound integrations. 

### Why MCP?
*   **Zero Authentication Boilerplate:** The MCP server handles the underlying Google OAuth flows securely.
*   **Standardized Tool Calling:** The orchestrator only needs to understand standard MCP JSON-RPC tool schemas.
*   **Separation of Concerns:** The core agent logic is completely decoupled from Google's specific REST API mechanics.

### Required MCP Tools
The environment must provide MCP servers that expose the following (or similar) capabilities:
*   `docs_create_document(title, content)` or `docs_append_text(documentId, text)`
*   `gmail_create_draft(to, subject, body)`

## 5. Security & Privacy Considerations
*   **No PII in System of Record:** Quotes must be anonymized before they are committed to Google Docs or Gmail. Device IDs, usernames, and raw reviewer names from the app store must be dropped during the Ingestion or Sanitization phase.
*   **Public Data Only:** Ensuring compliance with App Store and Play Store terms of service by only utilizing publicly accessible review data without simulated logins.
*   **Credential Management:** MCP servers will independently manage Google Workspace credentials (e.g., via local application default credentials or secure token storage), completely removing credentials from the Orchestration layer's codebase.

## 6. Technology Stack (Recommended)
*   **Orchestration/Agent Framework:** Python (e.g., raw script or LangChain) or Node.js.
*   **Intelligence:** Groq LLM (e.g., LLaMA-3 or Mixtral via Groq API) for ultra-fast inference when synthesizing the final report and email draft. Other LLMs may be used for initial clustering if needed, but Groq is the primary synthesis engine.
*   **Data Ingestion:** Libraries like `google-play-scraper` and `app-store-scraper` (open-source, public data only).
*   **Integrations:** Google Workspace MCP Servers for Docs and Gmail.
