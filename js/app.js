// js/app.js
import { loadState, saveState, createAccount, renameAccount, deleteAccount, addTrades, saveNote } from './storage.js';
import { parseCSV, parsePDFFile } from './csv.js';
import { renderChart } from './chart.js';

// ── State ──────────────────────────────────────────────
let selectedId = null; // account id | 'total' | 'dashboard'
let currentFilter = 'all'; // 'week' | 'month' | '3months' | 'all'

// ── DOM helpers ───────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
);

// ── Toast ─────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

// ── Formatting ────────────────────────────────────────
function fmtPips(v) {
  const n = Math.abs(v) < 1e-8 ? 0 : v;
  const s = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 1 }).format(n);
  return (n > 1e-8 ? '+' : '') + s;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function totalPips(trades) {
  return trades.reduce((s, t) => s + t.pips, 0);
}

function monthPips(trades) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return trades
    .filter(t => new Date(t.closeTime) >= start)
    .reduce((s, t) => s + t.pips, 0);
}

function posClass(v) {
  return v > 1e-8 ? 'pos' : v < -1e-8 ? 'neg' : 'neutral';
}

function filterTrades(trades, filter) {
  if (filter === 'all') return trades;
  const now = new Date();
  let start;
  if (filter === 'week')    start = new Date(now - 7 * 86400000);
  if (filter === 'month')   start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (filter === '3months') start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  return trades.filter(t => new Date(t.closeTime) >= start);
}

function getMonthlyBreakdown(trades) {
  const map = {};
  for (const t of trades) {
    const d = new Date(t.closeTime);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { pips: 0, count: 0, label: new Intl.DateTimeFormat('fr-CA', { month: 'short', year: 'numeric' }).format(d) };
    map[key].pips += t.pips;
    map[key].count++;
  }
  return Object.entries(map)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, v]) => v);
}

// ── Sidebar render ────────────────────────────────────
function renderSidebar() {
  const state = loadState();
  const list = $('account-list');

  list.innerHTML = state.accounts.map(acc => {
    const total = totalPips(acc.trades);
    const cls = selectedId === acc.id ? 'account-btn active' : 'account-btn';
    const pipStr = acc.trades.length ? fmtPips(total) + ' pips' : '— pips';
    return `<button class="${cls}" data-id="${esc(acc.id)}">
      <span class="acc-name">${esc(acc.name)}</span>
      <span class="acc-pips">${esc(pipStr)}</span>
    </button>`;
  }).join('');

  // Total global
  const allTrades = state.accounts.flatMap(a => a.trades);
  const grandTotal = totalPips(allTrades);
  $('sidebar-total-value').textContent = allTrades.length ? fmtPips(grandTotal) : '—';
  $('btn-total').className = selectedId === 'total' ? 'total-btn active' : 'total-btn';
}

// ── Navigate ──────────────────────────────────────────
function navigate(id) {
  selectedId = id;
  renderSidebar();
  renderMain();
}

// ── Dashboard ─────────────────────────────────────────
function renderDashboard(state, main) {
  if (!state.accounts.length) {
    main.innerHTML = `
      <div class="empty-state">
        <div class="icon">◫</div>
        <strong>Crée ton premier compte pour commencer.</strong>
        <p>Clique sur "+ Nouveau compte" dans la barre latérale.</p>
      </div>`;
    return;
  }

  const allTrades = state.accounts.flatMap(a => a.trades);
  const total = totalPips(allTrades);
  const mth   = monthPips(allTrades);
  const count = allTrades.length;
  const sorted = [...allTrades].sort((a, b) => new Date(a.closeTime) - new Date(b.closeTime));

  const recentTrades = state.accounts
    .flatMap(a => a.trades.map(t => ({ ...t, accountName: a.name })))
    .sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime))
    .slice(0, 8);

  main.innerHTML = `
    <div class="account-header">
      <div>
        <h1>Tableau de bord</h1>
        <div class="account-meta">${state.accounts.length} compte${state.accounts.length !== 1 ? 's' : ''} · ${count} trade${count !== 1 ? 's' : ''}</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total cumulé</div>
        <div class="stat-value ${posClass(total)}">${count ? fmtPips(total) : '—'}</div>
        <div class="stat-sub">pips nets (tous comptes)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ce mois-ci</div>
        <div class="stat-value ${posClass(mth)}">${count ? fmtPips(mth) : '—'}</div>
        <div class="stat-sub">pips nets</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Trades</div>
        <div class="stat-value neutral">${count}</div>
        <div class="stat-sub">positions clôturées</div>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-card-header">
        <span class="chart-card-title">Courbe cumulative — tous comptes</span>
        <span class="chart-dates" id="chart-dates"></span>
      </div>
      <div class="chart-container" id="chart-container"></div>
    </div>

    <p class="dash-section-label">Mes comptes</p>
    <div class="accounts-grid">
      ${state.accounts.map(acc => {
        const t = totalPips(acc.trades);
        const m = monthPips(acc.trades);
        return `<div class="account-card" data-nav="${esc(acc.id)}">
          <div class="account-card-name">${esc(acc.name)}</div>
          <div class="account-card-pips ${posClass(t)}">${acc.trades.length ? fmtPips(t) : '—'}</div>
          <div class="account-card-sub">${acc.trades.length
            ? fmtPips(m) + ' ce mois · ' + acc.trades.length + ' trade' + (acc.trades.length !== 1 ? 's' : '')
            : 'Aucun trade'}</div>
        </div>`;
      }).join('')}
    </div>

    ${recentTrades.length ? `
    <p class="dash-section-label">Trades récents</p>
    <div class="trades-panel">
      ${recentTrades.map(t => {
        const dirClass = (t.direction === 'Acheter' || t.direction === 'Buy') ? 'buy' : 'sell';
        return `<div class="trade-main" style="border-bottom:1px solid var(--line);">
          <span class="direction-badge ${dirClass}">${esc(t.direction)}</span>
          <span class="trade-date" style="color:var(--navy);font-weight:500;min-width:100px;">${esc(t.accountName)}</span>
          <span class="trade-date">${fmtDate(t.closeTime)}</span>
          <span class="trade-pips ${t.pips >= 0 ? 'pos' : 'neg'}">${fmtPips(t.pips)} pips</span>
        </div>`;
      }).join('')}
    </div>` : ''}
  `;

  renderChart($('chart-container'), allTrades);
  if (sorted.length) {
    $('chart-dates').textContent = fmtDate(sorted[0].closeTime) + ' — ' + fmtDate(sorted.at(-1).closeTime);
  }

  main.querySelectorAll('[data-nav]').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.nav));
  });
}

// ── Main render (dispatcher) ──────────────────────────
function renderMain() {
  const state = loadState();
  const main = $('main');

  if (selectedId === 'total') {
    renderTotalView(state, main);
    return;
  }

  if (!selectedId || selectedId === 'dashboard') {
    renderDashboard(state, main);
    return;
  }

  const account = state.accounts.find(a => a.id === selectedId);
  if (!account) {
    selectedId = 'dashboard';
    renderDashboard(state, main);
    return;
  }

  renderAccountView(account, main);
}

// ── Account view ──────────────────────────────────────
function renderAccountView(account, main) {
  const total = totalPips(account.trades);
  const mth   = monthPips(account.trades);
  const count = account.trades.length;

  const lastDate = count
    ? fmtDate([...account.trades].sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime))[0].closeTime)
    : null;

  main.innerHTML = `
    <div class="account-header">
      <div>
        <h1>${esc(account.name)}</h1>
        <div class="account-meta">${count} trade${count !== 1 ? 's' : ''}${lastDate ? ' · mis à jour le ' + esc(lastDate) : ''}</div>
      </div>
      <div class="header-actions">
        <button class="btn-primary" id="btn-import-csv">↥ CSV</button>
        <button class="btn-primary" id="btn-import-pdf">↥ PDF</button>
        <button class="btn-secondary" id="btn-rename">Renommer</button>
        <button class="btn-danger" id="btn-delete">Supprimer</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total cumulé</div>
        <div class="stat-value ${posClass(total)}">${count ? fmtPips(total) : '—'}</div>
        <div class="stat-sub">pips nets</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ce mois-ci</div>
        <div class="stat-value ${posClass(mth)}">${count ? fmtPips(mth) : '—'}</div>
        <div class="stat-sub">pips nets</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Nb de trades</div>
        <div class="stat-value neutral">${count}</div>
        <div class="stat-sub">positions clôturées</div>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-card-header">
        <span class="chart-card-title">Courbe cumulative</span>
        <span class="chart-dates" id="chart-dates"></span>
      </div>
      <div class="chart-container" id="chart-container"></div>
    </div>

    ${account.trades.length ? `
    <div class="chart-card">
      <div class="chart-card-header">
        <span class="chart-card-title">Répartition mensuelle</span>
      </div>
      <div>
        ${getMonthlyBreakdown(account.trades).map(m => `
          <div class="monthly-row">
            <span class="monthly-label">${esc(m.label)}</span>
            <span class="monthly-count">${m.count} trade${m.count !== 1 ? 's' : ''}</span>
            <span class="monthly-pips ${posClass(m.pips)}">${fmtPips(m.pips)} pips</span>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="trades-panel">
      <div class="trades-panel-header">
        <span class="trades-panel-title">Trades</span>
        <div class="filter-tabs">
          <button class="filter-tab ${currentFilter === 'week'    ? 'active' : ''}" data-filter="week"    data-account="${esc(account.id)}">7 jours</button>
          <button class="filter-tab ${currentFilter === 'month'   ? 'active' : ''}" data-filter="month"   data-account="${esc(account.id)}">Mois</button>
          <button class="filter-tab ${currentFilter === '3months' ? 'active' : ''}" data-filter="3months" data-account="${esc(account.id)}">3 mois</button>
          <button class="filter-tab ${currentFilter === 'all'     ? 'active' : ''}" data-filter="all"     data-account="${esc(account.id)}">Tout</button>
        </div>
      </div>
      <div id="trade-list"></div>
    </div>

    <input type="file" id="file-input-csv" accept=".csv,text/csv" hidden>
    <input type="file" id="file-input-pdf" accept=".pdf,application/pdf" hidden>
  `;

  renderChart($('chart-container'), account.trades);
  if (account.trades.length) {
    const sorted = [...account.trades].sort((a, b) => new Date(a.closeTime) - new Date(b.closeTime));
    $('chart-dates').textContent = fmtDate(sorted[0].closeTime) + ' — ' + fmtDate(sorted.at(-1).closeTime);
  }

  renderTradeList(account);

  // Event bindings
  $('btn-import-csv').addEventListener('click', () => $('file-input-csv').click());
  $('file-input-csv').addEventListener('change', e => handleImport(e, account.id));
  $('btn-import-pdf').addEventListener('click', () => $('file-input-pdf').click());
  $('file-input-pdf').addEventListener('change', e => handleImport(e, account.id));
  $('btn-rename').addEventListener('click', () => openRenameDialog(account));
  $('btn-delete').addEventListener('click', () => handleDelete(account));
}

// ── Trade list ────────────────────────────────────────
function renderTradeList(account) {
  const list = $('trade-list');
  const filtered = filterTrades(account.trades, currentFilter);
  const sorted = [...filtered].sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime));

  if (!account.trades.length) {
    list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted);font-size:12px;">
      Aucun trade. Importe un fichier pour commencer.
    </div>`;
    return;
  }

  if (!sorted.length) {
    list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted);font-size:12px;">
      Aucun trade sur cette période.
    </div>`;
    return;
  }

  list.innerHTML = sorted.map(t => {
    const isPos = t.pips >= 0;
    const dirClass = (t.direction === 'Acheter' || t.direction === 'Buy') ? 'buy' : 'sell';
    const hasNote = t.note && (t.note.emotion || t.note.text);
    const noteLabel = hasNote ? (t.note.emotion ? t.note.emotion : '📝') : '+ Note';

    return `<div class="trade-row" data-key="${esc(t.key)}">
      <div class="trade-main">
        <span class="direction-badge ${dirClass}">${esc(t.direction)}</span>
        <span class="trade-date">${fmtDate(t.closeTime)}</span>
        <span class="trade-qty">${esc(t.quantity)}</span>
        <span class="trade-pips ${isPos ? 'pos' : 'neg'}">${fmtPips(t.pips)} pips</span>
        <button class="btn-note ${hasNote ? 'has-note' : ''}" data-note-key="${esc(t.key)}">${esc(noteLabel)}</button>
      </div>
      <div class="note-area" id="note-${esc(t.key)}">
        <div class="note-inner">
          <div class="note-row">
            <select class="emotion-select" data-emotion-key="${esc(t.key)}">
              <option value="">Émotion...</option>
              <option ${t.note?.emotion === 'Calme' ? 'selected' : ''}>Calme</option>
              <option ${t.note?.emotion === 'Confiant' ? 'selected' : ''}>Confiant</option>
              <option ${t.note?.emotion === 'Impatient' ? 'selected' : ''}>Impatient</option>
              <option ${t.note?.emotion === 'Stressé' ? 'selected' : ''}>Stressé</option>
              <option ${t.note?.emotion === 'Frustré' ? 'selected' : ''}>Frustré</option>
            </select>
            <textarea class="note-textarea" placeholder="Ce que je retiens de ce trade…" data-text-key="${esc(t.key)}" maxlength="1000">${esc(t.note?.text ?? '')}</textarea>
          </div>
          <button class="note-save-btn" data-save-key="${esc(t.key)}" data-account-id="${esc(account.id)}">Enregistrer</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Total view ────────────────────────────────────────
function renderTotalView(state, main) {
  const allTrades = state.accounts.flatMap(a => a.trades);
  const total = totalPips(allTrades);
  const mth = monthPips(allTrades);
  const count = allTrades.length;

  const sorted = [...allTrades].sort((a, b) => new Date(a.closeTime) - new Date(b.closeTime));

  main.innerHTML = `
    <div class="account-header">
      <div>
        <h1>Total global</h1>
        <div class="account-meta">${state.accounts.length} compte${state.accounts.length !== 1 ? 's' : ''} · ${count} trade${count !== 1 ? 's' : ''}</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total cumulé</div>
        <div class="stat-value ${posClass(total)}">${count ? fmtPips(total) : '—'}</div>
        <div class="stat-sub">pips nets (tous comptes)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ce mois-ci</div>
        <div class="stat-value ${posClass(mth)}">${count ? fmtPips(mth) : '—'}</div>
        <div class="stat-sub">pips nets</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Trades</div>
        <div class="stat-value neutral">${count}</div>
        <div class="stat-sub">positions clôturées</div>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-card-header">
        <span class="chart-card-title">Courbe cumulative — tous comptes</span>
        <span class="chart-dates" id="chart-dates"></span>
      </div>
      <div class="chart-container" id="chart-container"></div>
    </div>

    <div class="trades-panel">
      <div class="trades-panel-header">
        <span class="trades-panel-title">Répartition par compte</span>
      </div>
      <div style="padding:4px 0;">
        ${state.accounts.map(acc => {
          const t = totalPips(acc.trades);
          const isPos = t >= 0;
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid var(--line);">
            <span style="font-size:13px;font-weight:600;color:var(--ink);">${esc(acc.name)}</span>
            <span style="font-size:14px;font-weight:700;color:${isPos ? 'var(--green)' : 'var(--red)'};">${acc.trades.length ? fmtPips(t) + ' pips' : '—'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  renderChart($('chart-container'), allTrades);
  if (sorted.length) {
    $('chart-dates').textContent = fmtDate(sorted[0].closeTime) + ' — ' + fmtDate(sorted.at(-1).closeTime);
  }
}

// ── Import (CSV + PDF) ────────────────────────────────
function handleImport(e, accountId) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const finalize = trades => {
    if (!trades.length) { toast('Aucun trade XAUUSD trouvé dans ce fichier.'); return; }
    try {
      const { added, skipped } = addTrades(accountId, trades);
      const msg = `${added} trade${added !== 1 ? 's' : ''} ajouté${added !== 1 ? 's' : ''}${skipped ? `, ${skipped} doublon${skipped !== 1 ? 's' : ''} ignoré${skipped !== 1 ? 's' : ''}` : ''}.`;
      toast(msg);
      navigate(accountId);
    } catch (err) { toast(err.message); }
  };

  if (file.name.toLowerCase().endsWith('.pdf')) {
    parsePDFFile(file).then(finalize).catch(err => {
      console.error('PDF parse error:', err);
      toast('Fichier PDF invalide ou format non reconnu.');
    });
    return;
  }

  const reader = new FileReader();
  reader.onload = ev => {
    let trades;
    try { trades = parseCSV(ev.target.result); }
    catch { toast('Fichier CSV invalide ou format non reconnu.'); return; }
    finalize(trades);
  };
  reader.readAsText(file, 'utf-8');
}

// ── Account CRUD ──────────────────────────────────────
function openAddAccountDialog() {
  const dialog = $('account-dialog');
  $('dialog-title').textContent = 'Nouveau compte';
  $('dialog-input').value = '';
  $('dialog-confirm').textContent = 'Créer';
  $('dialog-confirm').onclick = () => {
    const name = $('dialog-input').value.trim();
    if (!name) return;
    try {
      const acc = createAccount(name);
      dialog.close();
      navigate(acc.id);
      toast('Compte créé.');
    } catch (err) {
      toast(err.message);
    }
  };
  dialog.showModal();
}

function openRenameDialog(account) {
  const dialog = $('account-dialog');
  $('dialog-title').textContent = 'Renommer le compte';
  $('dialog-input').value = account.name;
  $('dialog-confirm').textContent = 'Renommer';
  $('dialog-confirm').onclick = () => {
    const name = $('dialog-input').value.trim();
    if (!name) return;
    try {
      renameAccount(account.id, name);
      dialog.close();
      navigate(account.id);
      toast('Compte renommé.');
    } catch (err) {
      toast(err.message);
    }
  };
  dialog.showModal();
}

function handleDelete(account) {
  if (!confirm(`Supprimer "${account.name}" et tous ses trades ?`)) return;
  try {
    deleteAccount(account.id);
    const state = loadState();
    selectedId = state.accounts.length ? state.accounts[0].id : null;
    renderSidebar();
    renderMain();
    toast('Compte supprimé.');
  } catch (err) {
    toast(err.message);
  }
}

// ── Event listeners ───────────────────────────────────
$('brand-btn').addEventListener('click', () => navigate('dashboard'));
$('btn-add-account').addEventListener('click', openAddAccountDialog);
$('btn-total').addEventListener('click', () => navigate('total'));

$('account-list').addEventListener('click', e => {
  const btn = e.target.closest('[data-id]');
  if (btn) navigate(btn.dataset.id);
});

$('dialog-cancel').addEventListener('click', () => {
  $('account-dialog').close();
});

$('account-dialog').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('dialog-confirm').click();
});

// Single delegated listener for note interactions (trade list)
// ── Backup ────────────────────────────────────────────
function exportBackup() {
  const json = JSON.stringify(loadState(), null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `pips-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.version !== 1 || !Array.isArray(data.accounts)) {
        toast('Fichier de sauvegarde invalide.');
        return;
      }
      saveState(data);
      selectedId = 'dashboard';
      renderSidebar();
      renderMain();
      toast('Sauvegarde restaurée.');
    } catch { toast('Impossible de lire ce fichier.'); }
  };
  reader.readAsText(file, 'utf-8');
}

$('btn-export-backup').addEventListener('click', exportBackup);
$('import-backup-input').addEventListener('change', importBackup);

$('main').addEventListener('click', e => {
  const filterBtn = e.target.closest('[data-filter]');
  if (filterBtn) {
    currentFilter = filterBtn.dataset.filter;
    const acc = loadState().accounts.find(a => a.id === filterBtn.dataset.account);
    if (acc) renderAccountView(acc, $('main'));
    return;
  }

  const noteBtn = e.target.closest('[data-note-key]');
  if (noteBtn) {
    const key = noteBtn.dataset.noteKey;
    const area = document.getElementById('note-' + key);
    if (area) area.classList.toggle('open');
    return;
  }

  const saveBtn = e.target.closest('[data-save-key]');
  if (saveBtn) {
    const key = saveBtn.dataset.saveKey;
    const accId = saveBtn.dataset.accountId;
    const list = $('trade-list');
    if (!list) return;
    const emotion = list.querySelector(`[data-emotion-key="${CSS.escape(key)}"]`)?.value ?? '';
    const text = list.querySelector(`[data-text-key="${CSS.escape(key)}"]`)?.value?.trim() ?? '';
    try {
      saveNote(accId, key, { emotion, text });
      toast('Note enregistrée.');
      renderSidebar();
      const btn = list.querySelector(`[data-note-key="${CSS.escape(key)}"]`);
      if (btn) {
        const hasNote = emotion || text;
        btn.className = `btn-note ${hasNote ? 'has-note' : ''}`;
        btn.textContent = hasNote ? (emotion || '📝') : '+ Note';
      }
    } catch (err) {
      toast(err.message);
    }
  }
});

// ── Init ──────────────────────────────────────────────
(function init() {
  selectedId = 'dashboard';
  renderSidebar();
  renderMain();
})();
