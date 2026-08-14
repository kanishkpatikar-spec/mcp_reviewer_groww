# Deployment Plan: Mobile Store Feedback Pulse

Based on the system's architecture and implementation phases, this document outlines the deployment strategy for moving the project from a local development environment to production.

We will use a split architecture:
1. **Backend (Worker & API) on Railway:** Handles the heavy lifting (scraping, LLM processing, MCP orchestration) and scheduling.
2. **Frontend (Dashboard) on Vercel:** Provides a user interface for stakeholders to view historical reports and manually trigger the pipeline. *(Note: Frontend implementation is planned as a future phase).*

---

## 1. Backend Deployment (Railway)

The backend consists of the Node.js orchestrator and scheduler built in Phase 6. Railway is ideal for this because it seamlessly supports long-running background workers.

### 1.1 Architecture on Railway
*   **Worker Service:** Runs the `npm run scheduler` command to execute the pipeline automatically every Monday at 9:00 AM IST.
*   *(Optional API Service):* In the future, we can wrap the orchestrator in a lightweight Express.js server to expose REST endpoints (e.g., `POST /api/trigger`, `GET /api/reports`). This API will be consumed by the Vercel frontend.

### 1.2 Deployment Steps
1.  **Initialize Railway:** Link your GitHub repository to a new Railway project.
2.  **Environment Variables:** Add the following secrets to the Railway environment:
    *   `GROQ_API_KEY`: For LLM synthesis.
    *   `MCP_SERVER_URL`: The URL of the Google Workspace MCP server.
    *   `STAKEHOLDER_EMAIL`: Target email for Gmail delivery.
    *   `GOOGLE_DOC_ID`: Target document for report appending.
    *   `CRON_SCHEDULE` / `CRON_TIMEZONE`: Scheduler configuration.
3.  **Start Command:** Configure the Railway service's start command:
    ```bash
    npm run scheduler
    ```
4.  **Persistent Storage (Optional):** Attach a Railway PostgreSQL or Redis plugin if you want to store historical `delivery_result.json` logs rather than just writing to the ephemeral local filesystem.

---

## 2. Frontend Deployment (Vercel)

A frontend dashboard will allow non-technical stakeholders to view insights without waiting for the Monday email or opening Google Docs. Vercel is the optimal platform for this.

### 2.1 Architecture on Vercel
*   **Framework:** Next.js (React) or Vite.
*   **Functionality:**
    *   A dashboard displaying the latest Top 3 Critical Issues and Feature Requests.
    *   A "Run Now" button that pings the Railway backend's API to execute an on-demand pulse check.
*   **Serverless Execution:** Vercel's edge network will serve the static UI, while data fetching will securely proxy through Vercel Serverless Functions to the Railway backend.

### 2.2 Deployment Steps
1.  **Implementation:** Build the frontend inside a `web/` or `frontend/` directory in the monorepo.
2.  **Initialize Vercel:** Import the GitHub repository into Vercel and set the Root Directory to the frontend folder.
3.  **Environment Variables:**
    *   `NEXT_PUBLIC_API_URL`: The public URL of the Railway backend (e.g., `https://mcp-reviewer-backend.up.railway.app`).
4.  **Continuous Integration:** Vercel automatically deploys pushes to the `main` branch.

---

## 3. Connecting Backend and Frontend

To enable communication between the Vercel Frontend and Railway Backend:

1.  **CORS Configuration:** Ensure the Railway backend explicitly allows Cross-Origin Resource Sharing (CORS) from your `*.vercel.app` domain.
2.  **Authentication:** Implement a shared secret (e.g., `API_SECRET_KEY`) stored in both Vercel and Railway to prevent unauthorized internet users from triggering the expensive LLM pipeline.
3.  **Data Storage:** Currently, the pipeline writes to local JSON files (`reviews.json`, `final_report.json`). For a production Vercel frontend to read these, the Railway backend must either:
    *   Expose an endpoint to serve the JSON.
    *   Save the JSON to a managed database (like Supabase or Railway Postgres) which the frontend queries directly.

---

## 4. MCP Server Deployment Note

This plan assumes the Google Workspace MCP Server is hosted independently (e.g., currently running at `https://mcpserver-production-b397.up.railway.app`). 
*   **Uptime:** Ensure the MCP server's uptime SLA matches the backend scheduler's requirements.
*   **Security:** If the MCP server requires authorization headers in the future, these must be added to the Railway environment variables and passed through `src/mcp_client.ts`.
