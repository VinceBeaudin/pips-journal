// js/csv.js
const MONTHS = {
  // English
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  // French CSV (no accents)
  Avr: 3, Mai: 4, Juin: 5, Juil: 6, Jui: 6, Aou: 7, Fev: 1,
  // French PDF (with accents)
  'Fév': 1, 'Aoû': 7, 'Déc': 11, 'Janv': 0
};

function parseCTraderDate(str) {
  // Format: "30 Oct 2026 08:57:37.770" or "30 Avr 2026 08:57:37.770"
  const m = str.match(/^(\d+)\s+([A-Za-z\u00C0-\u024F]+)\s+(\d+)\s+(\d+):(\d+):(\d+)\.(\d+)/);
  if (!m) return null;
  const [, day, mon, year, h, min, s, ms] = m;
  const monthIndex = MONTHS[mon];
  if (monthIndex === undefined) return null; // unknown month → skip trade
  return new Date(Date.UTC(+year, monthIndex, +day, +h, +min, +s, +ms)).toISOString();
}

function parseNum(str) {
  return parseFloat(str.replace(/\s/g, ''));
}

function buildKey(symbol, closeTime, entryPrice, exitPrice) {
  return `${symbol}|${closeTime}|${entryPrice}|${exitPrice}`;
}

// Parse a CSV line handling quoted values
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += c; }
  }
  result.push(current.trim());
  return result;
}

// DD/MM/YYYY HH:MM:SS.mmm — new cTrader CSV export
function parseDDMMYYYYDate(str) {
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\.(\d+)/);
  if (!m) return null;
  const [, day, month, year, h, min, s, ms] = m;
  return new Date(Date.UTC(+year, +month - 1, +day, +h, +min, +s, +ms.slice(0, 3).padEnd(3, '0'))).toISOString();
}

// YYYY-MM-DD HH:MM:SS — trading journal CSV
function parseISODate(str) {
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, year, month, day, h, min, s] = m;
  return new Date(Date.UTC(+year, +month - 1, +day, +h, +min, +s)).toISOString();
}

// Legacy cTrader CSV: "Transactions" on line 0, headers on line 1, 8 cols
function parseLegacyCSV(dataLines) {
  const trades = [];
  for (const line of dataLines) {
    const cols = line.split(',');
    if (cols.length < 8) continue;
    const symbol    = cols[0].trim();
    if (symbol !== 'XAUUSD') continue;
    const direction = cols[1].trim();
    const closeRaw  = cols[2].trim();
    const entryRaw  = cols[3].trim();
    const exitRaw   = cols[4].trim();
    const quantity  = cols[5].trim();
    const pips      = parseNum(cols[6].trim());
    const netUSD    = parseNum(cols[7].trim());
    const entryPrice = parseNum(entryRaw);
    const exitPrice  = parseNum(exitRaw);
    if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(pips)) continue;
    const closeTime = parseCTraderDate(closeRaw);
    if (!closeTime) continue;
    trades.push({ key: buildKey(symbol, closeTime, entryRaw, exitRaw), symbol, direction, closeTime, entryPrice, exitPrice, quantity, pips, netUSD, note: null });
  }
  return trades;
}

// New cTrader CSV export (cT_*.csv):
// Symbole | Sens d'ouverture | Heure de clôture | Cours d'entrée | Price de clôture | Quantité | Pips
function parseCTraderExportCSV(dataLines) {
  const trades = [];
  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 7) continue;
    const symbol = cols[0];
    if (symbol !== 'XAUUSD') continue;
    const direction  = cols[1];
    const closeRaw   = cols[2];
    const entryRaw   = cols[3];
    const exitRaw    = cols[4];
    const quantity   = cols[5];
    const pips       = parseFloat(cols[6]);
    const entryPrice = parseFloat(entryRaw);
    const exitPrice  = parseFloat(exitRaw);
    if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(pips)) continue;
    const closeTime = parseDDMMYYYYDate(closeRaw);
    if (!closeTime) continue;
    trades.push({ key: buildKey(symbol, closeTime, entryRaw, exitRaw), symbol, direction, closeTime, entryPrice, exitPrice, quantity, pips, netUSD: 0, note: null });
  }
  return trades;
}

// Trading journal CSV (trading-journal.csv):
// Ticket | Ouvrir | Type | Volume | Symbole | Prix(entry) | SL | TP | Fermeture | Prix(exit) | Swap | Commissions | Profit | Pips | ...
function parseTradingJournalCSV(dataLines) {
  const trades = [];
  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 14) continue;
    const symbol = cols[4];
    if (symbol !== 'XAUUSD') continue;
    const rawDir    = cols[2].toLowerCase();
    const direction = rawDir === 'buy' ? 'Buy' : rawDir === 'sell' ? 'Sell' : cols[2];
    const entryRaw  = cols[5];
    const exitRaw   = cols[9];
    const closeRaw  = cols[8];
    const quantity  = cols[3];
    const pips      = parseFloat(cols[13]);
    const entryPrice = parseFloat(entryRaw);
    const exitPrice  = parseFloat(exitRaw);
    if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(pips)) continue;
    const closeTime = parseISODate(closeRaw);
    if (!closeTime) continue;
    trades.push({ key: buildKey(symbol, closeTime, entryRaw, exitRaw), symbol, direction, closeTime, entryPrice, exitPrice, quantity, pips, netUSD: 0, note: null });
  }
  return trades;
}

export function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (!lines.length) return [];

  // Legacy cTrader: "Transactions" header
  if (lines[0] === 'Transactions') return parseLegacyCSV(lines.slice(2));

  const cols = parseCSVLine(lines[0]);

  // New cTrader export: "Symbole","Sens d'ouverture",...
  if (cols[0] === 'Symbole' && cols[1] && cols[1].includes('ouverture')) return parseCTraderExportCSV(lines.slice(1));

  // Trading journal: Ticket,Ouvrir,Type,Volume,Symbole,...
  if (cols[0] === 'Ticket') return parseTradingJournalCSV(lines.slice(1));

  return [];
}

export async function parsePDFFile(file) {
  if (!window.pdfjsLib) throw new Error('PDF.js non chargé');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const data = await file.arrayBuffer();
  const pdf  = await pdfjsLib.getDocument({ data }).promise;

  const allItems = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      const text = item.str.replace(/[\u00A0\u202F\u2009]/g, ' ').trim();
      if (!text) continue;
      allItems.push({
        x: item.transform[4],
        y: (p - 1) * 1e6 - item.transform[5],
        text
      });
    }
  }

  allItems.sort((a, b) => a.y - b.y || a.x - b.x);

  const rows = [];
  for (const item of allItems) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(item.y - last.y) <= 3) {
      last.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  // Approach 1: all trade fields on same y-row
  const trades = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    const texts = row.items.map(i => i.text);
    if (texts[0] !== 'XAUUSD') continue;
    const line = texts.join(' ');
    const m = line.match(
      /^XAUUSD\s+(Vendre|Acheter|Buy|Sell)\s+(\d{1,2}\s+[A-Za-z\u00C0-\u024F]+\s+\d{4}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+(?:\s+Lots)?)\s+(-?[\d.]+)(?:\s+(-?[\d\s.,]+))?$/
    );
    if (!m) continue;
    const [, direction, closeRaw, entryRaw, exitRaw, qtyRaw, pipsRaw, netUSDRaw] = m;
    const entryPrice = parseFloat(entryRaw);
    const exitPrice  = parseFloat(exitRaw);
    const pips       = parseFloat(pipsRaw);
    const netUSD     = netUSDRaw ? parseFloat(netUSDRaw.replace(/\s/g, '')) : 0;
    if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(pips)) continue;
    const closeTime = parseCTraderDate(closeRaw);
    if (!closeTime) continue;
    const key = buildKey('XAUUSD', closeTime, entryRaw, exitRaw);
    trades.push({ key, symbol: 'XAUUSD', direction, closeTime, entryPrice, exitPrice, quantity: qtyRaw.trim(), pips, netUSD, note: null });
  }
  if (trades.length > 0) return trades;

  // Approach 2: fields on separate y-rows → chunk-based
  const chunks = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    let chunk = '';
    let lastRight = -Infinity;
    for (const item of row.items) {
      if (chunk && item.x - lastRight > 40) {
        chunks.push(chunk.trim());
        chunk = item.text;
      } else {
        chunk += (chunk ? ' ' : '') + item.text;
      }
      lastRight = item.x + item.text.length * 6;
    }
    if (chunk.trim()) chunks.push(chunk.trim());
  }

  let i = 0;
  while (i < chunks.length) {
    if (chunks[i] !== 'XAUUSD' || i + 6 >= chunks.length) { i++; continue; }
    const direction = chunks[i + 1];
    if (!['Vendre', 'Acheter', 'Buy', 'Sell'].includes(direction)) { i++; continue; }
    const closeRaw = chunks[i + 2];
    const entryRaw = chunks[i + 3];
    const exitRaw  = chunks[i + 4];
    const quantity = chunks[i + 5];
    const chunk6   = chunks[i + 6];
    let pipsRaw, netUSDRaw, advance;
    const combined = chunk6.match(/^(-?[\d.]+)\s+(-?[\d\s]+\.?\d+)$/);
    if (combined) {
      pipsRaw = combined[1]; netUSDRaw = combined[2].replace(/\s/g, ''); advance = 7;
    } else if (/^-?[\d.]+$/.test(chunk6)) {
      pipsRaw = chunk6;
      // Check if next chunk is a number (netUSD) or a new trade row
      if (i + 7 < chunks.length && /^-?[\d\s.,]+$/.test(chunks[i + 7])) {
        netUSDRaw = chunks[i + 7].replace(/\s/g, ''); advance = 8;
      } else {
        netUSDRaw = '0'; advance = 7;
      }
    } else { i++; continue; }
    const entryPrice = parseFloat(entryRaw);
    const exitPrice  = parseFloat(exitRaw);
    const pips       = parseFloat(pipsRaw);
    const netUSD     = parseFloat(netUSDRaw);
    if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(pips)) { i++; continue; }
    const closeTime = parseCTraderDate(closeRaw);
    if (!closeTime) { i++; continue; }
    const key = buildKey('XAUUSD', closeTime, entryRaw, exitRaw);
    trades.push({ key, symbol: 'XAUUSD', direction, closeTime, entryPrice, exitPrice, quantity, pips, netUSD, note: null });
    i += advance;
  }
  return trades;
}
