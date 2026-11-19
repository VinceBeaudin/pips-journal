# Pips Journal v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Vider" button, 5 stat highlights, simplified notes, and larger design across the app.

**Architecture:** JS vanilla, no framework. All changes go in 3 files: `js/storage.js` (data), `js/app.js` (dev), and `pips-bundle.html` (production bundle with inline CSS+JS). CSS lives in `css/styles.css` for dev and inline `<style>` in the bundle.

**Tech Stack:** Vanilla JS, localStorage, CSS, GitHub Pages deployment.

**IMPORTANT:** Every change to `js/app.js` or `js/storage.js` must be duplicated in `pips-bundle.html`. The bundle is a self-contained copy of all code. After every task, both the module files AND the bundle must be updated.

---

### Task 1: Add `clearTrades` to storage

**Files:**
- Modify: `js/storage.js`
- Modify: `pips-bundle.html` (storage section, after `addTrades` function ~line 746)

- [ ] **Step 1: Add `clearTrades` function to `js/storage.js`**

Add after the `addTrades` function (after line 60):

```js
export function clearTrades(accountId) {
  const state = loadState();
  const account = state.accounts.find(a => a.id === accountId);
  if (!account) return 0;
  const count = account.trades.length;
  account.trades = [];
  saveState(state);
  return count;
}
```

- [ ] **Step 2: Add same function to `pips-bundle.html`**

In the bundle, find the `addTrades` function (search for `function addTrades`). Add the following right after its closing `}`:

```js
function clearTrades(accountId) {
  const state = loadState();
  const account = state.accounts.find(a => a.id === accountId);
  if (!account) return 0;
  const count = account.trades.length;
  account.trades = [];
  saveState(state);
  return count;
}
```

Note: no `export` keyword in the bundle since everything is in one `<script>`.

- [ ] **Step 3: Add import in `js/app.js`**

Change line 2 from:
```js
import { loadState, saveState, createAccount, renameAccount, deleteAccount, addTrades, saveNote } from './storage.js';
```
to:
```js
import { loadState, saveState, createAccount, renameAccount, deleteAccount, addTrades, clearTrades, saveNote } from './storage.js';
```

- [ ] **Step 4: Commit**

```bash
git add js/storage.js js/app.js pips-bundle.html
git commit -m "feat: add clearTrades function to storage"
```

---

### Task 2: Add "Vider" button to account view

**Files:**
- Modify: `js/app.js` (renderAccountView function)
- Modify: `pips-bundle.html` (same renderAccountView section)

- [ ] **Step 1: Add "Vider" button in `js/app.js` renderAccountView**

In `renderAccountView`, find the header-actions div (line ~247-252). Change:

```html
        <button class="btn-primary" id="btn-import-csv">↥ CSV</button>
        <button class="btn-primary" id="btn-import-pdf">↥ PDF</button>
        <button class="btn-secondary" id="btn-rename">Renommer</button>
        <button class="btn-danger" id="btn-delete">Supprimer</button>
```

to:

```html
        <button class="btn-primary" id="btn-import-csv">↥ CSV</button>
        <button class="btn-primary" id="btn-import-pdf">↥ PDF</button>
        <button class="btn-secondary" id="btn-rename">Renommer</button>
        <button class="btn-secondary" id="btn-clear">Vider</button>
        <button class="btn-danger" id="btn-delete">Supprimer</button>
```

- [ ] **Step 2: Add event listener in `js/app.js`**

In `renderAccountView`, find the event bindings block (line ~321-327). Add after the `btn-delete` listener:

```js
  $('btn-clear').addEventListener('click', () => {
    if (!confirm(`Vider tous les trades de "${account.name}" ? Cette action est irréversible.`)) return;
    const count = clearTrades(account.id);
    toast(`${count} trade${count !== 1 ? 's' : ''} supprimé${count !== 1 ? 's' : ''}.`);
    navigate(account.id);
  });
```

- [ ] **Step 3: Duplicate both changes in `pips-bundle.html`**

Apply the same two changes (button HTML + event listener) in the bundle's `renderAccountView` function.

- [ ] **Step 4: Update print media query in `css/styles.css`**

In the `@media print` section, add `#btn-clear` to the hidden elements list:

```css
  #btn-import-csv,
  #btn-import-pdf,
  #btn-clear,
  #btn-rename,
  #btn-delete,
```

- [ ] **Step 5: Update print media query in `pips-bundle.html`**

Same change in the bundle's `@media print` block.

- [ ] **Step 6: Commit**

```bash
git add js/app.js pips-bundle.html css/styles.css
git commit -m "feat: bouton Vider pour supprimer les trades d'un compte"
```

---

### Task 3: Add `computeStats` function and 5 stat highlights

**Files:**
- Modify: `js/app.js`
- Modify: `pips-bundle.html`

- [ ] **Step 1: Add `computeStats` function in `js/app.js`**

Add after the `posClass` function (after line 54):

```js
function computeStats(trades) {
  const totalPipsVal = totalPips(trades);
  const count = trades.length;
  if (!count) return { totalPips: 0, winRate: null, winCount: 0, lossCount: 0, rrRatio: null, bestTrade: null, worstTrade: null };

  const wins = trades.filter(t => t.pips >= 0);
  const losses = trades.filter(t => t.pips < 0);
  const winRate = Math.round((wins.length / count) * 100);

  let rrRatio = null;
  if (wins.length > 0 && losses.length > 0) {
    const avgWin = wins.reduce((s, t) => s + t.pips, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((s, t) => s + t.pips, 0) / losses.length);
    rrRatio = avgLoss > 0 ? avgWin / avgLoss : null;
  }

  const sorted = [...trades].sort((a, b) => b.pips - a.pips);
  const bestTrade = sorted[0];
  const worstTrade = sorted[sorted.length - 1];

  return { totalPips: totalPipsVal, winRate, winCount: wins.length, lossCount: losses.length, rrRatio, bestTrade, worstTrade };
}
```

- [ ] **Step 2: Create stats HTML helper in `js/app.js`**

Add right after `computeStats`:

```js
function renderStatsHTML(trades) {
  const s = computeStats(trades);
  const count = trades.length;
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total cumulé</div>
        <div class="stat-value ${posClass(s.totalPips)}">${count ? fmtPips(s.totalPips) : '—'}</div>
        <div class="stat-sub">pips nets</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Win rate</div>
        <div class="stat-value ${s.winRate !== null && s.winRate >= 50 ? 'pos' : s.winRate !== null ? 'neg' : 'neutral'}">${s.winRate !== null ? s.winRate + '%' : '—'}</div>
        <div class="stat-sub">${count ? s.winCount + ' gagnant' + (s.winCount !== 1 ? 's' : '') + ' / ' + count + ' trade' + (count !== 1 ? 's' : '') : ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ratio R/R</div>
        <div class="stat-value ${s.rrRatio !== null && s.rrRatio >= 1 ? 'pos' : s.rrRatio !== null ? 'neg' : 'neutral'}">${s.rrRatio !== null ? '1:' + s.rrRatio.toFixed(1) : '—'}</div>
        <div class="stat-sub">gain moy / perte moy</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Meilleur trade</div>
        <div class="stat-value pos">${s.bestTrade ? fmtPips(s.bestTrade.pips) : '—'}</div>
        <div class="stat-sub">${s.bestTrade ? fmtDate(s.bestTrade.closeTime) : ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pire trade</div>
        <div class="stat-value neg">${s.worstTrade ? fmtPips(s.worstTrade.pips) : '—'}</div>
        <div class="stat-sub">${s.worstTrade ? fmtDate(s.worstTrade.closeTime) : ''}</div>
      </div>
    </div>`;
}
```

- [ ] **Step 3: Replace stats in `renderAccountView`**

In `renderAccountView`, find and replace the entire `<div class="stats-grid">...</div>` block (the 3 stat cards, lines ~254-270) with:

```js
    ${renderStatsHTML(account.trades)}
```

Also remove the now-unused local variables `total`, `mth`, and `count` from the top of the function. Keep `count` only for the account-meta line and lastDate. Simplified top:

```js
function renderAccountView(account, main) {
  const count = account.trades.length;

  const lastDate = count
    ? fmtDate([...account.trades].sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime))[0].closeTime)
    : null;
```

- [ ] **Step 4: Replace stats in `renderDashboard`**

In `renderDashboard`, find the 3-card stats-grid block (lines ~140-156) and replace with:

```js
    ${renderStatsHTML(allTrades)}
```

Remove the now-unused `total` and `mth` variables from the top of the function. Keep `count` and `sorted`.

- [ ] **Step 5: Replace stats in `renderTotalView`**

In `renderTotalView`, find the 3-card stats-grid block (lines ~401-416) and replace with:

```js
    ${renderStatsHTML(allTrades)}
```

Remove the now-unused `total`, `mth` variables. Keep `count` and `sorted`.

- [ ] **Step 6: Duplicate all changes in `pips-bundle.html`**

Add `computeStats` and `renderStatsHTML` functions in the bundle's JS section. Apply the same replacements in the bundle's `renderAccountView`, `renderDashboard`, and `renderTotalView`.

- [ ] **Step 7: Update CSS grid for 5 columns**

In `css/styles.css`, change `.stats-grid` (line 237):

```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}
```

Add responsive breakpoint at the end of the file (before `@media print`):

```css
@media (max-width: 1100px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
```

Apply same CSS changes in the bundle's `<style>` block.

- [ ] **Step 8: Commit**

```bash
git add js/app.js pips-bundle.html css/styles.css
git commit -m "feat: 5 stat highlights — win rate, ratio R/R, meilleur/pire trade"
```

---

### Task 4: Simplify notes (remove emotion, auto-save)

**Files:**
- Modify: `js/app.js` (renderTradeList, event delegation)
- Modify: `pips-bundle.html` (same sections)
- Modify: `css/styles.css` (remove emotion-select styles, simplify note-area)

- [ ] **Step 1: Simplify trade row HTML in `js/app.js` renderTradeList**

Replace the entire `list.innerHTML = sorted.map(t => { ... }).join('');` block with:

```js
  list.innerHTML = sorted.map(t => {
    const isPos = t.pips >= 0;
    const dirClass = (t.direction === 'Acheter' || t.direction === 'Buy') ? 'buy' : 'sell';
    const noteText = t.note?.text || (t.note?.emotion ? t.note.emotion : '');
    const hasNote = !!noteText;

    return `<div class="trade-row" data-key="${esc(t.key)}">
      <div class="trade-main">
        <span class="direction-badge ${dirClass}">${esc(t.direction)}</span>
        <span class="trade-date">${fmtDate(t.closeTime)}</span>
        <span class="trade-qty">${esc(t.quantity)}</span>
        <span class="trade-pips ${isPos ? 'pos' : 'neg'}">${fmtPips(t.pips)} pips</span>
        <button class="btn-note ${hasNote ? 'has-note' : ''}" data-note-key="${esc(t.key)}">Note</button>
      </div>
      <div class="note-area" id="note-${esc(t.key)}">
        <div class="note-inner">
          <textarea class="note-textarea" placeholder="Ce que je retiens de ce trade..." data-text-key="${esc(t.key)}" data-account-id="${esc(account.id)}" maxlength="1000">${esc(noteText)}</textarea>
        </div>
      </div>
    </div>`;
  }).join('');
```

Key changes:
- Removed `<select>` emotion dropdown
- Removed "Enregistrer" button
- Added `data-account-id` on textarea for auto-save
- Note button always shows "Note" text
- `noteText` merges old `emotion` and new `text` for backward compat

- [ ] **Step 2: Replace event delegation for notes in `js/app.js`**

Find the delegated listener on `$('main')` (line ~592). Replace the `saveBtn` block (the `const saveBtn = e.target.closest('[data-save-key]')` section) with nothing — remove it entirely.

The `noteBtn` toggle block stays as-is.

- [ ] **Step 3: Add blur auto-save listener in `js/app.js`**

Add a new delegated listener right after the existing `$('main').addEventListener('click', ...)` block:

```js
$('main').addEventListener('focusout', e => {
  const textarea = e.target.closest('.note-textarea');
  if (!textarea) return;
  const key = textarea.dataset.textKey;
  const accId = textarea.dataset.accountId;
  const text = textarea.value.trim();
  saveNote(accId, key, { text });
});
```

- [ ] **Step 4: Duplicate all changes in `pips-bundle.html`**

Apply the same 3 changes (trade row HTML, remove save button handler, add focusout listener) in the bundle.

- [ ] **Step 5: Simplify CSS in `css/styles.css`**

Remove the `.emotion-select` rule block (lines 375-384) and the `.note-save-btn` rule block (lines 404-416).

Simplify `.note-row` to just:

```css
.note-inner {
  padding: 14px 22px 16px;
  background: #f7fafc;
  border-top: 1px solid var(--line);
}
```

Remove the `.note-row` rule (line 373).

Apply same CSS changes in the bundle.

- [ ] **Step 6: Commit**

```bash
git add js/app.js pips-bundle.html css/styles.css
git commit -m "feat: notes simplifiées — textarea seul avec auto-save au blur"
```

---

### Task 5: Design agrandi — CSS sizing update

**Files:**
- Modify: `css/styles.css`
- Modify: `pips-bundle.html` (inline `<style>` block)

- [ ] **Step 1: Update font sizes and spacing in `css/styles.css`**

Apply these changes:

**Sidebar:**
```css
.sidebar-label {
  font-size: 12px;  /* was 11px */
}

.account-btn .acc-name { font-size: 15px; font-weight: 600; }  /* was 14px */
.account-btn .acc-pips { font-size: 13px; }  /* was 12px */

.btn-add-account {
  padding: 11px;  /* was 9px */
  font-size: 14px;  /* was 13px */
}

.total-label { font-size: 12px; /* was 11px */ }
.total-sub { font-size: 12px; /* was 11px */ }
```

**Account header:**
```css
.account-meta { font-size: 14px; color: var(--muted); }  /* was 13px */
```

**Buttons:**
```css
.btn-primary {
  border-radius: 10px; padding: 11px 22px;  /* was 10px 18px */
  font-size: 15px;  /* was 14px */
}

.btn-secondary {
  border-radius: 10px; padding: 11px 22px;  /* was 10px 18px */
  font-size: 15px;  /* was 14px */
}

.btn-danger {
  font-size: 15px; padding: 11px 6px;  /* was 14px, 10px 4px */
}
```

**Stat cards:**
```css
.stat-card {
  padding: 24px 26px;  /* was 20px 22px */
}

.stat-label { font-size: 12px; /* was 11px */ }
.stat-value { font-size: 36px; /* was 34px */ }
.stat-sub { font-size: 13px; /* was 12px */ margin-top: 6px; /* was 4px */ }
```

**Chart card:**
```css
.chart-card {
  padding: 24px 26px;  /* was 20px 22px */
  margin-bottom: 28px;  /* was 24px */
}

.chart-card-title { font-size: 13px; /* was 12px */ }
.chart-dates { font-size: 12px; /* was 11px */ }
```

**Trade list:**
```css
.trades-panel-header {
  padding: 18px 24px;  /* was 16px 22px */
}

.trades-panel-title { font-size: 15px; /* was 14px */ }

.trade-main {
  gap: 16px;  /* was 14px */
  padding: 16px 24px;  /* was 14px 22px */
}

.direction-badge {
  font-size: 12px;  /* was 11px */
  padding: 5px 10px;  /* was 4px 9px */
}

.trade-date { font-size: 14px; /* was 13px */ }
.trade-qty  { font-size: 13px; /* was 12px */ }

.trade-pips {
  font-size: 16px;  /* was 15px */
}

.btn-note {
  font-size: 13px;  /* was 12px */
  padding: 6px 12px;  /* was 5px 10px */
}
```

**Note area:**
```css
.note-inner {
  padding: 16px 24px 18px;  /* was 14px 22px 16px */
}

.note-textarea {
  font-size: 14px;  /* was 13px */
  padding: 10px 14px;  /* was 8px 12px */
}
```

**Dashboard:**
```css
.dash-section-label {
  font-size: 13px;  /* was 12px */
  margin: 0 0 14px;  /* was 0 0 12px */
}

.account-card {
  padding: 24px 26px;  /* was 20px 22px */
}

.account-card-name {
  font-size: 13px;  /* was 12px */
  margin-bottom: 12px;  /* was 10px */
}

.account-card-pips {
  font-size: 30px;  /* was 28px */
}

.account-card-sub { font-size: 13px; /* was 12px */ }
```

**Monthly breakdown:**
```css
.monthly-row {
  gap: 16px;  /* was 14px */
  padding: 14px 24px;  /* was 12px 22px */
  font-size: 15px;  /* was 14px */
}

.monthly-count { font-size: 13px; /* was 12px */ }
.monthly-pips { font-size: 16px; /* was 15px */ }
```

**Filter tabs:**
```css
.filter-tab {
  font-size: 14px;  /* was 13px */
  padding: 7px 16px;  /* was 6px 14px */
}
```

**Sidebar backup:**
```css
.sidebar-backup button,
.sidebar-backup label {
  font-size: 13px;  /* was 12px */
  padding: 8px 6px;  /* was 7px 4px */
}
```

- [ ] **Step 2: Apply identical CSS changes in `pips-bundle.html`**

The bundle has the same CSS in its `<style>` block. Apply all the same size changes.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css pips-bundle.html
git commit -m "design: polices et espacements agrandis pour meilleure lisibilité"
```

---

### Task 6: Update print media query and final cleanup

**Files:**
- Modify: `css/styles.css`
- Modify: `pips-bundle.html`

- [ ] **Step 1: Fix print media query in `css/styles.css`**

The current print media query references old IDs (`#btn-import`, `#file-input`). Replace the hide list with:

```css
@media print {
  .sidebar,
  #toast,
  dialog,
  .btn-print,
  #btn-import-csv,
  #btn-import-pdf,
  #btn-clear,
  #btn-rename,
  #btn-delete,
  #btn-add-account,
  #file-input-csv,
  #file-input-pdf,
  .btn-note,
  .note-area { display: none !important; }
```

- [ ] **Step 2: Same fix in `pips-bundle.html`**

The bundle print query was already updated in Task 2, but verify it includes `#btn-clear`.

- [ ] **Step 3: Push to GitHub Pages**

```bash
git push
```

- [ ] **Step 4: Verify on GitHub Pages**

After ~2 minutes, open https://vincebeaudin.github.io/pips-journal/ and verify:
1. Two import buttons (CSV / PDF) work
2. "Vider" button clears trades with confirmation
3. Five stat cards show correctly (Total, Win rate, R/R, Best, Worst)
4. Notes show textarea only, auto-save on blur
5. All text is visibly larger
