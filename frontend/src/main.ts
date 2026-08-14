import './style.css';

// ─── Configuration ────────────────────────────────────────────────────────────

// Use the environment variable if available, otherwise use relative path (since it will be served by the same backend)
const API_URL = import.meta.env.VITE_API_URL || '';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Report {
  top_critical_issues: string[];
  top_feature_requests: string[];
  quotes: string[];
  actionable_ideas: string[];
  email_summary: string;
}

interface Delivery {
  docsSuccess: boolean;
  docsUrl: string | null;
  gmailDraftSuccess: boolean;
  gmailDraftId: string | null;
}

interface ReportData {
  report: Report;
  delivery: Delivery | null;
  generatedAt: string | null;
}

interface StatusData {
  schedulerRunning: boolean;
  pipelineRunning: boolean;
  totalRuns: number;
  lastRunAt: string | null;
  lastRunSuccess: boolean | null;
  cronSchedule: string;
  cronTimezone: string;
}

// ─── App Logic ────────────────────────────────────────────────────────────────

const appDiv = document.querySelector<HTMLDivElement>('#app')!;

function renderLoading() {
  appDiv.innerHTML = `
    <div class="container fade-in">
      <header class="header">
        <div class="header__top">
          <div class="header__brand">
            <div class="header__logo">📈</div>
            <div>
              <h1 class="header__title">Feedback Pulse</h1>
              <p class="header__subtitle">Groww Review Intelligence</p>
            </div>
          </div>
        </div>
      </header>
      <div class="loading-state fade-in">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading insights...</div>
      </div>
    </div>
  `;
}

function renderEmptyState(message: string, isError = false, isRunning = false) {
  appDiv.innerHTML = `
    <div class="container fade-in">
      <header class="header">
        <div class="header__top">
          <div class="header__brand">
            <div class="header__logo">📈</div>
            <div>
              <h1 class="header__title">Feedback Pulse</h1>
              <p class="header__subtitle">Groww Review Intelligence</p>
            </div>
          </div>
        </div>
      </header>
      <div class="empty-state fade-in">
        <div class="empty-state__icon">${isError ? '⚠️' : (isRunning ? '⏳' : '📊')}</div>
        <h2 class="empty-state__title">${isError ? 'Error Loading Data' : (isRunning ? 'Analysis in Progress...' : 'No Data Available')}</h2>
        <p class="empty-state__text">${isRunning ? 'The backend is currently scraping reviews and running the AI analysis. This takes 1-2 minutes. Please wait...' : message}</p>
        <button class="btn btn--primary" id="btn-trigger" ${isRunning ? 'disabled' : ''}>
          ${isRunning ? '<div class="btn__spinner"></div> Running Pipeline...' : 'Run Pipeline Now'}
        </button>
      </div>
    </div>
  `;
  attachTriggerListener();
}

function renderDashboard(data: ReportData, status: StatusData) {
  const r = data.report;
  const d = data.delivery;
  
  const formattedDate = data.generatedAt 
    ? new Date(data.generatedAt).toLocaleString() 
    : 'Unknown Date';

  let deliveryBanner = '';
  if (d) {
    deliveryBanner = `
      <div class="delivery-banner fade-in">
        <div class="delivery-banner__icon">🚀</div>
        <div class="delivery-banner__content">
          <h3 class="delivery-banner__title">Report Delivered</h3>
          <p class="delivery-banner__text">
            ${d.docsSuccess && d.docsUrl ? `<a href="${d.docsUrl}" target="_blank" class="delivery-banner__link">View Full Google Doc</a> • ` : ''}
            ${d.gmailDraftSuccess ? `Gmail Draft Ready (ID: ${d.gmailDraftId})` : ''}
          </p>
        </div>
        <div>
          ${d.docsSuccess ? '<span class="delivery-badge delivery-badge--success">Docs ✅</span>' : '<span class="delivery-badge delivery-badge--fail">Docs ❌</span>'}
          ${d.gmailDraftSuccess ? '<span class="delivery-badge delivery-badge--success">Gmail ✅</span>' : '<span class="delivery-badge delivery-badge--fail">Gmail ❌</span>'}
        </div>
      </div>
    `;
  }

  appDiv.innerHTML = `
    <div class="container fade-in">
      <header class="header">
        <div class="header__top fade-in">
          <div class="header__brand">
            <div class="header__logo">📈</div>
            <div>
              <h1 class="header__title">Feedback Pulse</h1>
              <p class="header__subtitle">Groww Review Intelligence • Last run: ${formattedDate}</p>
            </div>
          </div>
          <div class="header__actions">
            <div class="status-badge" title="Scheduler: ${status.cronSchedule}">
              <div class="status-dot ${status.pipelineRunning ? '' : 'status-dot--offline'}"></div>
              ${status.pipelineRunning ? 'Pipeline Running' : 'Standing By'}
            </div>
            <button class="btn btn--primary" id="btn-trigger" ${status.pipelineRunning ? 'disabled' : ''}>
              ${status.pipelineRunning ? '<div class="btn__spinner"></div> Running...' : 'Run Pipeline'}
            </button>
          </div>
        </div>
      </header>

      ${deliveryBanner}

      <div class="hero-stats fade-in">
        <div class="stat-card stat-card--red">
          <div class="stat-card__icon">🔴</div>
          <div class="stat-card__value">${r.top_critical_issues.length}</div>
          <div class="stat-card__label">Critical Issues</div>
        </div>
        <div class="stat-card stat-card--green">
          <div class="stat-card__icon">💡</div>
          <div class="stat-card__value">${r.top_feature_requests.length}</div>
          <div class="stat-card__label">Feature Requests</div>
        </div>
        <div class="stat-card stat-card--amber">
          <div class="stat-card__icon">🚀</div>
          <div class="stat-card__value">${r.actionable_ideas.length}</div>
          <div class="stat-card__label">Actionable Ideas</div>
        </div>
        <div class="stat-card stat-card--blue">
          <div class="stat-card__icon">💬</div>
          <div class="stat-card__value">${r.quotes.length}</div>
          <div class="stat-card__label">Verbatim Quotes</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card fade-in">
          <div class="card__header">
            <div class="card__icon card__icon--red">🔴</div>
            <h2 class="card__title">Top Critical Issues</h2>
          </div>
          <ul class="card__list">
            ${r.top_critical_issues.map((issue, i) => `
              <li class="card__list-item">
                <div class="card__list-num card__list-num--red">${i + 1}</div>
                <div>${issue}</div>
              </li>
            `).join('')}
          </ul>
        </div>

        <div class="card fade-in">
          <div class="card__header">
            <div class="card__icon card__icon--green">💡</div>
            <h2 class="card__title">Top Feature Requests</h2>
          </div>
          <ul class="card__list">
            ${r.top_feature_requests.map((feature, i) => `
              <li class="card__list-item">
                <div class="card__list-num card__list-num--green">${i + 1}</div>
                <div>${feature}</div>
              </li>
            `).join('')}
          </ul>
        </div>

        <div class="card fade-in summary-card">
          <div class="card__header">
            <div class="card__icon card__icon--blue">📝</div>
            <h2 class="card__title">Executive Summary</h2>
          </div>
          <div class="summary-text">${r.email_summary}</div>
        </div>

        <div class="card fade-in summary-card">
          <div class="card__header">
            <div class="card__icon card__icon--purple">💬</div>
            <h2 class="card__title">Key User Quotes</h2>
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${r.quotes.map(quote => `
              <div class="quote-item">${quote}</div>
            `).join('')}
          </div>
        </div>
        
        <div class="card fade-in summary-card">
          <div class="card__header">
            <div class="card__icon card__icon--amber">🚀</div>
            <h2 class="card__title">Actionable Ideas</h2>
          </div>
          <ul class="card__list">
            ${r.actionable_ideas.map((idea, i) => `
              <li class="card__list-item">
                <div class="card__list-num card__list-num--amber">${i + 1}</div>
                <div>${idea}</div>
              </li>
            `).join('')}
          </ul>
        </div>

      </div>

      <footer class="footer fade-in">
        <div class="footer__text">Powered by App Store Scraper & Groq AI</div>
      </footer>
    </div>
  `;

  attachTriggerListener();
}

function attachTriggerListener() {
  const btn = document.getElementById('btn-trigger') as HTMLButtonElement | null;
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerHTML = '<div class="btn__spinner"></div> Starting...';
    
    try {
      const res = await fetch(`${API_URL}/api/trigger`, { method: 'POST' });
      if (res.ok || res.status === 409) {
        // Reload after short delay to show "Running" state
        setTimeout(init, 1000);
      } else {
        alert('Failed to trigger pipeline. Ensure you have the correct API_SECRET if configured.');
        btn.disabled = false;
        btn.textContent = 'Run Pipeline';
      }
    } catch (err) {
      console.error(err);
      alert('Network error when triggering pipeline.');
      btn.disabled = false;
      btn.textContent = 'Run Pipeline';
    }
  });
}

// ─── Initialization ───────────────────────────────────────────────────────────

async function init() {
  renderLoading();

  try {
    const [reportRes, statusRes] = await Promise.all([
      fetch(`${API_URL}/api/report`),
      fetch(`${API_URL}/api/status`)
    ]);

    const status: StatusData = await statusRes.json().catch(() => ({}));

    if (reportRes.ok) {
      const data: ReportData = await reportRes.json();
      renderDashboard(data, status);
    } else {
      if (reportRes.status === 404) {
        renderEmptyState('The pipeline hasn\'t run yet. Trigger a manual run to generate the first report.', false, status.pipelineRunning);
      } else {
        renderEmptyState('Failed to load report data from the server.', true, status.pipelineRunning);
      }
    }
  } catch (err) {
    console.error('Fetch error:', err);
    renderEmptyState('Could not connect to the backend server. Is it running?', true);
  }
}

// Start app
init();

// Auto-refresh every 30 seconds if pipeline is running
setInterval(async () => {
  try {
    const res = await fetch(`${API_URL}/api/status`);
    if (res.ok) {
      const status: StatusData = await res.json();
      if (status.pipelineRunning) {
        // Don't fully re-render to avoid jank, just update status badge
        const badge = document.querySelector('.status-badge');
        const btn = document.getElementById('btn-trigger') as HTMLButtonElement | null;
        
        if (badge && btn) {
          badge.innerHTML = '<div class="status-dot"></div>Pipeline Running';
          btn.disabled = true;
          btn.innerHTML = '<div class="btn__spinner"></div> Running...';
        }
      } else {
        // If it was running but now finished, re-render everything
        const btn = document.getElementById('btn-trigger') as HTMLButtonElement | null;
        if (btn && btn.disabled) {
          init();
        }
      }
    }
  } catch (e) {
    // ignore
  }
}, 30000);
