# Edge Cases and Corner Scenarios: Mobile Store Feedback Pulse

This document outlines potential edge cases, failure modes, and corner scenarios for the feedback pulse pipeline, along with strategies to handle them robustly.

## 1. Data Ingestion & Scraping Edge Cases

| Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Zero Reviews in the Time Window** | Pipeline fails or LLM hallucinates themes out of nothing. | **Circuit Breaker:** Check the length of the parsed review array. If `0`, bypass the LLM phase entirely. Use the MCP Gmail server to send a predefined "No new reviews in the last 8 weeks" email and terminate gracefully. |
| **Massive Spike in Review Volume** (e.g., Viral event) | Context window overflow for the LLM; memory exhaustion in the orchestrator. | **Sampling/Truncation:** Implement a maximum cap (e.g., 500 reviews). If exceeded, randomly sample or prioritize reviews by length, helpfulness score, or 1-star/5-star extremes to provide a representative subset. |
| **Rate Limiting or IP Bans** (from Apple/Google) | Scraper fails to fetch data, returning HTTP 429 or timing out. | **Resilience:** Implement exponential backoff and retries. Use official RSS feeds where possible over aggressive DOM scraping. |
| **Malformed Data or Missing Fields** | Orchestrator crashes on `undefined` errors (e.g., user leaves a star rating but no text). | **Data Validation:** Use a schema validation library (like Zod or Pydantic). Filter out reviews that contain empty `text` fields since they cannot be themed or quoted. |
| **Multilingual / Non-English Reviews** | LLM struggles to cluster, or quotes are generated in mixed languages that stakeholders cannot read. | **Pre-processing / Prompting:** Instruct the Groq LLM to "Translate all quotes to English before summarizing," or handle translation dynamically during synthesis. |

## 2. Sanitization & PII Stripping Edge Cases

| Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Obfuscated PII** (e.g., "john dot doe at mail") | Slips past standard Regex filters into the final Google Doc. | **LLM-Based Scrubbing:** Include specific instructions in the Groq prompt to actively ignore and redact anything resembling personal information before synthesizing. |
| **Over-Aggressive Redaction** | Legitimate feedback is destroyed (e.g., "@mentions" for Twitter handles being mistaken for emails). | **Allow-listing:** Keep regex tightly scoped to standard formats (standard email patterns, 10-digit phone numbers, SSNs). |

## 3. AI Processing (Groq LLM) Edge Cases

| Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Quote Hallucination** | LLM makes up a quote that sounds plausible but was never actually said by a user. | **Post-Validation:** After Groq generates the JSON payload, the Orchestrator must run a string-matching check against the raw review dataset. If a quote doesn't exist in the source, drop it or trigger a prompt retry. |
| **Groq API Rate Limits / Downtime** | Inference fails; pipeline crashes. | **Fallback Mechanism:** Implement robust try-catch blocks with exponential backoff. Optionally, configure a fallback LLM (e.g., OpenAI or Anthropic) if Groq is consistently unreachable. |
| **Malformed Output (JSON Parsing Failure)** | LLM responds with conversational text (e.g., "Here is your JSON...") breaking the `JSON.parse()` step. | **Structured Outputs:** Append strict prompting ("Respond ONLY with valid JSON. No markdown, no conversational text"). Implement a retry loop for parsing failures. |
| **Insufficient Variance** (e.g., All reviews just say "good app") | LLM struggles to find "3 action items" or "5 themes", leading to hallucinated problems. | **Dynamic Prompting:** Instruct the LLM: "If there is not enough variance, return fewer themes. If action items cannot be deduced, explicitly state 'Insufficient data for actionable insights.'" |
| **Context Window Overflow** | LLaMA-3/Mixtral rejects the prompt because it exceeds token limits. | **Map-Reduce:** If token count is too high, chunk the reviews. Ask Groq to summarize themes for chunks individually, then run a final "reduce" prompt to merge the themes. |

## 4. MCP Integration (Google Docs & Gmail) Edge Cases

| Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **MCP Server Unreachable** | Cannot create Docs or send Emails. | **Health Checks:** The orchestrator should ping the MCP servers upon startup. If they are down, halt execution immediately and log an alert rather than burning LLM tokens. |
| **Google Docs Creation Fails** | Doc is not created due to Workspace permission errors. | **Graceful Degradation:** Catch the MCP error. The pipeline should still attempt to send the Gmail draft containing the raw markdown, so the weekly pulse is not entirely lost. |
| **Invalid Email Alias** | Gmail MCP rejects the `create_draft` request. | **Validation:** strictly validate the target email alias in `.env`. Ensure the MCP server has permissions to draft for that specific alias. |

## 5. Orchestration & Runtime Edge Cases

| Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Execution Timeout** | Cloud functions (e.g., AWS Lambda, GitHub Actions) kill the process before completion. | **Decoupling / Config:** Ensure the runtime environment has an adequately high timeout (e.g., >5 minutes), as scraping and LLM inference can take time. |
| **Silent Failures** | Pipeline runs but crashes halfway, leaving stakeholders wondering where the report is. | **Dead Letter Notifications:** Wrap the entire orchestrator in a global try-catch. On failure, use a lightweight Webhook (e.g., Slack, Discord, or a raw API call) to alert the developer that the pipeline failed. |
