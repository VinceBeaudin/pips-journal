// js/storage.js
const KEY = 'pips-xau-v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { version: 1, accounts: [] };
    const state = JSON.parse(raw);
    if (state.version !== 1 || !Array.isArray(state.accounts)) {
      return { version: 1, accounts: [] };
    }
    return state;
  } catch {
    return { version: 1, accounts: [] };
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function createAccount(name) {
  const state = loadState();
  const account = { id: crypto.randomUUID(), name: name.trim(), trades: [] };
  state.accounts.push(account);
  saveState(state);
  return account;
}

export function renameAccount(id, name) {
  const state = loadState();
  const account = state.accounts.find(a => a.id === id);
  if (!account) return false;
  account.name = name.trim();
  saveState(state);
  return true;
}

export function deleteAccount(id) {
  const state = loadState();
  const before = state.accounts.length;
  state.accounts = state.accounts.filter(a => a.id !== id);
  saveState(state);
  return state.accounts.length < before;
}

export function addTrades(accountId, trades) {
  const state = loadState();
  const account = state.accounts.find(a => a.id === accountId);
  if (!account) return { added: 0, skipped: 0 };
  const existing = new Set(account.trades.map(t => t.key));
  const newTrades = trades.filter(t => !existing.has(t.key));
  account.trades.push(...newTrades);
  saveState(state);
  return { added: newTrades.length, skipped: trades.length - newTrades.length };
}

export function saveNote(accountId, tradeKey, note) {
  const state = loadState();
  const account = state.accounts.find(a => a.id === accountId);
  if (!account) return false;
  const trade = account.trades.find(t => t.key === tradeKey);
  if (!trade) return false;
  trade.note = note;
  saveState(state);
  return true;
}
