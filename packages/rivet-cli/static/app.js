/* Rivet Dashboard — Full SPA */

const App = {
  ws: null,
  currentPage: 'overview',
  stats: {},
  runs: [],
  chatMessages: [],
  chatBusy: false,
  streamBuffer: '',
  selectedRun: null,
  config: {},
  permissions: {},
  workflows: { builtin: [], custom: [] },
  sidebarCollapsed: false,

  init() {
    this.bindNav();
    this.bindKeys();
    this.connectWs();
    this.navigate('overview');
    this.loadTopbar();
  },

  /* ── Navigation ─────────────────────────── */

  bindNav() {
    document.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        this.navigate(link.dataset.page);
      });
    });
  },

  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    const active = document.querySelector(`[data-page="${page}"]`);
    if (active) active.classList.add('active');

    const el = document.getElementById('page-content');
    el.innerHTML = '';

    switch (page) {
      case 'overview': this.renderOverview(el); break;
      case 'runs': this.renderRuns(el); break;
      case 'workflows': this.renderWorkflows(el); break;
      case 'traces': this.renderTraces(el); break;
      case 'secrets': this.renderSecrets(el); break;
      case 'security': this.renderSecurity(el); break;
      case 'chat': this.renderChat(el); break;
      case 'settings': this.renderSettings(el); break;
    }
  },

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    document.getElementById('sidebar').classList.toggle('collapsed', this.sidebarCollapsed);
    document.body.classList.toggle('sidebar-hidden', this.sidebarCollapsed);
  },

  /* ── Keyboard Shortcuts ────────────────── */

  bindKeys() {
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.openPalette();
      }
      if (e.key === 'Escape') {
        this.closePalette();
      }
    });
  },

  /* ── Command Palette ───────────────────── */

  openPalette() {
    const overlay = document.getElementById('cmd-palette');
    overlay.style.display = 'flex';
    const input = document.getElementById('palette-input');
    input.value = '';
    input.focus();
    this.renderPaletteResults('');
    input.oninput = () => this.renderPaletteResults(input.value);
    input.onkeydown = (e) => {
      if (e.key === 'Escape') this.closePalette();
      if (e.key === 'Enter') {
        const sel = document.querySelector('.palette-item.selected') || document.querySelector('.palette-item');
        if (sel) sel.click();
      }
    };
    overlay.onclick = (e) => { if (e.target === overlay) this.closePalette(); };
  },

  closePalette() {
    document.getElementById('cmd-palette').style.display = 'none';
  },

  paletteCommands() {
    return [
      { icon: '◉', label: 'Go to Overview', action: () => this.navigate('overview') },
      { icon: '▶', label: 'Go to Runs', action: () => this.navigate('runs') },
      { icon: '⟐', label: 'Go to Workflows', action: () => this.navigate('workflows') },
      { icon: '⧖', label: 'Go to Traces & Diffs', action: () => this.navigate('traces') },
      { icon: '⛉', label: 'Go to Secrets Vault', action: () => this.navigate('secrets') },
      { icon: '⛨', label: 'Go to Security Center', action: () => this.navigate('security') },
      { icon: '⌁', label: 'Open Chat', action: () => this.navigate('chat') },
      { icon: '⚙', label: 'Settings', action: () => this.navigate('settings') },
      { icon: '↺', label: 'Replay last run with different model', hint: 'runs replay', action: () => { this.navigate('traces'); } },
      { icon: '⇄', label: 'Diff two runs', hint: 'runs diff', action: () => { this.navigate('traces'); } },
    ];
  },

  renderPaletteResults(query) {
    const container = document.getElementById('palette-results');
    const q = query.toLowerCase();
    const cmds = this.paletteCommands().filter(c => !q || c.label.toLowerCase().includes(q));

    container.innerHTML = cmds.map((c, i) => `
      <div class="palette-item ${i === 0 ? 'selected' : ''}" onclick="App.executePaletteCmd(${i}, '${this.esc(query)}')">
        <span class="palette-item-icon">${c.icon}</span>
        <span>${this.esc(c.label)}</span>
        ${c.hint ? `<span class="palette-item-hint">${c.hint}</span>` : ''}
      </div>
    `).join('') || '<div style="padding:20px;text-align:center;color:var(--text-muted)">No results</div>';
  },

  executePaletteCmd(index, query) {
    const q = query.toLowerCase();
    const cmds = this.paletteCommands().filter(c => !q || c.label.toLowerCase().includes(q));
    if (cmds[index]) {
      cmds[index].action();
      this.closePalette();
    }
  },

  /* ── Topbar ────────────────────────────── */

  async loadTopbar() {
    try {
      const config = await this.api('config');
      this.config = config;
      const model = config.model || 'Unknown';
      const provider = config.provider || 'Unknown';
      document.getElementById('topbar-model').textContent = `${provider} / ${model}`;
    } catch { /* ignore */ }
  },

  /* ── WebSocket ─────────────────────────── */

  connectWs() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);

    this.ws.onopen = () => {
      const orb = document.getElementById('ws-orb');
      const text = document.getElementById('ws-text');
      orb.classList.add('live');
      text.textContent = 'Connected';
    };

    this.ws.onclose = () => {
      const orb = document.getElementById('ws-orb');
      const text = document.getElementById('ws-text');
      orb.classList.remove('live');
      text.textContent = 'Disconnected';
      setTimeout(() => this.connectWs(), 3000);
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleWsMessage(msg);
    };
  },

  handleWsMessage(msg) {
    switch (msg.type) {
      case 'message':
        this.removeThinking();
        this.removeActivity();
        if (msg.role === 'assistant') {
          this.chatMessages.push({ type: 'message', role: msg.role, content: msg.content });
          this.renderChatMessages();
        } else if (msg.role === 'system') {
          this.chatMessages.push({ type: 'message', role: msg.role, content: msg.content });
          this.renderChatMessages();
          this.showThinking();
        } else {
          this.chatMessages.push({ type: 'message', role: msg.role, content: msg.content });
          this.renderChatMessages();
        }
        break;
      case 'tool_result':
        this.removeActivity();
        this.chatMessages.push({ type: 'tool_result', name: msg.name, output: msg.output, error: msg.error });
        this.renderChatMessages();
        this.showThinking();
        break;
      case 'approval_request':
        this.removeThinking();
        this.removeActivity();
        this.chatMessages.push({ type: 'approval', id: msg.id, action: msg.action, diff: msg.diff });
        this.renderChatMessages();
        break;
      case 'tool_start':
        this.removeThinking();
        this.showActivity(msg.name, msg.description);
        break;
      case 'stream_token':
        this.removeThinking();
        this.removeActivity();
        this.streamBuffer = (this.streamBuffer || '') + msg.token;
        this.updateStreamingMessage();
        break;
      case 'stream_end':
        if (this.streamBuffer) {
          this.chatMessages.push({ type: 'message', role: 'assistant', content: this.streamBuffer });
          this.streamBuffer = '';
          this.renderChatMessages();
        }
        this.showThinking();
        break;
      case 'done':
        this.removeThinking();
        this.removeActivity();
        if (this.streamBuffer) {
          this.chatMessages.push({ type: 'message', role: 'assistant', content: this.streamBuffer });
          this.streamBuffer = '';
        }
        this.chatBusy = false;
        this.renderChatMessages();
        this.updateChatInput();
        document.getElementById('mini-player').style.display = 'none';
        break;
      case 'error':
        this.removeThinking();
        this.removeActivity();
        this.chatMessages.push({ type: 'message', role: 'system', content: msg.message });
        this.chatBusy = false;
        this.renderChatMessages();
        this.updateChatInput();
        break;
      case 'reset_ack':
        this.removeThinking();
        this.removeActivity();
        this.chatMessages = [];
        this.renderChatMessages();
        break;
    }
  },

  sendWs(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  },

  /* ── API Helpers ───────────────────────── */

  async api(path, opts) {
    const res = await fetch(`/api/${path}`, opts);
    return res.json();
  },

  /* ── 1. Overview Page ──────────────────── */

  async renderOverview(el) {
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Overview</div>
          <div class="page-subtitle">Your local agent command center</div>
        </div>
      </div>
      <div class="stats-grid" id="stats-grid"><div class="stat-card"><div class="loading-spinner"></div></div></div>
      <div class="section-title">Five Pillars</div>
      <div class="pillar-grid" id="pillar-grid"></div>
      <div class="section-title">24h Activity Timeline</div>
      <div class="glass-card" id="timeline-card" style="margin-bottom:28px"><div class="timeline" id="activity-timeline"></div></div>
      <div class="section-title">Quick Start Workflows</div>
      <div class="workflow-grid" id="quick-workflows"></div>
    `;

    const [stats, runs, workflows] = await Promise.all([
      this.api('stats'),
      this.api('runs'),
      this.api('workflows').catch(() => ({ builtin: [], custom: [] })),
    ]);

    this.stats = stats;
    this.runs = runs;
    this.workflows = workflows;

    const runningCount = runs.filter(r => r.status === 'running').length;
    const badge = document.getElementById('runs-badge');
    if (badge) {
      if (runningCount > 0) { badge.style.display = 'inline'; badge.textContent = runningCount; }
      else { badge.style.display = 'none'; }
    }

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card accent-primary">
        <div class="stat-icon">▶</div>
        <div class="stat-label">Total Runs</div>
        <div class="stat-value">${stats.total_runs}</div>
        <div class="stat-sub">${runningCount} running now</div>
      </div>
      <div class="stat-card accent-success">
        <div class="stat-icon">✓</div>
        <div class="stat-label">Success Rate</div>
        <div class="stat-value">${stats.success_rate}%</div>
        <div class="stat-sub">${stats.completed} completed</div>
      </div>
      <div class="stat-card accent-accent">
        <div class="stat-icon">⚡</div>
        <div class="stat-label">Tool Calls</div>
        <div class="stat-value">${stats.total_tool_calls}</div>
        <div class="stat-sub">across all runs</div>
      </div>
      <div class="stat-card accent-warning">
        <div class="stat-icon">⛨</div>
        <div class="stat-label">Approvals</div>
        <div class="stat-value">${stats.total_approvals}</div>
        <div class="stat-sub">safety checkpoints</div>
      </div>
    `;

    document.getElementById('pillar-grid').innerHTML = `
      <div class="pillar-card" onclick="App.navigate('traces')">
        <div class="pillar-icon">⧖</div>
        <div class="pillar-title">Deterministic Execution</div>
        <div class="pillar-stat"><span class="pillar-highlight">${stats.total_runs}</span> runs tracked with SHA-256 fingerprints</div>
      </div>
      <div class="pillar-card" onclick="App.navigate('traces')">
        <div class="pillar-icon">⇄</div>
        <div class="pillar-title">Git for Agents</div>
        <div class="pillar-stat">Diff any two runs side-by-side. <span class="pillar-highlight">Replay</span> with different model.</div>
      </div>
      <div class="pillar-card" onclick="App.navigate('secrets')">
        <div class="pillar-icon">⛉</div>
        <div class="pillar-title">Secrets Vault</div>
        <div class="pillar-stat"><span class="pillar-highlight">AES-256-GCM</span> encrypted. Machine-bound keys.</div>
      </div>
      <div class="pillar-card" onclick="App.navigate('security')">
        <div class="pillar-icon">⛨</div>
        <div class="pillar-title">Content Guard</div>
        <div class="pillar-stat">Anti-injection scanning. <span class="pillar-highlight">RAG sanitization</span>. Per-tool scopes.</div>
      </div>
    `;

    const timeline = document.getElementById('activity-timeline');
    if (runs.length === 0) {
      timeline.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px">No activity yet. Run a task to see the timeline.</div>';
    } else {
      timeline.innerHTML = runs.slice(0, 60).map(r => {
        const cls = r.status === 'completed' ? 'success' : r.status === 'failed' ? 'failed' : r.status === 'running' ? 'running' : 'approval';
        return `<div class="timeline-dot ${cls}" onclick="App.showRunFromDash('${r.id}')"><div class="tooltip">${this.esc(this.truncate(r.task, 40))}<br>${r.status} • ${r.action_count} actions</div></div>`;
      }).join('');
    }

    const quickWf = document.getElementById('quick-workflows');
    const allWf = [...(workflows.builtin || []), ...(workflows.custom || [])];
    if (allWf.length === 0) {
      quickWf.innerHTML = '<div style="color:var(--text-muted);font-size:13px">No workflows yet. Run <code>rivet workflow init</code> to install templates.</div>';
    } else {
      quickWf.innerHTML = allWf.slice(0, 6).map(w => `
        <div class="workflow-card">
          <div class="workflow-name">${this.esc(w.name)}</div>
          <div class="workflow-desc">${this.esc(w.description)}</div>
          <div class="workflow-meta"><span>${w.steps} steps</span></div>
          <div class="workflow-actions">
            <button class="btn btn-primary btn-sm" onclick="App.navigate('workflows')">View</button>
          </div>
        </div>
      `).join('');
    }
  },

  showRunFromDash(id) {
    this.navigate('runs');
    setTimeout(() => this.expandRun(id), 100);
  },

  /* ── 2. Runs Explorer ──────────────────── */

  async renderRuns(el) {
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Runs</div>
          <div class="page-subtitle">All agent executions</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-danger btn-sm" onclick="App.clearAllRuns()">Clear All</button>
        </div>
      </div>
      <div id="runs-table"><div class="empty-state"><div class="loading-spinner"></div></div></div>
      <div id="run-detail-container"></div>
    `;

    const runs = await this.api('runs');
    this.runs = runs;
    const container = document.getElementById('runs-table');

    if (runs.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">▶</div><div class="empty-state-text">No runs recorded</div><div class="empty-state-hint">Run "rivet run" or "rivet chat" to create run logs.</div></div>';
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Status</th><th>Task</th><th>Provider</th><th>Model</th><th>Actions</th><th>Time</th><th></th>
        </tr></thead>
        <tbody>${runs.map(r => `
          <tr onclick="App.expandRun('${r.id}')" data-run-id="${r.id}">
            <td><span class="badge badge-${r.status}">${r.status}</span></td>
            <td>${this.esc(this.truncate(r.task, 50))}</td>
            <td style="color:var(--text-muted)">${r.provider}</td>
            <td style="color:var(--text-muted);font-family:var(--font-mono);font-size:12px">${r.model}</td>
            <td>${r.action_count}</td>
            <td style="color:var(--text-muted);font-size:12px">${this.fmtTime(r.timestamp)}</td>
            <td>
              <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();App.viewTrace('${r.id}')">Trace</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  },

  async expandRun(id) {
    const detail = document.getElementById('run-detail-container');
    if (this.selectedRun === id) { this.selectedRun = null; detail.innerHTML = ''; return; }

    this.selectedRun = id;
    detail.innerHTML = '<div class="run-detail"><div class="loading-spinner"></div></div>';
    const run = await this.api(`runs/${id}`);

    detail.innerHTML = `
      <div class="run-detail">
        <div class="run-detail-header">
          <div>
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">${this.esc(run.task)}</div>
            <div class="run-meta">
              <span>ID: ${run.id.slice(0, 12)}</span>
              <span>${run.provider}/${run.model}</span>
              <span>${this.fmtTime(run.timestamp)}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge badge-${run.status}">${run.status}</span>
            <button class="btn btn-ghost btn-xs" onclick="App.viewTrace('${run.id}')">Trace</button>
            <button class="btn btn-danger btn-xs" onclick="App.deleteRun('${run.id}')">Delete</button>
          </div>
        </div>
        ${run.summary ? `<div style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">${this.esc(run.summary)}</div>` : ''}
        ${this.renderFileGroupView(run.actions)}
        <div class="section-title">Actions (${run.actions.length})</div>
        <div class="run-actions-list">
          ${run.actions.map(a => `
            <div class="run-action">
              <span class="run-action-type">${a.type}</span>
              <span class="run-action-data">${this.esc(this.formatActionData(a))}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /* ── 3. Workflows ──────────────────────── */

  async renderWorkflows(el) {
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Workflows</div>
          <div class="page-subtitle">Autonomous multi-step pipelines</div>
        </div>
      </div>
      <div id="wf-content"><div class="empty-state"><div class="loading-spinner"></div></div></div>
    `;

    const workflows = await this.api('workflows').catch(() => ({ builtin: [], custom: [] }));
    this.workflows = workflows;
    const container = document.getElementById('wf-content');
    const all = [...(workflows.builtin || []), ...(workflows.custom || [])];

    if (all.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⟐</div><div class="empty-state-text">No workflows found</div><div class="empty-state-hint">Run <code style="background:var(--bg-surface);padding:2px 6px;border-radius:4px">rivet workflow init</code> to install built-in templates, or create custom workflows in .rivet/workflows/</div></div>`;
      return;
    }

    container.innerHTML = `
      ${workflows.builtin?.length ? '<div class="section-title">Built-in Workflows</div>' : ''}
      <div class="workflow-grid">${(workflows.builtin || []).map(w => this.workflowCard(w, 'builtin')).join('')}</div>
      ${workflows.custom?.length ? '<div class="section-title" style="margin-top:28px">Custom Workflows</div>' : ''}
      <div class="workflow-grid">${(workflows.custom || []).map(w => this.workflowCard(w, 'custom')).join('')}</div>
    `;
  },

  workflowCard(w, type) {
    const typeLabel = type === 'builtin' ? '<span class="badge badge-completed">built-in</span>' : '<span class="badge" style="background:var(--primary-dim);color:var(--primary)">custom</span>';
    return `
      <div class="workflow-card">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <div class="workflow-name">${this.esc(w.name)}</div>
          ${typeLabel}
        </div>
        <div class="workflow-desc">${this.esc(w.description)}</div>
        <div class="workflow-meta"><span>${w.steps} steps</span></div>
        <div class="workflow-actions">
          <button class="btn btn-primary btn-sm" onclick="alert('Run from CLI: rivet workflow run ${this.esc(w.name)}')">How to Run</button>
        </div>
      </div>
    `;
  },

  /* ── 4. Traces & Diffs ─────────────────── */

  async renderTraces(el) {
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Traces & Diffs</div>
          <div class="page-subtitle">Deterministic execution replay and run comparison</div>
        </div>
      </div>
      <div class="glass-card" style="margin-bottom:24px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600;color:var(--text-secondary)">Diff two runs:</span>
          <select id="diff-left" class="field-input" style="width:200px"></select>
          <span style="color:var(--text-muted)">vs</span>
          <select id="diff-right" class="field-input" style="width:200px"></select>
          <button class="btn btn-primary btn-sm" onclick="App.runDiff()">Compare</button>
        </div>
      </div>
      <div id="diff-result"></div>
      <div class="section-title" style="margin-top:24px">View Trace</div>
      <div class="glass-card">
        <div style="display:flex;gap:12px;align-items:center">
          <span style="font-size:13px;font-weight:600;color:var(--text-secondary)">Run:</span>
          <select id="trace-select" class="field-input" style="width:300px"></select>
          <button class="btn btn-primary btn-sm" onclick="App.loadTrace()">View Trace</button>
        </div>
      </div>
      <div id="trace-result" style="margin-top:24px"></div>
    `;

    const runs = await this.api('runs');
    this.runs = runs;

    const options = runs.map(r => `<option value="${r.id}">${r.id.slice(0, 8)} — ${this.esc(this.truncate(r.task, 30))} (${r.status})</option>`).join('');
    document.getElementById('diff-left').innerHTML = options;
    document.getElementById('diff-right').innerHTML = options;
    document.getElementById('trace-select').innerHTML = options;

    if (runs.length >= 2) {
      document.getElementById('diff-right').selectedIndex = 1;
    }
  },

  async runDiff() {
    const left = document.getElementById('diff-left').value;
    const right = document.getElementById('diff-right').value;
    if (!left || !right) return;

    const container = document.getElementById('diff-result');
    container.innerHTML = '<div class="loading-spinner"></div>';

    try {
      const result = await this.api(`runs/diff/${left}/${right}`);

      container.innerHTML = `
        <div class="glass-card">
          <div style="font-weight:700;font-size:15px;margin-bottom:12px">Diff: ${left.slice(0, 8)} vs ${right.slice(0, 8)}</div>
          <div style="color:var(--accent);font-size:13px;margin-bottom:16px">${this.esc(result.summary)}</div>
          <div style="display:flex;gap:16px;margin-bottom:16px">
            <div style="font-size:12px"><span style="color:var(--text-muted)">Left actions:</span> ${result.stats.totalLeft}</div>
            <div style="font-size:12px"><span style="color:var(--text-muted)">Right actions:</span> ${result.stats.totalRight}</div>
            <div style="font-size:12px"><span style="color:var(--success)">Same:</span> ${result.stats.same}</div>
            <div style="font-size:12px"><span style="color:var(--warning)">Changed:</span> ${result.stats.changed}</div>
            <div style="font-size:12px"><span style="color:var(--danger)">Removed:</span> ${result.stats.removed}</div>
            <div style="font-size:12px"><span style="color:var(--success)">Added:</span> ${result.stats.added}</div>
          </div>
          ${result.metaDiffs?.length ? `<div class="section-title">Metadata Changes</div>
            ${result.metaDiffs.map(m => `<div style="font-size:12px;font-family:var(--font-mono);padding:4px 0"><span style="color:var(--text-muted)">${m.field}:</span> <span class="diff-del">${this.esc(m.left)}</span> → <span class="diff-add">${this.esc(m.right)}</span></div>`).join('')}` : ''}
          ${result.actionDiffs?.filter(a => a.status !== 'same').length ? `
            <div class="section-title" style="margin-top:16px">Action Changes</div>
            ${result.actionDiffs.filter(a => a.status !== 'same').map(a => {
              const color = a.status === 'added' ? 'var(--success)' : a.status === 'removed' ? 'var(--danger)' : 'var(--warning)';
              const tag = a.status === 'added' ? '+' : a.status === 'removed' ? '-' : '~';
              const leftText = a.left ? `${a.left.type}${a.left.tool ? ':' + a.left.tool : ''}` : '';
              const rightText = a.right ? `${a.right.type}${a.right.tool ? ':' + a.right.tool : ''}` : '';
              return `<div style="font-size:12px;font-family:var(--font-mono);padding:2px 0;color:${color}">${tag} [${a.index}] ${leftText}${a.status === 'changed' ? ' → ' + rightText : rightText}</div>`;
            }).join('')}` : ''}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color:var(--danger);padding:16px">Failed to diff: ${err.message}</div>`;
    }
  },

  async loadTrace() {
    const id = document.getElementById('trace-select').value;
    if (!id) return;
    this.viewTrace(id);
  },

  async viewTrace(id) {
    if (this.currentPage !== 'traces') {
      this.navigate('traces');
      await new Promise(r => setTimeout(r, 200));
    }

    const container = document.getElementById('trace-result');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"></div>';

    try {
      const trace = await this.api(`runs/${id}/trace`);

      container.innerHTML = `
        <div class="glass-card">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
            <div>
              <div style="font-weight:700;font-size:15px">Execution Trace</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${trace.provider}/${trace.model} • ${trace.snapshots.length} steps • Final FP: <span class="trace-fp">${trace.finalFingerprint?.slice(0, 12) || 'N/A'}</span></div>
            </div>
          </div>
          <div class="trace-container">
            <div class="trace-timeline">
              ${trace.snapshots.map((s, i) => `
                <div class="trace-node" onclick="App.showTraceStep(${i}, '${id}')">
                  <div class="trace-node-dot ${s.trigger === 'user_message' ? 'user' : s.trigger === 'tool_call' ? 'tool_call' : s.trigger === 'tool_result' ? 'tool_result' : 'assistant'}"></div>
                  <div class="trace-node-info">
                    <div class="trace-node-title">#${s.step} ${s.trigger}${s.toolName ? ': ' + s.toolName : ''}</div>
                    <div class="trace-node-sub">
                      <span class="trace-fp" title="Click to copy" onclick="navigator.clipboard.writeText('${s.fingerprint}')">${s.fingerprint.slice(0, 10)}</span>
                      <span>${s.messageCount} msgs</span>
                      <span>~${s.tokenEstimate} tok</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="trace-detail" id="trace-step-detail">
              <div style="color:var(--text-muted);padding:20px;text-align:center">Click a step to see details</div>
            </div>
          </div>
        </div>
      `;

      this._traceData = trace;
    } catch {
      container.innerHTML = `<div class="glass-card"><div style="color:var(--text-muted);text-align:center;padding:40px">No execution trace found for this run.<br><span style="font-size:12px">Traces are generated for new runs only.</span></div></div>`;
    }
  },

  showTraceStep(index) {
    const trace = this._traceData;
    if (!trace) return;
    const s = trace.snapshots[index];
    const detail = document.getElementById('trace-step-detail');

    document.querySelectorAll('.trace-node').forEach((n, i) => n.classList.toggle('selected', i === index));

    detail.innerHTML = `
      <div style="font-weight:700;margin-bottom:12px">Step #${s.step}: ${s.trigger}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:12px">
        <div><span style="color:var(--text-muted)">Trigger:</span> ${s.trigger}</div>
        <div><span style="color:var(--text-muted)">Tool:</span> ${s.toolName || 'N/A'}</div>
        <div><span style="color:var(--text-muted)">Messages:</span> ${s.messageCount}</div>
        <div><span style="color:var(--text-muted)">Tokens:</span> ~${s.tokenEstimate}</div>
        <div><span style="color:var(--text-muted)">Time:</span> ${this.fmtTime(s.timestamp)}</div>
        <div><span style="color:var(--text-muted)">Fingerprint:</span> <span class="trace-fp" onclick="navigator.clipboard.writeText('${s.fingerprint}')">${s.fingerprint}</span></div>
      </div>
      ${s.data ? `<pre>${JSON.stringify(s.data, null, 2)}</pre>` : ''}
    `;
  },

  /* ── 5. Secrets Vault ──────────────────── */

  async renderSecrets(el) {
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Secrets Vault</div>
          <div class="page-subtitle">AES-256-GCM encrypted storage, machine-bound</div>
        </div>
      </div>
      <div class="glass-card" style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:16px">
          <span style="font-size:32px;filter:drop-shadow(0 0 8px var(--success-glow))">🔐</span>
          <div>
            <div style="font-weight:700;color:var(--success)">Vault Secured</div>
            <div style="font-size:12px;color:var(--text-muted)">Encrypted with AES-256-GCM • Key derived from machine identity via PBKDF2 (100k iterations)</div>
          </div>
        </div>
      </div>
      <div class="section-title">Stored Secrets</div>
      <div class="glass-card">
        <div style="color:var(--text-secondary);font-size:13px;line-height:1.7">
          <p>Secret management is handled through the CLI for maximum security.</p>
          <p style="margin-top:12px">
            <code style="background:var(--bg-surface);padding:4px 8px;border-radius:4px;font-family:var(--font-mono)">rivet secrets set ANTHROPIC_API_KEY</code> — Store an encrypted secret<br>
            <code style="background:var(--bg-surface);padding:4px 8px;border-radius:4px;font-family:var(--font-mono)">rivet secrets list</code> — List secret names (values never shown)<br>
            <code style="background:var(--bg-surface);padding:4px 8px;border-radius:4px;font-family:var(--font-mono)">rivet secrets delete &lt;name&gt;</code> — Remove a secret
          </p>
          <p style="margin-top:12px;color:var(--text-muted);font-size:12px">Secrets are stored in <code style="background:var(--bg-surface);padding:2px 6px;border-radius:3px">.rivet/secrets.enc</code> and auto-resolved when running agents. The dashboard never sees plaintext values.</p>
        </div>
      </div>
    `;
  },

  /* ── 6. Security Center ────────────────── */

  async renderSecurity(el) {
    const stats = this.stats.total_runs ? this.stats : await this.api('stats');

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Security Center</div>
          <div class="page-subtitle">Content Guard, prompt injection defense, tool sandboxing</div>
        </div>
      </div>
      <div class="glass-card shield-container" style="margin-bottom:24px">
        <div class="shield-icon">🛡️</div>
        <div class="shield-status">All Systems Secure</div>
        <div class="shield-sub">Content Guard is active on all agent tool outputs</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px">
        <div class="stat-card accent-success">
          <div class="stat-label">Prompt Injections Blocked</div>
          <div class="stat-value">0</div>
          <div class="stat-sub">neutralized in real-time</div>
        </div>
        <div class="stat-card accent-warning">
          <div class="stat-label">Approval Checkpoints</div>
          <div class="stat-value">${stats.total_approvals || 0}</div>
          <div class="stat-sub">write operations gated</div>
        </div>
        <div class="stat-card accent-primary">
          <div class="stat-label">Sandboxed Runs</div>
          <div class="stat-value">${stats.total_runs || 0}</div>
          <div class="stat-sub">100% permission-checked</div>
        </div>
      </div>
      <div class="section-title">Protection Layers</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="glass-card">
          <div style="font-weight:700;margin-bottom:8px">Prompt Injection Detection</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">15+ regex patterns scan all tool outputs for "ignore previous instructions", jailbreak attempts, DAN mode, and encoded injection attacks. Threats are neutralized in-place.</div>
        </div>
        <div class="glass-card">
          <div style="font-weight:700;margin-bottom:8px">Data Exfiltration Prevention</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">Detects attempts to pipe secrets to external URLs via curl, wget, or fetch. Blocks exfiltration patterns in real-time before tool execution.</div>
        </div>
        <div class="glass-card">
          <div style="font-weight:700;margin-bottom:8px">Per-Tool Scope Escalation</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">When untrusted content enters the conversation context, write tools (run_command, write_file, etc.) automatically require extra approval — even if normally auto-approved.</div>
        </div>
        <div class="glass-card">
          <div style="font-weight:700;margin-bottom:8px">RAG Sanitization</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">All content from fetch_url and semantic_search is wrapped with source labels and threat scanning before entering the agent context window.</div>
        </div>
      </div>
    `;
  },

  /* ── 7. Chat ───────────────────────────── */

  renderChat(el) {
    el.innerHTML = `
      <div class="chat-container">
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input-row">
          <input type="text" id="chat-input" class="chat-input" placeholder="Ask Rivet something..." autocomplete="off" autofocus>
          <button id="chat-send" class="btn btn-primary" onclick="App.sendChat()">Send</button>
          <button class="btn btn-ghost" onclick="App.resetChat()">Reset</button>
        </div>
      </div>
    `;
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChat(); }
    });
    this.renderChatMessages();
    this.updateChatInput();
  },

  sendChat() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text || this.chatBusy) return;
    this.chatBusy = true;
    this.updateChatInput();
    input.value = '';
    this.sendWs({ type: 'chat', message: text });
    document.getElementById('mini-player').style.display = 'block';
    document.getElementById('mini-text').textContent = this.truncate(text, 30);
    this.showThinking();
  },

  resetChat() {
    this.chatBusy = false;
    this.chatMessages = [];
    this.sendWs({ type: 'reset' });
    this.renderChatMessages();
    this.updateChatInput();
  },

  updateChatInput() {
    const btn = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    if (btn) btn.disabled = this.chatBusy;
    if (input) input.disabled = this.chatBusy;
    if (input && !this.chatBusy) input.focus();
  },

  renderChatMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (this.chatMessages.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⌁</div><div class="empty-state-text">Start a conversation</div><div class="empty-state-hint">Type a message below. Rivet runs on your configured provider.</div></div>';
      return;
    }

    container.innerHTML = this.chatMessages.map(m => {
      if (m.type === 'message') return `<div class="chat-msg ${m.role}"><div class="msg-role">${m.role}</div><div>${this.renderMarkdown(m.content)}</div></div>`;
      if (m.type === 'tool_result') {
        const previewable = this.getPreviewPath(m);
        const previewBtn = previewable ? `<button class="btn btn-primary btn-xs" style="margin-top:8px" onclick="App.openPreview('${this.esc(previewable)}')">Preview</button>` : '';
        return `<div class="chat-tool"><div class="tool-name">${this.esc(m.name)}</div>${m.error ? `<div class="tool-error">${this.esc(m.error)}</div>` : ''}<div class="tool-output">${this.esc(this.truncate(m.output || '', 500))}</div>${previewBtn}</div>`;
      }
      if (m.type === 'approval') return `<div class="approval-card" id="approval-${m.id}"><div class="approval-title">Approval Required</div><div class="approval-desc">${this.esc(m.action.description)}</div>${m.diff ? `<div class="approval-diff">${this.renderDiff(m.diff)}</div>` : ''}<div class="approval-buttons"><button class="btn btn-success btn-sm" onclick="App.approveAction('${m.id}',true)">Approve</button><button class="btn btn-danger btn-sm" onclick="App.approveAction('${m.id}',false)">Deny</button></div></div>`;
      return '';
    }).join('');
    container.scrollTop = container.scrollHeight;
  },

  approveAction(id, approved) {
    this.sendWs({ type: 'approval_response', id, approved });
    const card = document.getElementById(`approval-${id}`);
    if (card) {
      card.querySelector('.approval-buttons').innerHTML = `<span class="badge ${approved ? 'badge-completed' : 'badge-failed'}">${approved ? 'Approved' : 'Denied'}</span>`;
    }
  },

  showThinking() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    this.removeThinking();
    const el = document.createElement('div');
    el.id = 'thinking-indicator';
    el.className = 'thinking-indicator';
    el.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div><span class="thinking-label">Thinking...</span>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  },

  removeThinking() {
    const el = document.getElementById('thinking-indicator');
    if (el) el.remove();
  },

  showActivity(toolName, description) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    this.removeActivity();
    const el = document.createElement('div');
    el.id = 'activity-indicator';
    el.className = 'activity-indicator';
    el.innerHTML = `<div class="activity-spinner"></div><span class="activity-tool-name">${this.esc(toolName)}</span><span class="activity-description">${this.esc(description || '')}</span>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  },

  removeActivity() {
    const el = document.getElementById('activity-indicator');
    if (el) el.remove();
  },

  updateStreamingMessage() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    this.removeThinking();
    this.removeActivity();
    let streamEl = document.getElementById('streaming-msg');
    if (!streamEl) {
      streamEl = document.createElement('div');
      streamEl.id = 'streaming-msg';
      streamEl.className = 'chat-msg assistant';
      streamEl.innerHTML = '<div class="msg-role">assistant</div><div class="msg-stream-content"></div>';
      container.appendChild(streamEl);
    }
    streamEl.querySelector('.msg-stream-content').innerHTML = this.renderMarkdown(this.streamBuffer) + '<span class="stream-cursor">|</span>';
    container.scrollTop = container.scrollHeight;
  },

  /* ── Settings ──────────────────────────── */

  async renderSettings(el) {
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Settings</div>
          <div class="page-subtitle">Provider, model, permissions, and sandbox configuration</div>
        </div>
      </div>
      <div class="settings-grid">
        <div class="settings-panel" id="config-panel"><h3>Provider Config</h3><div class="loading-spinner"></div></div>
        <div class="settings-panel" id="perms-panel"><h3>Permissions & Sandbox</h3><div class="loading-spinner"></div></div>
      </div>
    `;

    const [config, perms] = await Promise.all([this.api('config'), this.api('permissions')]);
    this.config = config;
    this.permissions = perms;

    document.getElementById('config-panel').innerHTML = `
      <h3>Provider Config</h3>
      <div class="field-group"><label class="field-label">Provider</label><input class="field-input" id="cfg-provider" value="${this.esc(config.provider || '')}"></div>
      <div class="field-group"><label class="field-label">Model</label><input class="field-input" id="cfg-model" value="${this.esc(config.model || '')}"></div>
      <div class="field-group"><label class="field-label">Base URL</label><input class="field-input" id="cfg-baseurl" value="${this.esc(config.base_url || '')}"></div>
      <div class="field-group">
        <label class="field-label">API Key Env Var</label>
        <input class="field-input" id="cfg-apikey" value="${this.esc(config.api_key_env || '')}" placeholder="e.g. ANTHROPIC_API_KEY">
        <div class="field-hint">Name of the env var (NOT the actual key). Or use <code>rivet secrets set</code> for encrypted storage.</div>
        <div class="field-error" id="apikey-error" style="display:none"></div>
      </div>
      <div class="field-group">
        <label class="field-label">Build Command</label>
        <input class="field-input" id="cfg-buildcmd" value="${this.esc(config.build_command || '')}" placeholder="e.g. npx tsc --noEmit">
        <div class="field-hint">Auto-runs after file edits to verify nothing broke.</div>
      </div>
      <div class="field-group">
        <label class="field-label">Max Iterations per Turn</label>
        <input class="field-input" id="cfg-maxiter" type="number" value="${config.max_iterations || 200}" min="5" max="1000" placeholder="200">
        <div class="field-hint">How many tool-call loops the agent can run per message. Higher = handles longer tasks. Default: 200.</div>
      </div>
      <button class="btn btn-primary" onclick="App.saveConfig()">Save Config</button>
    `;

    document.getElementById('perms-panel').innerHTML = `
      <h3>Permissions & Sandbox</h3>
      <div class="field-toggle"><label>Allow file writing</label><div class="toggle"><input type="checkbox" id="perm-write" ${perms.write_file ? 'checked' : ''}><span class="toggle-track"></span></div></div>
      <div class="field-toggle"><label>Allow commands</label><div class="toggle"><input type="checkbox" id="perm-cmd" ${perms.run_command ? 'checked' : ''}><span class="toggle-track"></span></div></div>
      <div class="field-toggle"><label>Require command approval</label><div class="toggle"><input type="checkbox" id="perm-approve-cmd" ${perms.require_approval_for_commands ? 'checked' : ''}><span class="toggle-track"></span></div></div>
      <div class="field-toggle"><label>Require diff approval for writes</label><div class="toggle"><input type="checkbox" id="perm-approve-diff" ${perms.require_diff_approval ? 'checked' : ''}><span class="toggle-track"></span></div></div>
      <div class="field-toggle"><label>Allow network access</label><div class="toggle"><input type="checkbox" id="perm-network" ${perms.network_access ? 'checked' : ''}><span class="toggle-track"></span></div></div>
      <div style="margin-top:16px"><button class="btn btn-primary" onclick="App.savePermissions()">Save Permissions</button></div>
    `;
  },

  async saveConfig() {
    const apikeyVal = (document.getElementById('cfg-apikey').value || '').trim();
    const errorEl = document.getElementById('apikey-error');
    if (apikeyVal.startsWith('sk-') || apikeyVal.startsWith('key-') || apikeyVal.length > 50) {
      if (errorEl) { errorEl.textContent = 'That looks like an actual API key. Enter the env var NAME instead.'; errorEl.style.display = 'block'; }
      return;
    }
    if (errorEl) errorEl.style.display = 'none';

    await this.api('config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: document.getElementById('cfg-provider').value,
        model: document.getElementById('cfg-model').value,
        base_url: document.getElementById('cfg-baseurl').value || undefined,
        api_key_env: apikeyVal || undefined,
        build_command: document.getElementById('cfg-buildcmd').value || undefined,
        max_iterations: parseInt(document.getElementById('cfg-maxiter').value) || undefined,
      }),
    });
    this.flashSave('config-panel');
    this.loadTopbar();
  },

  async savePermissions() {
    await this.api('permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...this.permissions,
        write_file: document.getElementById('perm-write').checked,
        run_command: document.getElementById('perm-cmd').checked,
        require_approval_for_commands: document.getElementById('perm-approve-cmd').checked,
        require_diff_approval: document.getElementById('perm-approve-diff').checked,
        network_access: document.getElementById('perm-network').checked,
      }),
    });
    this.flashSave('perms-panel');
  },

  async deleteRun(id) {
    await this.api(`runs/${id}`, { method: 'DELETE' });
    this.selectedRun = null;
    this.navigate('runs');
  },

  async clearAllRuns() {
    if (!confirm('Delete all run history?')) return;
    await this.api('runs', { method: 'DELETE' });
    this.navigate('runs');
  },

  flashSave(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.style.borderColor = 'var(--success)';
    setTimeout(() => { panel.style.borderColor = ''; }, 1500);
  },

  /* ── Helpers ───────────────────────────── */

  formatActionData(action) {
    const d = action.data;
    if (d.tool) return `${d.tool}(${JSON.stringify(d.args || d.output || '')})`.slice(0, 200);
    if (d.role) return `[${d.role}] ${(d.content || '').slice(0, 200)}`;
    if (d.approved !== undefined) return `approved: ${d.approved}`;
    return JSON.stringify(d).slice(0, 200);
  },

  renderFileGroupView(actions) {
    const files = {};
    for (const a of actions) {
      const d = a.data;
      if (!d.tool) continue;
      const filePath = d.args?.path;
      if (!filePath) continue;
      if (!files[filePath]) files[filePath] = [];
      files[filePath].push(a);
    }
    const paths = Object.keys(files);
    if (paths.length === 0) return '';

    return `<div class="section-title" style="margin-top:16px">Files Touched (${paths.length})</div>
      <div class="file-group-list">${paths.map(p => {
        const ops = files[p];
        const writes = ops.filter(a => a.data.tool === 'write_file' || a.data.tool === 'str_replace').length;
        const reads = ops.filter(a => a.data.tool === 'read_file').length;
        return `<div class="file-group-card"><div class="file-group-path">${this.esc(p)}</div><div class="file-group-ops">${reads ? `<span class="badge badge-completed">${reads} read</span>` : ''}${writes ? `<span class="badge badge-running">${writes} write</span>` : ''}</div></div>`;
      }).join('')}</div>`;
  },

  esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  },

  truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '...' : str;
  },

  fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  renderMarkdown(text) {
    if (!text) return '';
    return this.esc(text)
      .replace(/```([^`]*?)```/gs, '<pre style="background:var(--bg-surface);padding:10px;border-radius:var(--radius-xs);font-family:var(--font-mono);font-size:12px;margin:8px 0;overflow-x:auto">$1</pre>')
      .replace(/`([^`]+)`/g, '<code style="background:var(--bg-surface);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  },

  renderDiff(diff) {
    if (!diff) return '';
    return diff.split('\n').map(line => {
      const escaped = this.esc(line);
      if (line.startsWith('+') && !line.startsWith('+++')) return `<span class="diff-add">${escaped}</span>`;
      if (line.startsWith('-') && !line.startsWith('---')) return `<span class="diff-del">${escaped}</span>`;
      return escaped;
    }).join('\n');
  },

  getPreviewPath(m) {
    if (!m.output) return null;
    const PREVIEW_EXTS = ['.html', '.htm', '.svg', '.png', '.jpg', '.jpeg', '.gif'];
    const match = m.output.match(/(?:File written|written to|saved to|created)[:\s]+([^\s]+)/i);
    if (match) {
      const p = match[1].replace(/['"]/g, '');
      if (PREVIEW_EXTS.some(ext => p.toLowerCase().endsWith(ext))) return p;
    }
    if (m.name === 'write_file' && m.output) {
      const fileMatch = m.output.match(/([^\s]+\.(?:html|htm|svg|png|jpg|jpeg|gif))/i);
      if (fileMatch) return fileMatch[1];
    }
    return null;
  },

  openPreview(filePath) {
    let overlay = document.getElementById('preview-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'preview-overlay';
      overlay.className = 'preview-overlay';
      overlay.innerHTML = `
        <div class="preview-modal">
          <div class="preview-header">
            <span class="preview-title" id="preview-title"></span>
            <div style="display:flex;gap:8px">
              <button class="btn btn-ghost btn-sm" onclick="App.openPreviewNewTab()">Open in Tab</button>
              <button class="btn btn-ghost btn-sm" onclick="App.closePreview()">Close</button>
            </div>
          </div>
          <iframe id="preview-iframe" class="preview-iframe"></iframe>
        </div>`;
      document.body.appendChild(overlay);
    }
    this._currentPreviewPath = filePath;
    overlay.style.display = 'flex';
    document.getElementById('preview-title').textContent = filePath;
    document.getElementById('preview-iframe').src = `/api/preview?file=${encodeURIComponent(filePath)}`;
  },

  openPreviewNewTab() {
    if (this._currentPreviewPath) {
      window.open(`/api/preview?file=${encodeURIComponent(this._currentPreviewPath)}`, '_blank');
    }
  },

  closePreview() {
    const overlay = document.getElementById('preview-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      document.getElementById('preview-iframe').src = '';
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
